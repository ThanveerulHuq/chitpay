import { useEffect, useMemo, useState } from 'react'
import { Bell, CaretDown, CheckCircle, Circle, Play, Plus, Trophy } from '@phosphor-icons/react'
import { callCompleteCycle, callSendReminder, callStartCycle, fetchBoard } from '@/lib/api'
import type { BoardEntry } from '@shared'
import { formatMinor, getCycleStartBlockReason } from '@shared'
import { SelectionSection, PaymentMethodIcon, methodLabel } from '@/pages/admin/GroupDashboardPage'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import PaymentSheet from '@/components/PaymentSheet'
import { Button, Chip, ErrorNote } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useParams } from 'react-router-dom'

export default function GroupCycleDetailPage() { return <GroupShell><CycleDetailContent /></GroupShell> }

function CycleDetailContent() {
  const { t } = useI18n()
  const { cycleNumber: cycleParam } = useParams<{ cycleNumber: string }>()
  const { groupId, group, members, cycles, reload, isReadOnly } = useGroupWorkspace()
  const cycleNumber = Number(cycleParam)
  const cycle = cycles.find(({ id }) => Number(id) === cycleNumber)?.data ?? null
  const [board, setBoard] = useState<BoardEntry[] | null>(null)
  const [paymentMemberId, setPaymentMemberId] = useState<string | null>(null)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    await reload()
    if (cycle?.status !== 'upcoming') setBoard(await fetchBoard(groupId, cycleNumber))
  }

  useEffect(() => {
    let cancelled = false
    if (cycle?.status === 'upcoming') return
    void fetchBoard(groupId, cycleNumber).then((next) => { if (!cancelled) setBoard(next) })
    return () => { cancelled = true }
  }, [groupId, cycleNumber, cycle?.status])

  const memberMap = useMemo(() => new Map(members.map(({ id, data }) => [id, data])), [members])
  if (!cycle) return <div className="rounded-2xl bg-sunken p-8 text-center text-sm text-muted">{t('workspace.noCycles')}</div>

  async function start() {
    setBusy('start'); setError(null)
    try { await callStartCycle(groupId, cycleNumber); await refresh() }
    catch (nextError) { setError((nextError as Error).message) }
    finally { setBusy(null) }
  }

  if (cycle.status === 'upcoming') {
    const startBlockReason = getCycleStartBlockReason(
      members.filter((member) => member.data.status === 'active').length,
      cycle.cycleNumber,
      cycles.map((entry) => entry.data),
    )
    const startBlockMessage = startBlockReason === 'no_active_members'
      ? t('workspace.startCycleNeedsMember')
      : null
    return <><h1 className="text-xl font-bold">{t('workspace.cycleNumber', { cycle: cycle.cycleNumber })}</h1><p className="mt-1 text-sm text-muted">{t('workspace.plannedStart', { date: cycle.plannedStartDate })}</p><div className="mt-6 rounded-2xl border border-dashed border-line p-8 text-center"><Chip tone="neutral">{t('workspace.statusUpcoming')}</Chip><p className="mx-auto mt-3 max-w-[32ch] text-sm text-muted">{t('workspace.plannedDateInfo')}</p>{startBlockMessage && <p className="mx-auto mt-3 max-w-[32ch] text-sm font-medium text-ink">{startBlockMessage}</p>}{!isReadOnly && <Button onClick={() => void start()} disabled={busy !== null || startBlockReason !== null} title={startBlockMessage ?? undefined} className="mt-5"><Play size={16} weight="fill" />{busy === 'start' ? t('dash.starting') : t('workspace.startCycle')}</Button>}</div>{error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}</>
  }

  if (!board) return <div className="rounded-2xl bg-sunken p-8 text-center text-sm text-muted">{t('common.loading')}</div>
  const paidCount = board.filter((entry) => entry.status === 'paid').length
  const collected = cycle.collectedAmountMinor
  const expected = cycle.expectedPaymentCount * group.contributionAmountMinor
  const winner = cycle.recipientMembershipId ? memberMap.get(cycle.recipientMembershipId)?.displayName : null
  const ready = paidCount === cycle.expectedPaymentCount && Boolean(winner) && cycle.payout.status === 'paid'
  const completionReadyCount = [
    paidCount === cycle.expectedPaymentCount,
    Boolean(winner),
    cycle.payout.status === 'paid',
  ].filter(Boolean).length

  async function remind(membershipId?: string) {
    setBusy(membershipId ?? 'remind'); setError(null)
    try {
      const result = await callSendReminder({ groupId, cycleNumber, membershipId })
      if (result.total > 0 && result.sent < result.total) throw new Error(t('workspace.reminderError'))
    }
    catch (nextError) { setError((nextError as Error).message) }
    finally { setBusy(null) }
  }

  async function complete() {
    setBusy('complete'); setError(null)
    try { await callCompleteCycle({ groupId, cycleNumber }); await refresh() }
    catch (nextError) { setError((nextError as Error).message) }
    finally { setBusy(null) }
  }

  const active = cycle.status === 'active'
  return <>
    <div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold">{t('workspace.cycleNumber', { cycle: cycle.cycleNumber })}</h1><p className="mt-1 text-sm text-muted">{t('workspace.plannedStart', { date: cycle.plannedStartDate })}</p><div className="mt-2"><Chip tone={active ? 'pending' : 'paid'}>{active ? t('workspace.statusActive') : t('workspace.statusComplete')}</Chip></div></div>{active && !isReadOnly && board.some((entry) => entry.status === 'pending') && <Button variant="secondary" className="px-3 py-2 text-sm" onClick={() => void remind()} disabled={busy !== null}><Bell size={16} />{t('workspace.remindAll')}</Button>}</div>
    <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface text-center"><Stat label={t('workspace.collected')} value={formatMinor(collected, group.currency)} /><Stat label={t('workspace.paid')} value={`${paidCount} / ${cycle.expectedPaymentCount}`} /><Stat label={t('workspace.balance')} value={formatMinor(Math.max(expected - collected, 0), group.currency)} /></dl>
    {winner && <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4"><Trophy size={22} weight="fill" className="text-accent-strong dark:text-accent" /><div><p className="font-semibold">{winner}</p><p className="text-sm text-muted">{cycle.payout.status === 'paid' ? formatMinor(cycle.payout.amountMinor, group.currency) : t('workspace.payoutPending')}</p></div></div>}
    {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
    <section className="mt-5"><h2 className="mb-2 text-sm font-semibold text-muted">{t('workspace.cycleMembers')}</h2><ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">{board.map((entry) => { const pending = entry.status === 'pending'; return <li key={entry.membershipId} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.name}</p><p className="mt-1 text-xs text-muted">{pending ? formatMinor(group.contributionAmountMinor, group.currency) : entry.method ? methodLabel(entry.method, t) : t('status.paid')}</p></div><Chip tone={pending ? 'pending' : 'paid'}>{!pending && <PaymentMethodIcon method={entry.method ?? 'other'} size={13} weight="bold" />} {pending ? t('status.pending') : t('status.paid')}</Chip>{active && !isReadOnly && pending && <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => setPaymentMemberId(entry.membershipId)} disabled={busy !== null} aria-label={t('workspace.recordFor', { name: entry.name })} title={t('workspace.recordFor', { name: entry.name })} className="rounded-full p-2 text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent"><Plus size={17} weight="bold" /></button><button type="button" onClick={() => void remind(entry.membershipId)} disabled={busy !== null} aria-label={t('workspace.remindFor', { name: entry.name })} title={t('workspace.remindFor', { name: entry.name })} className="rounded-full p-2 text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent"><Bell size={17} weight={busy === entry.membershipId ? 'fill' : 'bold'} /></button></div>}</li> })}</ul></section>
    {active && !isReadOnly && <SelectionSection groupId={groupId} group={group} cycle={cycle} board={board} members={members} onChanged={() => void refresh()} onError={setError} />}
    {active && !isReadOnly && <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface">
      <button type="button" aria-expanded={completeOpen} aria-controls="complete-cycle-details" onClick={() => setCompleteOpen((open) => !open)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent">
        <span className="min-w-0 flex-1"><span className="block font-semibold">{t('workspace.completeCycle')}</span><span className="block text-sm text-muted">{t('workspace.readyCount', { count: completionReadyCount, total: 3 })}</span></span>
        <CaretDown size={18} className={`shrink-0 text-faint transition-transform ${completeOpen ? 'rotate-180' : ''}`} />
      </button>
      {completeOpen && <div id="complete-cycle-details" className="border-t border-line/60 px-4 pb-4"><Checklist done={paidCount === cycle.expectedPaymentCount} label={t('workspace.allPaymentsDone')} /><Checklist done={Boolean(winner)} label={t('workspace.recipientDone')} /><Checklist done={cycle.payout.status === 'paid'} label={t('workspace.payoutDone')} /><Button onClick={() => void complete()} disabled={!ready || busy !== null} className="mt-4 w-full">{busy === 'complete' ? t('common.saving') : t('workspace.completeCycle')}</Button></div>}
    </section>}
    {!isReadOnly && paymentMemberId && <PaymentSheet groupId={groupId} group={group} cycleNumber={cycleNumber} fixedMembershipId={paymentMemberId} onClose={() => setPaymentMemberId(null)} onDone={() => { setPaymentMemberId(null); void refresh() }} />}
  </>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="px-2 py-3"><dt className="text-[10px] uppercase tracking-wide text-faint">{label}</dt><dd className="mt-1 text-sm font-bold tabular-nums">{value}</dd></div> }
function Checklist({ done, label }: { done: boolean; label: string }) { return <p className="mt-3 flex items-center gap-2 text-sm">{done ? <CheckCircle size={18} weight="fill" className="text-success" /> : <Circle size={18} className="text-faint" />}{label}</p> }
