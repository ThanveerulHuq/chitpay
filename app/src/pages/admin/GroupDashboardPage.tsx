import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Bank, CaretRight, DotsThreeOutline, HandCoins, MagnifyingGlass, Minus, Money, Plus, QrCode, Trophy, X } from '@phosphor-icons/react'
import { callAddMember, callConfirmSelection, callRecordPayout } from '@/lib/api'
import { formatMinor, toMinor } from '@shared'
import type { BoardEntry, CycleDoc, GroupDoc, GroupMemberDoc, PaymentMethod } from '@shared'
import { Button, ErrorNote, Field, Input, PhoneInput } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useBodyLock } from '@/lib/useBodyLock'

export default function GroupDashboardPage() { return <Navigate to="/" replace /> }

export function PaymentMethodIcon({ method, size = 14, weight = 'regular', className = '' }: { method: PaymentMethod; size?: number; weight?: 'regular' | 'bold' | 'fill'; className?: string }) {
  switch (method) {
    case 'cash': return <Money size={size} weight={weight} className={className} />
    case 'upi': return <QrCode size={size} weight={weight} className={className} />
    case 'bank_transfer': return <Bank size={size} weight={weight} className={className} />
    case 'other': return <DotsThreeOutline size={size} weight={weight} className={className} />
  }
}

export function methodLabel(method: PaymentMethod, t: (key: any) => string): string {
  switch (method) {
    case 'cash': return t('dash.methodCash')
    case 'upi': return t('dash.methodUpi')
    case 'bank_transfer': return t('dash.methodBank')
    case 'other': return t('dash.methodOther')
  }
}

function securePick<T>(items: T[]): T {
  const random = new Uint32Array(1)
  crypto.getRandomValues(random)
  return items[random[0] % items.length]!
}

export function SelectionSection({ groupId, group, cycle, board, members, onChanged, onError }: { groupId: string; group: GroupDoc; cycle: CycleDoc; board: BoardEntry[]; members: { id: string; data: GroupMemberDoc }[]; onChanged: () => void; onError: (message: string) => void }) {
  const { t } = useI18n()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [winner, setWinner] = useState<BoardEntry | null>(null)
  const [willingMembershipIds, setWillingMembershipIds] = useState<Set<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const memberById = new Map(members.map(({ id, data }) => [id, data]))
  const eligible = board.filter((entry) => {
    const member = memberById.get(entry.membershipId)
    return Boolean(member && member.status === 'active' && member.selectedInCycle == null)
  })
  const willing = eligible.filter((entry) => willingMembershipIds.has(entry.membershipId))
  const visibleEligible = eligible.filter((entry) => entry.name.toLowerCase().includes(search.trim().toLowerCase()))
  const poolAmountMinor = group.contributionAmountInPaise * cycle.expectedPaymentCount
  useBodyLock(pickerOpen)
  if (cycle.status !== 'active') return null

  if (cycle.recipientMembershipId) {
    const recipient = board.find((entry) => entry.membershipId === cycle.recipientMembershipId)
    if (cycle.payout.status === 'pending') {
      return <PayoutSection groupId={groupId} cycleNumber={cycle.cycleNumber} recipientName={recipient?.name ?? t('memberView.aMember')} poolAmountMinor={poolAmountMinor} onChanged={onChanged} onError={onError} />
    }
    return <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4"><HandCoins size={22} className="text-accent-strong dark:text-accent" /><div><p className="text-sm font-semibold">{t('dash.payoutRecorded')}</p><p className="text-xs text-muted">{recipient?.name} · {formatMinor(cycle.payout.amountMinor)}</p></div></div>
  }

  async function confirmWinner() {
    if (!winner) return
    setBusy(true)
    setPickerError(null)
    try {
      await callConfirmSelection({
        groupId,
        cycleNumber: cycle.cycleNumber,
        membershipId: winner.membershipId,
        willingMembershipIds: willing.map((entry) => entry.membershipId),
      })
      closePicker()
      onChanged()
    } catch (error) {
      setPickerError((error as Error).message)
      setWinner(null)
    } finally { setBusy(false) }
  }

  function closePicker() {
    setPickerOpen(false)
    setSearch('')
    setWinner(null)
    setWillingMembershipIds(new Set())
    setPickerError(null)
  }

  function toggleWilling(membershipId: string) {
    setWillingMembershipIds((current) => {
      const next = new Set(current)
      if (next.has(membershipId)) next.delete(membershipId)
      else next.add(membershipId)
      return next
    })
  }

  function chooseWinner() {
    setPickerError(null)
    if (willing.length === 1) setWinner(willing[0]!)
    else if (willing.length > 1) setWinner(securePick(willing))
  }

  return <>
    <button type="button" onClick={() => setPickerOpen(true)} disabled={eligible.length === 0} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:bg-sunken disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-strong dark:text-accent"><Trophy size={20} weight="fill" /></span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{t('dash.pickRecipient')}</span><span className="block text-sm text-muted">{t('dash.eligibleCount', { count: eligible.length })}</span></span>
      <CaretRight size={18} className="shrink-0 text-faint" />
    </button>
    {pickerOpen && <div role="dialog" aria-modal="true" aria-labelledby="recipient-picker-title" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && closePicker()}>
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line/60 p-5 pb-4">
          <h2 id="recipient-picker-title" className="text-lg font-bold">{winner ? t('workspace.winner') : t('dash.pickRecipient')}</h2>
          <button type="button" onClick={closePicker} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken hover:text-ink"><X size={20} weight="bold" /></button>
        </div>
        {winner ? <div className="flex-1 overflow-y-auto p-6 text-center">
          <Trophy size={42} weight="fill" className="mx-auto text-accent-strong dark:text-accent" />
          <p className="mt-4 text-2xl font-bold">{winner.name}</p>
          <p className="mt-1 text-sm text-muted">{formatMinor(poolAmountMinor)}</p>
          {pickerError && <div className="mt-4 text-left"><ErrorNote>{pickerError}</ErrorNote></div>}
        </div> : <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {pickerError && <div className="mb-4"><ErrorNote>{pickerError}</ErrorNote></div>}
          <div className="relative">
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <Input aria-label={t('workspace.searchMembers')} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('workspace.searchMembers')} className="mt-0 pl-10" />
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-line">
            {visibleEligible.length === 0 ? <p className="p-5 text-center text-sm text-muted">{t('workspace.noMatchingMembers')}</p> : visibleEligible.map((entry) => {
              const member = memberById.get(entry.membershipId)!
              return <label key={entry.membershipId} className="flex cursor-pointer items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-0 hover:bg-sunken">
                <input type="checkbox" checked={willingMembershipIds.has(entry.membershipId)} onChange={() => toggleWilling(entry.membershipId)} className="size-5 shrink-0 accent-accent" />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{entry.name}</span><span className="block text-xs text-muted">{t('common.slot', { slotNo: member.slotNo })}</span></span>
              </label>
            })}
          </div>
        </div>}
        <div className="shrink-0 border-t border-line/60 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5">
          {winner ? <div className="flex gap-3"><Button variant="secondary" onClick={() => setWinner(null)} disabled={busy} className="flex-1">{t('common.back')}</Button><Button onClick={() => void confirmWinner()} disabled={busy} className="flex-1">{busy ? t('common.confirming') : t('common.confirm')}</Button></div> : <Button onClick={chooseWinner} disabled={willing.length === 0} className="w-full">{willing.length === 1 ? t('dash.announceWinner') : t('dash.pickRandomly')}</Button>}
        </div>
      </div>
    </div>}
  </>
}

