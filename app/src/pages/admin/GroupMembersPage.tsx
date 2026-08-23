import { useEffect, useMemo, useState } from 'react'
import { Funnel, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { fetchBoard, fetchCycle, fetchGroupPaymentRecords } from '@/lib/api'
import { formatMinor } from '@shared'
import type { BoardEntry } from '@shared'
import { AddMemberSection } from '@/pages/admin/GroupDashboardPage'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import PaymentSheet from '@/components/PaymentSheet'
import { Chip, Input } from '@/components/ui'
import { useI18n } from '@/i18n'

export default function GroupMembersPage() {
  return (
    <GroupShell>
      <MembersContent />
    </GroupShell>
  )
}

function MembersContent() {
  const { t } = useI18n()
  const { groupId, group, members, reload, isReadOnly } = useGroupWorkspace()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue' | 'selected'>('all')
  const [board, setBoard] = useState<BoardEntry[]>([])
  const [paymentMemberId, setPaymentMemberId] = useState<string | null>(null)
  const [fallbackTotals, setFallbackTotals] = useState<Map<string, { total: number; paidCycles: number }>>(new Map())
  const [dueDate, setDueDate] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (group.currentCycleNumber > 0) {
      void fetchCycle(groupId, group.currentCycleNumber).then((cycle) => {
        if (!cancelled) setDueDate(cycle?.dueDate ?? null)
      })
      void fetchBoard(groupId, group.currentCycleNumber).then((next) => {
        if (!cancelled) setBoard(next ?? [])
      })
    }
    const needsFallback = members.some(({ data }) => typeof data.totalContributedMinor !== 'number' || typeof data.paidCycleCount !== 'number')
    if (needsFallback) {
      void fetchGroupPaymentRecords(groupId).then((records) => {
        if (cancelled) return
        const totals = new Map<string, { total: number; paidCycles: number }>()
        for (const record of records) {
          const current = totals.get(record.membershipId) ?? { total: 0, paidCycles: 0 }
          current.total += record.amountMinor
          current.paidCycles += 1
          totals.set(record.membershipId, current)
        }
        setFallbackTotals(totals)
      })
    }
    return () => {
      cancelled = true
    }
  }, [groupId, group.currentCycleNumber, members])

  const boardById = useMemo(() => new Map(board.map((entry) => [entry.membershipId, entry])), [board])
  const overdue = dueDate != null && new Date().toISOString().slice(0, 10) > dueDate
  const visible = members.filter(({ id, data }) => {
    const entry = boardById.get(id)
    const nameMatch = data.displayName.toLowerCase().includes(search.toLowerCase())
    if (!nameMatch) return false
    if (filter === 'selected') return data.selectedInCycle != null
    if (filter === 'paid') return entry?.status === 'paid'
    if (filter === 'pending') return entry?.status === 'pending'
    if (filter === 'overdue') return entry?.status === 'pending' && overdue
    return true
  })

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlass size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('workspace.searchMembers')} className="mt-0 pl-9" />
        </div>
        <label className="relative shrink-0">
          <Funnel size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label={t('workspace.filterMembers')} className="h-12 appearance-none rounded-2xl border border-line bg-surface pl-9 pr-3 text-sm font-medium text-ink">
            <option value="all">{t('workspace.filterAll')}</option>
            <option value="paid">{t('status.paid')}</option>
            <option value="pending">{t('status.pending')}</option>
            <option value="overdue">{t('status.overdue')}</option>
            <option value="selected">{t('workspace.selected')}</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-sm text-muted">{members.length ? t('workspace.noMatchingMembers') : t('dash.rosterEmpty')}</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          {visible.map(({ id, data }) => {
            const entry = boardById.get(id)
            const fallback = fallbackTotals.get(id)
            const total = typeof data.totalContributedMinor === 'number' ? data.totalContributedMinor : fallback?.total ?? 0
            const paidCycles = typeof data.paidCycleCount === 'number' ? data.paidCycleCount : fallback?.paidCycles ?? 0
            return (
              <li key={id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold">{data.displayName}</p>
                    {data.status === 'inactive' && <Chip tone="neutral">{t('common.inactive')}</Chip>}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatMinor(total, group.currency)} · {t('workspace.paidCycles', { paid: paidCycles, total: group.currentCycleNumber })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {entry && <Chip tone={entry.status === 'paid' ? 'paid' : overdue ? 'overdue' : 'pending'}>{entry.status === 'paid' ? t('status.paid') : overdue ? t('status.overdue') : t('status.pending')}</Chip>}
                  {!isReadOnly && entry?.status === 'pending' && group.currentCycleNumber > 0 && (
                    <button type="button" onClick={() => setPaymentMemberId(id)} className="rounded-full p-2 text-accent-strong hover:bg-accent-soft dark:text-accent" aria-label={t('workspace.recordFor', { name: data.displayName })}>
                      <Plus size={18} weight="bold" />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!isReadOnly && (
        <section className="mt-7">
          <AddMemberSection groupId={groupId} onAdded={reload} />
        </section>
      )}

      {paymentMemberId !== null && group.currentCycleNumber > 0 && (
        <PaymentSheet groupId={groupId} group={group} cycleNumber={group.currentCycleNumber} fixedMembershipId={paymentMemberId || undefined} onClose={() => setPaymentMemberId(null)} onDone={() => { setPaymentMemberId(null); void reload() }} />
      )}
    </>
  )
}
