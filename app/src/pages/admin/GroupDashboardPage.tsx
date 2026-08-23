import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Bank, DotsThreeOutline, HandCoins, Money, QrCode, Trophy, WhatsappLogo, X } from '@phosphor-icons/react'
import { callAddMember, callConfirmSelection, callRecordPayout } from '@/lib/api'
import { whatsappLink } from '@/lib/whatsapp'
import { formatMinor, toMinor } from '@shared'
import type { BoardEntry, CycleDoc, GroupDoc, GroupMemberDoc, PaymentMethod } from '@shared'
import { Button, ErrorNote, Field, Input, PhoneInput } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useBodyLock } from '@/lib/useBodyLock'

export default function GroupDashboardPage() { return <Navigate to="/groups" replace /> }

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
  const [winner, setWinner] = useState<BoardEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const memberById = new Map(members.map(({ id, data }) => [id, data]))
  const eligible = board.filter((entry) => {
    const member = memberById.get(entry.membershipId)
    return Boolean(member && member.status === 'active' && member.selectedInCycle == null && (!group.requirePaidToWin || entry.status === 'paid'))
  })
  const poolAmountMinor = group.contributionAmountMinor * cycle.expectedPaymentCount
  useBodyLock(Boolean(winner))
  if (cycle.status !== 'active') return null

  if (cycle.recipientMembershipId) {
    const recipient = board.find((entry) => entry.membershipId === cycle.recipientMembershipId)
    if (cycle.payout.status === 'pending') {
      return <PayoutSection groupId={groupId} cycleNumber={cycle.cycleNumber} recipientName={recipient?.name ?? t('memberView.aMember')} poolAmountMinor={poolAmountMinor} currency={group.currency} onChanged={onChanged} onError={onError} />
    }
    return <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4"><HandCoins size={22} className="text-accent-strong dark:text-accent" /><div><p className="text-sm font-semibold">{t('dash.payoutRecorded')}</p><p className="text-xs text-muted">{recipient?.name} · {formatMinor(cycle.payout.amountMinor, group.currency)}</p></div></div>
  }

  async function confirmWinner() {
    if (!winner) return
    setBusy(true)
    try {
      await callConfirmSelection({ groupId, cycleNumber: cycle.cycleNumber, membershipId: winner.membershipId })
      setWinner(null)
      onChanged()
    } catch (error) {
      onError((error as Error).message)
      setWinner(null)
    } finally { setBusy(false) }
  }

  return <>
    <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-center">
      <p className="font-semibold">{t('dash.pickRecipient')}</p>
      <p className="mx-auto mt-1 max-w-[34ch] text-sm text-muted">{t('dash.eligibleMembersCount', { type: group.requirePaidToWin ? t('dash.eligiblePaid') : t('dash.eligibleAll'), count: eligible.length, pool: formatMinor(poolAmountMinor, group.currency) })}</p>
      <Button onClick={() => eligible.length && setWinner(securePick(eligible))} disabled={eligible.length === 0} className="mt-4">{t('dash.pickRandomly')}</Button>
    </div>
    {winner && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && setWinner(null)}><div className="w-full max-w-lg rounded-t-3xl bg-surface p-6 text-center sm:rounded-2xl"><Trophy size={36} weight="fill" className="mx-auto text-accent-strong dark:text-accent" /><h2 className="mt-3 text-xl font-bold">{winner.name}</h2><p className="mt-1 text-sm text-muted">{t('dash.winnerReceives', { amount: formatMinor(poolAmountMinor, group.currency) })}</p><div className="mt-6 flex gap-3"><Button variant="secondary" onClick={() => setWinner(null)} className="flex-1">{t('common.cancel')}</Button><Button onClick={() => void confirmWinner()} disabled={busy} className="flex-1">{busy ? t('common.confirming') : t('common.confirm')}</Button></div></div></div>}
  </>
}

function PayoutSection({ groupId, cycleNumber, recipientName, poolAmountMinor, currency, onChanged, onError }: { groupId: string; cycleNumber: number; recipientName: string; poolAmountMinor: number; currency: string; onChanged: () => void; onError: (message: string) => void }) {
  const { t } = useI18n()
  const [amount, setAmount] = useState(String(poolAmountMinor / 100))
  const [busy, setBusy] = useState(false)
  async function record() {
    setBusy(true)
    try { await callRecordPayout({ groupId, cycleNumber, amountMinor: toMinor(Number(amount)) }); onChanged() }
    catch (error) { onError((error as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="mt-4 rounded-2xl border border-line bg-surface p-4"><div className="flex items-center gap-3"><HandCoins size={22} className="text-accent-strong dark:text-accent" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{t('dash.payoutNotice', { name: recipientName, amount: formatMinor(poolAmountMinor, currency) })}</p><p className="text-xs text-muted">{t('dash.payoutHint')}</p></div></div><Field label={t('dash.payoutAmountLabel')}><Input type="number" min={1} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Button onClick={() => void record()} disabled={busy} className="mt-4 w-full">{busy ? t('dash.recording') : t('dash.recordPayout')}</Button></div>
}

export function AddMemberSection({ groupId, onAdded }: { groupId: string; onAdded: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ name: string; phone: string; password: string } | null>(null)
  useBodyLock(Boolean(invite))
  async function add(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null)
    try { const fullPhone = `+91${phone}`; const result = await callAddMember({ groupId, name, phone: fullPhone }); setInvite({ name, phone: fullPhone, password: result.password }); setOpen(false); setName(''); setPhone(''); onAdded() }
    catch (nextError) { setError((nextError as Error).message) }
    finally { setBusy(false) }
  }
  return <>
    {!open && <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">{t('dash.addMember')}</Button>}
    {open && <form onSubmit={add} className="space-y-4 rounded-2xl border border-line bg-surface p-5"><h2 className="font-semibold">{t('dash.addMember')}</h2>{error && <ErrorNote>{error}</ErrorNote>}<Field label={t('dash.memberName')}><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label={t('dash.memberPhone')} hint={t('dash.memberPhoneHint')}><PhoneInput value={phone} onChange={setPhone} /></Field><div className="flex gap-3"><Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">{t('common.cancel')}</Button><Button type="submit" disabled={busy || phone.length !== 10} className="flex-1">{busy ? t('common.adding') : t('common.add')}</Button></div></form>}
    {invite && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && setInvite(null)}><div className="w-full max-w-lg rounded-t-3xl bg-surface p-5 sm:rounded-2xl"><div className="flex items-start justify-between"><h2 className="text-lg font-bold">{t('dash.memberAddedTitle', { name: invite.name })}</h2><button onClick={() => setInvite(null)} aria-label={t('common.close')}><X size={20} /></button></div><div className="my-5 rounded-2xl bg-sunken p-4 text-center"><p className="text-xs text-muted">{t('dash.passwordLabel')}</p><p className="mt-1 font-mono text-2xl font-bold tracking-widest">{invite.password}</p></div><a href={whatsappLink(invite.phone, t('dash.whatsappInviteText', { name: invite.name, password: invite.password }))} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 font-semibold text-[#06301b]"><WhatsappLogo size={20} weight="fill" />{t('dash.sendViaWhatsapp')}</a></div></div>}
  </>
}
