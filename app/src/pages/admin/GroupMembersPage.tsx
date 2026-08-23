import { useEffect, useState } from 'react'
import { Funnel, MagnifyingGlass } from '@phosphor-icons/react'
import { fetchGroupPaymentRecords } from '@/lib/api'
import { formatMinor } from '@shared'
import { AddMemberSection } from '@/pages/admin/GroupDashboardPage'
import GroupShell, { useGroupWorkspace } from './GroupShell'
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
  const [filter, setFilter] = useState<'all' | 'selected'>('all')
  const [fallbackTotals, setFallbackTotals] = useState<Map<string, { total: number; paidCycles: number }>>(new Map())

  useEffect(() => {
    let cancelled = false
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
  }, [groupId, members])

  const visible = members.filter(({ data }) => {
    const nameMatch = data.displayName.toLowerCase().includes(search.toLowerCase())
    if (!nameMatch) return false
    if (filter === 'selected') return data.selectedInCycle != null
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
                    {formatMinor(total, group.currency)} · {t('workspace.paidCycles', { paid: paidCycles, total: group.cycleCount })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {data.selectedInCycle != null && <Chip tone="paid">{t('workspace.selected')}</Chip>}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!isReadOnly && group.completedCycleCount === 0 && (
        <section className="mt-7">
          <AddMemberSection groupId={groupId} onAdded={reload} />
        </section>
      )}
      {!isReadOnly && group.completedCycleCount > 0 && <p className="mt-7 rounded-2xl bg-sunken p-4 text-sm text-muted">{t('workspace.membersLocked')}</p>}
    </>
  )
}