function PayoutSection({ groupId, cycleNumber, recipientName, poolAmountMinor, onChanged, onError }: { groupId: string; cycleNumber: number; recipientName: string; poolAmountMinor: number; onChanged: () => void; onError: (message: string) => void }) {
  const { t } = useI18n()
  const [amount, setAmount] = useState(String(poolAmountMinor / 100))
  const [busy, setBusy] = useState(false)
  async function record() {
    setBusy(true)
    try { await callRecordPayout({ groupId, cycleNumber, amountMinor: toMinor(Number(amount)) }); onChanged() }
    catch (error) { onError((error as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="mt-4 rounded-2xl border border-line bg-surface p-4"><div className="flex items-center gap-3"><HandCoins size={22} className="text-accent-strong dark:text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t('dash.payoutNotice', { name: recipientName, amount: formatMinor(poolAmountMinor) })}</p><p className="text-xs text-muted">{t('dash.payoutHint')}</p></div></div><Field label={t('dash.payoutAmountLabel')}><Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Button onClick={() => void record()} disabled={busy} className="mt-4 w-full">{busy ? t('dash.recording') : t('dash.recordPayout')}</Button></div>
}

export function AddMemberSection({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [chitCount, setChitCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function isDuplicateMember(nextError: unknown) {
    const firebaseError = nextError as { code?: string; details?: { code?: string } }
    return firebaseError.code === 'functions/already-exists'
      || firebaseError.code === 'already-exists'
      || firebaseError.details?.code === 'already_exists'
  }

  async function save() {
    const trimmedName = name.trim()
    if (!trimmedName) return

    setBusy(true)
    setError(null)
    try {
      await callAddMember({ groupId, name: trimmedName, phone: `+91${phone}`, chitCount })
      setOpen(false)
      setName('')
      setPhone('')
      setChitCount(1)
      onAdded()
    } catch (nextError) {
      setError(isDuplicateMember(nextError) ? t('dash.duplicateMemberEditHint') : (nextError as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault()
    await save()
  }

  function changeChitCount(nextCount: number) {
    setChitCount(Math.max(1, Math.min(100, nextCount)))
  }

  return <>
    {!open && <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">{t('dash.addMember')}</Button>}
    {open && <form onSubmit={add} className="space-y-4 rounded-2xl border border-line bg-surface p-5"><h2 className="font-semibold">{t('dash.addMember')}</h2>{error && <ErrorNote>{error}</ErrorNote>}<Field label={t('dash.memberName')}><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label={t('dash.memberPhone')} hint={t('dash.memberPhoneHint')}><PhoneInput value={phone} onChange={setPhone} /></Field><fieldset><legend className="text-sm font-medium text-ink">{t('dash.chitCount')}</legend><div className="mt-2 grid w-36 grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-xl border border-line bg-surface"><button type="button" onClick={() => changeChitCount(chitCount - 1)} disabled={chitCount === 1} aria-label={t('dash.decreaseChitCount')} className="grid h-10 place-items-center border-r border-line text-ink transition-colors hover:bg-sunken disabled:pointer-events-none disabled:text-faint"><Minus size={16} weight="bold" /></button><output aria-live="polite" className="grid h-10 place-items-center font-bold tabular-nums text-ink">{chitCount}</output><button type="button" onClick={() => changeChitCount(chitCount + 1)} disabled={chitCount === 100} aria-label={t('dash.increaseChitCount')} className="grid h-10 place-items-center border-l border-line text-ink transition-colors hover:bg-sunken disabled:pointer-events-none disabled:text-faint"><Plus size={16} weight="bold" /></button></div><span className="mt-1 block text-xs text-muted">{t('dash.chitCountHint')}</span></fieldset><div className="flex gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">{t('common.cancel')}</Button><Button type="submit" disabled={busy || !name.trim() || phone.length !== 10} className="flex-1">{busy ? t('common.adding') : t('common.add')}</Button></div></form>}
  </>
}
