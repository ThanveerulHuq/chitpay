import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { X, Money, QrCode, Bank, DotsThreeOutline } from '@phosphor-icons/react'
import { callMarkPaid, fetchBoard } from '@/lib/api'
import type { BoardEntry } from '@shared'
import type { GroupDoc, PaymentMethod } from '@shared'
import { contributionInPaise, formatMinor, userMessage } from '@shared'
import { Button, Dropdown, ErrorNote, Field, Input, Textarea } from '@/components/ui'
import { useI18n } from '@/i18n'
import { PaymentMethodIcon, methodLabel } from '@/pages/admin/GroupDashboardPage'
import { useBodyLock } from '@/lib/useBodyLock'
import { useLocale } from '@/lib/format'
import { formatCycleName, plannedDateForCycle } from '@/lib/cycleName'

export default function PaymentSheet({
  groupId,
  group,
  cycleNumber,
  pendingCycleNumbers,
  fixedMembershipId,
  membershipIds,
  onClose,
  onDone,
}: {
  groupId: string
  group: GroupDoc
  cycleNumber?: number
  pendingCycleNumbers?: number[]
  fixedMembershipId?: string
  membershipIds?: string[]
  onClose: () => void
  onDone: () => void
}) {
  const { t, lang } = useI18n()
  const locale = useLocale()
  const [selectedCycleNumber, setSelectedCycleNumber] = useState(
    cycleNumber ?? pendingCycleNumbers?.[0] ?? 0,
  )
  const [board, setBoard] = useState<BoardEntry[] | null>(null)
  const [selectedId, setSelectedId] = useState(fixedMembershipId ?? '')
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [referenceNo, setReferenceNo] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const allowedMembershipIds = useMemo(() => membershipIds ? new Set(membershipIds) : null, [membershipIds])
  useBodyLock(true)

  useEffect(() => {
    let cancelled = false
    if (!selectedCycleNumber) return
    void fetchBoard(groupId, selectedCycleNumber).then((next) => {
      if (cancelled) return
      const unpaid = (next ?? []).filter((entry) => entry.status === 'pending' && (!allowedMembershipIds || allowedMembershipIds.has(entry.membershipId)))
      setBoard(next ?? [])
      setSelectedId((current) => unpaid.some((entry) => entry.membershipId === current) ? current : unpaid[0]?.membershipId ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [allowedMembershipIds, groupId, selectedCycleNumber])

  const unpaid = useMemo(
    () => (board ?? []).filter((entry) => entry.status === 'pending' && (!allowedMembershipIds || allowedMembershipIds.has(entry.membershipId)) && entry.name.toLowerCase().includes(search.toLowerCase())),
    [allowedMembershipIds, board, search],
  )
  const selected = board?.find((entry) => entry.membershipId === selectedId) ?? null

  function selectCycle(value: string) {
    setBoard(null)
    setSelectedCycleNumber(Number(value))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await callMarkPaid({
        groupId,
        membershipId: selected.membershipId,
        cycleNumber: selectedCycleNumber,
        method,
        referenceNo: referenceNo.trim() || undefined,
        note: note.trim() || undefined,
      })
      onDone()
    } catch (err) {
      const code = (err as { details?: { code?: Parameters<typeof userMessage>[0] } })?.details?.code
      setError(code ? userMessage(code, lang) : userMessage('internal', lang))
      setBusy(false)
    }
  }

  const methods: { value: PaymentMethod; Icon: typeof Money }[] = [
    { value: 'cash', Icon: Money },
    { value: 'upi', Icon: QrCode },
    { value: 'bank_transfer', Icon: Bank },
    { value: 'other', Icon: DotsThreeOutline },
  ]

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <form onSubmit={handleSubmit} className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between border-b border-line/60 p-5 pb-4">
          <div>
            <h2 className="text-lg font-bold">{t('workspace.recordPayment')}</h2>
            <p className="text-sm text-muted">{t('workspace.cycleAmount', { amount: formatMinor(contributionInPaise(group)), cycle: formatCycleName(plannedDateForCycle(group, selectedCycleNumber), group.frequency, locale, t) })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken hover:text-ink">
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          {error && <ErrorNote>{error}</ErrorNote>}
          {!board ? (
            <div className="rounded-2xl bg-sunken p-6 text-center text-sm text-muted">{t('common.loading')}</div>
          ) : board.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{t('workspace.noMembers')}</div>
          ) : (
            <>
              {pendingCycleNumbers && pendingCycleNumbers.length > 1 && (
                <Field label={t('workspace.chooseCycle')}>
                  <Dropdown
                    value={String(selectedCycleNumber)}
                    onChange={selectCycle}
                    options={pendingCycleNumbers.map((pendingCycleNumber) => ({
                      value: String(pendingCycleNumber),
                      label: formatCycleName(plannedDateForCycle(group, pendingCycleNumber), group.frequency, locale, t),
                    }))}
                  />
                </Field>
              )}
              {!fixedMembershipId && (
                <Field label={t('workspace.chooseMember')}>
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('workspace.searchMembers')} />
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-2xl border border-line">
                    {unpaid.length === 0 ? (
                      <p className="p-4 text-sm text-muted">{t('workspace.noPendingPayments')}</p>
                    ) : unpaid.map((entry) => (
                      <button key={entry.membershipId} type="button" onClick={() => setSelectedId(entry.membershipId)} className={`flex w-full items-center justify-between border-b border-line px-4 py-3 text-left last:border-0 ${selectedId === entry.membershipId ? 'bg-accent-soft' : 'hover:bg-sunken'}`}>
                        <span className="truncate text-sm font-medium">{entry.name}{membershipIds && <span className="ml-1 font-normal text-muted">· {t('workspace.chitNumber', { count: membershipIds.indexOf(entry.membershipId) + 1 })}</span>}</span>
                        <span className="text-xs text-muted">{t('status.pending')}</span>
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {selected && (
                <div className="rounded-2xl bg-sunken px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{selected.name}</span>
                    <span className="font-semibold tabular-nums">{formatMinor(contributionInPaise(group))}</span>
                  </div>
                </div>
              )}
              <Field label={t('dash.paymentMethod')}>
                <div role="radiogroup" className="grid grid-cols-2 gap-2">
                  {methods.map(({ value, Icon }) => (
                    <button key={value} type="button" role="radio" aria-checked={method === value} onClick={() => setMethod(value)} className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium ${method === value ? 'border-accent bg-accent-soft text-accent-strong dark:text-accent' : 'border-line text-muted hover:bg-sunken'}`}>
                      <Icon size={17} weight={method === value ? 'bold' : 'regular'} />
                      {methodLabel(value, t)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('dash.refNumber')} hint={t('dash.refNumberHint')}>
                <Input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} />
              </Field>
              <Field label={t('dash.note')} hint={t('common.optional')}>
                <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
            </>
          )}
        </div>
        <div className="shrink-0 border-t border-line/60 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5">
          <Button type="submit" disabled={busy || !selected} className="w-full">{busy ? t('common.saving') : t('workspace.savePayment')}</Button>
        </div>
      </form>
    </div>
  )
}

export function PaymentStatusIcon({ method }: { method: PaymentMethod }) {
  return <PaymentMethodIcon method={method} size={13} weight="bold" />
}
