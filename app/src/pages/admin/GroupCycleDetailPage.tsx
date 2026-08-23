import { useEffect, useMemo, useState } from 'react'
import { Bell, Plus, Trophy } from '@phosphor-icons/react'
import { callSendReminder, fetchBoard } from '@/lib/api'
import type { BoardEntry } from '@shared'
import { formatMinor } from '@shared'
import { SelectionSection, PaymentMethodIcon, methodLabel } from '@/pages/admin/GroupDashboardPage'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import PaymentSheet from '@/components/PaymentSheet'
import { Button, Chip, ErrorNote } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useParams } from 'react-router-dom'

export default function GroupCycleDetailPage() {
  return <GroupShell><CycleDetailContent /></GroupShell>
}

function CycleDetailContent() {
  const { t } = useI18n()
  const { cycleNumber: cycleParam } = useParams<{ cycleNumber: string }>()
  const { groupId, group, members, cycles, reload, isReadOnly } = useGroupWorkspace()
  const cycleNumber = Number(cycleParam)
  const cycle = cycles.find(({ id }) => Number(id) === cycleNumber)?.data ?? null
  const [board, setBoard] = useState<BoardEntry[] | null>(null)
  const [paymentMemberId, setPaymentMemberId] = useState<string | null>(null)
  const [busyReminder, setBusyReminder] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchBoard(groupId, cycleNumber).then((next) => {
      if (!cancelled) setBoard(next)
    })
    return () => { cancelled = true }
  }, [groupId, cycleNumber])

  const memberMap = useMemo(() => new Map(members.map(({ id, data }) => [id, data])), [members])
  if (!cycle || !board) {
    return <div className="rounded-2xl bg-sunken p-8 text-center text-sm text-muted">{t('common.loading')}</div>
  }

  const paidCount = typeof cycle.paidCount === 'number' ? cycle.paidCount : board.filter((entry) => entry.status === 'paid').length
  const collected = typeof cycle.collectedAmountMinor === 'number' ? cycle.collectedAmountMinor : paidCount * group.monthlyAmountMinor
  const expected = group.memberCount * group.monthlyAmountMinor
  const winner = cycle.recipientMembershipId ? memberMap.get(cycle.recipientMembershipId)?.displayName : null
  const current = cycleNumber === group.currentCycleNumber

  async function remind(membershipId?: string) {
    setBusyReminder(membershipId ?? 'all')
    setError(null)
    try {
      await callSendReminder({ groupId, cycleNumber, membershipId })
    } catch {
      setError(t('workspace.reminderError'))
    } finally {
      setBusyReminder(null)
    }
  }

  return (
    <>
      <h1 className="mb-3 text-lg font-bold">{t('workspace.month', { month: cycle.monthNumber })}</h1>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{t('workspace.dueDate', { date: cycle.dueDate })}</p>
          <div className="mt-1 flex items-center gap-2">
            <Chip tone={new Date().toISOString().slice(0, 10) > cycle.dueDate && paidCount < group.memberCount ? 'overdue' : 'pending'}>{cycleStatusLabel(cycle.status, t)}</Chip>
            {current && <Chip tone="paid">{t('workspace.current')}</Chip>}
          </div>
        </div>
        {!isReadOnly && board.some((entry) => entry.status === 'pending') && (
          <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => void remind()} disabled={busyReminder !== null}>
            <Bell size={16} weight="bold" />
            {busyReminder === 'all' ? t('common.sending') : t('workspace.remindAll')}
          </Button>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface text-center">
        <div className="px-2 py-3"><dt className="text-[10px] uppercase tracking-wide text-faint">{t('workspace.collected')}</dt><dd className="mt-1 text-sm font-bold tabular-nums">{formatMinor(collected, group.currency)}</dd></div>
        <div className="px-2 py-3"><dt className="text-[10px] uppercase tracking-wide text-faint">{t('workspace.paid')}</dt><dd className="mt-1 text-sm font-bold tabular-nums">{paidCount} / {group.memberCount}</dd></div>
        <div className="px-2 py-3"><dt className="text-[10px] uppercase tracking-wide text-faint">{t('workspace.balance')}</dt><dd className="mt-1 text-sm font-bold tabular-nums">{formatMinor(Math.max(expected - collected, 0), group.currency)}</dd></div>
      </dl>

      {winner && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
          <Trophy size={22} weight="fill" className="shrink-0 text-accent-strong dark:text-accent" />
          <div className="min-w-0"><p className="font-semibold">{winner}</p><p className="text-sm text-muted">{t('workspace.winnerFor', { amount: formatMinor(cycle.payout.amountMinor || expected, group.currency) })}</p></div>
        </div>
      )}

      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold text-muted">{t('workspace.cycleMembers')}</h2>{!isReadOnly && <span className="text-xs text-faint">{t('workspace.tapPending')}</span>}</div>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          {board.map((entry) => {
            const pending = entry.status === 'pending'
            return <li key={entry.membershipId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.name}</p><p className="mt-1 text-xs text-muted">{pending ? t('workspace.balanceDue', { amount: formatMinor(group.monthlyAmountMinor, group.currency) }) : entry.method ? methodLabel(entry.method, t) : t('status.paid')}</p></div>
              <div className="flex shrink-0 items-center gap-2">{pending ? <Chip tone="pending">{t('status.pending')}</Chip> : <Chip tone="paid"><PaymentMethodIcon method={entry.method ?? 'other'} size={13} weight="bold" /> {t('status.paid')}</Chip>}{!isReadOnly && pending && <button type="button" onClick={() => setPaymentMemberId(entry.membershipId)} className="rounded-full p-2 text-accent-strong hover:bg-accent-soft dark:text-accent" aria-label={t('workspace.recordFor', { name: entry.name })}><Plus size={17} weight="bold" /></button>}{!isReadOnly && pending && <button type="button" onClick={() => void remind(entry.membershipId)} disabled={busyReminder !== null} className="rounded-full p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={t('workspace.remindFor', { name: entry.name })}><Bell size={16} weight="bold" /></button>}</div>
            </li>
          })}
        </ul>
      </section>

      {!isReadOnly && current && <>
        <SelectionSection groupId={groupId} group={group} cycle={cycle} board={board} members={members} onChanged={() => void reload()} onError={setError} />
      </>}

      {paymentMemberId !== null && <PaymentSheet groupId={groupId} group={group} cycleNumber={cycleNumber} fixedMembershipId={paymentMemberId} onClose={() => setPaymentMemberId(null)} onDone={() => { setPaymentMemberId(null); void reload() }} />}
    </>
  )
}

function cycleStatusLabel(status: string, t: (key: any, vars?: Record<string, string | number>) => string) {
  const labels: Record<string, string> = {
    upcoming: t('workspace.statusUpcoming'),
    payment_open: t('workspace.statusPaymentOpen'),
    collection_complete: t('workspace.statusCollectionComplete'),
    recipient_selected: t('workspace.statusRecipientSelected'),
    payout_recorded: t('workspace.statusPayoutRecorded'),
    complete: t('workspace.statusComplete'),
  }
  return labels[status] ?? status
}
