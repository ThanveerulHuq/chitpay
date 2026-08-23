import { useEffect, useMemo, useState } from 'react'
import { Bell, MagnifyingGlass, Money } from '@phosphor-icons/react'
import { callSendMemberReminder, fetchBoard, fetchGroupPaymentRecords } from '@/lib/api'
import { formatMinor } from '@shared'
import { AddMemberSection } from '@/pages/admin/GroupDashboardPage'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import PaymentSheet from '@/components/PaymentSheet'
import { Chip, ErrorNote, Input } from '@/components/ui'
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
  const { groupId, group, members, cycles, reload, isReadOnly } = useGroupWorkspace()
  const [search, setSearch] = useState('')
  const [fallbackTotals, setFallbackTotals] = useState<Map<string, { total: number; paidCycles: number }>>(new Map())
  const [pendingByMember, setPendingByMember] = useState<Map<string, number[]>>(new Map())
  const [paymentMember, setPaymentMember] = useState<{ id: string; cycles: number[] } | null>(null)
  const [busyMember, setBusyMember] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRefresh, setPendingRefresh] = useState(0)
  const activeCycleNumbers = useMemo(
    () => cycles
      .filter(({ data }) => data.status === 'active')
      .map(({ data }) => data.cycleNumber)
      .sort((a, b) => a - b),
    [cycles],
  )

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

  useEffect(() => {
    let cancelled = false
    void Promise.all(activeCycleNumbers.map(async (cycleNumber) => ({
      cycleNumber,
      board: await fetchBoard(groupId, cycleNumber),
    }))).then((boards) => {
      if (cancelled) return
      const next = new Map<string, number[]>()
      for (const { cycleNumber, board } of boards) {
        for (const entry of board ?? []) {
          if (entry.status !== 'pending') continue
          const pendingCycles = next.get(entry.membershipId) ?? []
          pendingCycles.push(cycleNumber)
          next.set(entry.membershipId, pendingCycles)
        }
      }
      setPendingByMember(next)
    }).catch(() => {
      if (!cancelled) setError(t('workspace.pendingLoadError'))
    })
    return () => {
      cancelled = true
    }
  }, [activeCycleNumbers, groupId, pendingRefresh, t])

  async function remindMember(membershipId: string) {
    setBusyMember(membershipId)
    setError(null)
    try {
      const result = await callSendMemberReminder({ groupId, membershipId })
      if (result.pendingCycleCount > 0 && result.sent === 0) {
        throw new Error('Reminder delivery failed')
      }
      if (result.pendingCycleCount === 0) setPendingRefresh((value) => value + 1)
    } catch {
      setError(t('workspace.reminderError'))
    } finally {
      setBusyMember(null)
    }
  }

  const visible = members.filter(({ data }) => data.displayName.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div className="relative">
        <MagnifyingGlass size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('workspace.searchMembers')} className="mt-0 pl-9" />
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

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
            const pendingCycles = pendingByMember.get(id) ?? []
            const totalPending = pendingCycles.length * group.contributionAmountMinor
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
                  {pendingCycles.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-ink">
                      {t('workspace.totalPending', { amount: formatMinor(totalPending, group.currency) })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {data.selectedInCycle != null && <Chip tone="paid">{t('workspace.selected')}</Chip>}
                  {!isReadOnly && pendingCycles.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPaymentMember({ id, cycles: pendingCycles })}
                        aria-label={t('workspace.recordFor', { name: data.displayName })}
                        title={t('workspace.recordFor', { name: data.displayName })}
                        className="rounded-full border border-line p-2 text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent"
                      >
                        <Money size={17} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remindMember(id)}
                        disabled={busyMember !== null}
                        aria-label={t('workspace.remindFor', { name: data.displayName })}
                        title={t('workspace.remindFor', { name: data.displayName })}
                        className="rounded-full border border-line p-2 text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent"
                      >
                        <Bell size={17} weight={busyMember === id ? 'fill' : 'bold'} />
                      </button>
                    </>
                  )}
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
      {!isReadOnly && paymentMember && (
        <PaymentSheet
          groupId={groupId}
          group={group}
          pendingCycleNumbers={paymentMember.cycles}
          fixedMembershipId={paymentMember.id}
          onClose={() => setPaymentMember(null)}
          onDone={() => {
            setPaymentMember(null)
            void reload().finally(() => setPendingRefresh((value) => value + 1))
          }}
        />
      )}
    </>
  )
}
