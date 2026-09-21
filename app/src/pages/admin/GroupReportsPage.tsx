import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarBlank, HandCoins, PencilSimple, Receipt, X } from '@phosphor-icons/react'
import { callEditPayment, callReversePayment, fetchGroupPaymentLedger, fetchMyMemberships, filterPaymentsByRange, type PaymentLedgerRecord } from '@/lib/api'
import { formatDate, formatMinor } from '@shared'
import type { PaymentMethod } from '@shared'
import ReportDateFilterSheet from '@/components/ReportDateFilterSheet'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import { Button, Chip, Dropdown, ErrorNote, Field, Input, Textarea } from '@/components/ui'
import { useI18n } from '@/i18n'
import { PaymentMethodIcon, methodLabel } from '@/pages/admin/GroupDashboardPage'
import { useLocale } from '@/lib/format'
import { useBodyLock } from '@/lib/useBodyLock'
import { formatCycleName, plannedDateForCycle } from '@/lib/cycleName'

export default function GroupReportsPage() {
  return <GroupShell><ReportsContent /></GroupShell>
}

type ReportFilters = {
  from: string
  to: string
  cycle: string
  method: 'all' | PaymentMethod
}

type ReportEntry = {
  kind: 'payment' | 'payout'
  cycleNumber: number
  membershipId: string
  amountMinor: number
  paidAtMs: number | null
  payment?: PaymentLedgerRecord
}

const emptyFilters: ReportFilters = { from: '', to: '', cycle: 'all', method: 'all' }

function timestampToMillis(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis()
  }
  return null
}

function ReportsContent() {
  const { t } = useI18n()
  const locale = useLocale()
  const { groupId, group, members, cycles, isReadOnly, isMemberView } = useGroupWorkspace()
  const [rows, setRows] = useState<PaymentLedgerRecord[]>([])
  const [memberIds, setMemberIds] = useState<Set<string> | null>(isMemberView ? new Set() : null)
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [selected, setSelected] = useState<PaymentLedgerRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const ids = isMemberView ? (await fetchMyMemberships()).filter((entry) => entry.data.groupId === groupId).map((entry) => entry.data.membershipId) : undefined
    const records = await fetchGroupPaymentLedger(groupId, ids, cycles.map(({ id }) => id))
    setMemberIds(ids ? new Set(ids) : null)
    setRows(records)
    setLoading(false)
  }, [cycles, groupId, isMemberView])

  useEffect(() => { void reload() }, [reload])

  const nameById = useMemo(() => new Map(members.map(({ id, data }) => [id, data.displayName])), [members])
  const entries = useMemo<ReportEntry[]>(() => {
    const paymentEntries = rows.map<ReportEntry>((payment) => ({
      kind: 'payment',
      cycleNumber: payment.cycleNumber,
      membershipId: payment.membershipId,
      amountMinor: payment.amountMinor,
      paidAtMs: payment.paidAtMs,
      payment,
    }))
    const payoutEntries = cycles.flatMap<ReportEntry>(({ id, data }) => {
      if (data.payout.status !== 'paid' || !data.recipientMembershipId) return []
      if (memberIds && !memberIds.has(data.recipientMembershipId)) return []
      return [{
        kind: 'payout',
        cycleNumber: Number(id),
        membershipId: data.recipientMembershipId,
        amountMinor: data.payout.amountMinor,
        paidAtMs: timestampToMillis(data.payout.paidAt),
      }]
    })
    return [...paymentEntries, ...payoutEntries]
      .sort((a, b) => (b.paidAtMs ?? 0) - (a.paidAtMs ?? 0))
  }, [cycles, memberIds, rows])
  const visible = useMemo(() => filterPaymentsByRange(entries, filters.from, filters.to).filter((entry) => {
    if (filters.cycle !== 'all' && String(entry.cycleNumber) !== filters.cycle) return false
    if (filters.method !== 'all' && (entry.kind === 'payout' || entry.payment?.method !== filters.method)) return false
    return true
  }), [entries, filters])
  const total = visible.filter((entry) => entry.kind === 'payment' && entry.payment?.status === 'paid').reduce((sum, entry) => sum + entry.amountMinor, 0)
  const payoutTotal = visible.filter((entry) => entry.kind === 'payout').reduce((sum, entry) => sum + entry.amountMinor, 0)
  const hasDateFilter = Boolean(filters.from || filters.to)
  const cycleOptions = useMemo(() => [
    { value: 'all', label: t('workspace.allCycles') },
    ...Array.from(new Set(entries.map((entry) => entry.cycleNumber)))
      .sort((a, b) => a - b)
      .map((number) => ({ value: String(number), label: formatCycleName(plannedDateForCycle(group, number), group.frequency, locale, t) })),
  ], [entries, group, locale, t])

  return (
    <>
      <div className="flex items-center gap-2"><Receipt size={22} className="text-accent-strong dark:text-accent" /><h1 className="text-lg font-bold">{t('workspace.reports')}</h1></div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{t('payments.total')}: <strong className="font-semibold tabular-nums text-ink">{formatMinor(total)}</strong></span>
        <span>{t('payments.payouts')}: <strong className="font-semibold tabular-nums text-ink">{formatMinor(payoutTotal)}</strong></span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Dropdown value={filters.cycle} onChange={(cycle) => setFilters((current) => ({ ...current, cycle }))} ariaLabel={t('workspace.cycleFilter')} compact containerClassName="!mt-0" className="!mt-0 h-12" options={cycleOptions} />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:contents">
          <Dropdown value={filters.method} onChange={(method) => setFilters((current) => ({ ...current, method }))} ariaLabel={t('workspace.methodFilter')} compact containerClassName="!mt-0" className="!mt-0 h-12" options={[{ value: 'all', label: t('workspace.allMethods') }, { value: 'cash', label: t('dash.methodCash') }, { value: 'upi', label: t('dash.methodUpi') }, { value: 'bank_transfer', label: t('dash.methodBank') }, { value: 'other', label: t('dash.methodOther') }]} />
          <Button variant="secondary" onClick={() => setDateFilterOpen(true)} className="h-12 self-start px-3 py-0 text-sm" aria-label={t('workspace.dateFilter')}>
            <CalendarBlank size={17} weight="bold" />
            <span className="hidden sm:inline">{t('workspace.dateFilter')}</span>
            {hasDateFilter && <span aria-hidden className="size-2 rounded-full bg-accent" />}
          </Button>
        </div>
      </div>
      {loading ? <div className="mt-5 rounded-2xl bg-sunken p-8 text-center text-sm text-muted">{t('common.loading')}</div> : visible.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{t('payments.empty')}</div> : <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface px-4">{visible.map((entry, index) => {
        const name = nameById.get(entry.membershipId) ?? t('memberView.aMember')
        if (entry.kind === 'payout') return <li key={`payout-${entry.cycleNumber}`} className="flex items-start gap-3 py-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="min-w-0 truncate text-sm font-semibold">{name}</p><Chip tone="neutral">{t('payments.payout')}</Chip></div><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted"><HandCoins size={13} weight="bold" />{t('payments.payout')}<span aria-hidden>·</span>{formatCycleName(plannedDateForCycle(group, entry.cycleNumber), group.frequency, locale, t)}{entry.paidAtMs && <><span aria-hidden>·</span><span className="whitespace-nowrap">{formatDate(entry.paidAtMs, locale)}</span></>}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold tabular-nums">{formatMinor(entry.amountMinor)}</span></div></li>
        const row = entry.payment
        if (!row) return null
        return <li key={`${row.cycleNumber}-${row.membershipId}-${row.eventId ?? index}`} className="flex items-start gap-3 py-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="min-w-0 truncate text-sm font-semibold">{name}</p><Chip tone={row.status === 'paid' ? 'paid' : 'neutral'}>{row.status === 'paid' ? t('status.paid') : t('workspace.reversed')}</Chip></div><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">{row.method && <PaymentMethodIcon method={row.method} size={12} weight="bold" />}{row.method ? methodLabel(row.method, t) : t('workspace.reversed')}<span aria-hidden>·</span>{formatCycleName(plannedDateForCycle(group, row.cycleNumber), group.frequency, locale, t)}{row.paidAtMs && <><span aria-hidden>·</span><span className="whitespace-nowrap">{formatDate(row.paidAtMs, locale)}</span></>}</p>{row.reason && <p className="mt-0.5 truncate text-xs text-faint">{row.reason}</p>}</div><div className="flex shrink-0 items-center gap-2"><span className="text-sm font-semibold tabular-nums">{formatMinor(row.amountMinor)}</span>{!isReadOnly && row.status === 'paid' && <button type="button" onClick={() => setSelected(row)} className="rounded-full p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={t('workspace.editPayment')}><PencilSimple size={16} weight="bold" /></button>}</div></li>
      })}</ul>}
      {dateFilterOpen && <ReportDateFilterSheet from={filters.from} to={filters.to} onClose={() => setDateFilterOpen(false)} onApply={(from, to) => { setFilters((current) => ({ ...current, from, to })); setDateFilterOpen(false) }} />}
      {selected && <PaymentCorrectionSheet groupId={groupId} row={selected} name={nameById.get(selected.membershipId) ?? t('memberView.aMember')} onClose={() => setSelected(null)} onDone={() => { setSelected(null); void reload() }} />}
    </>
  )
}

function PaymentCorrectionSheet({ groupId, row, name, onClose, onDone }: { groupId: string; row: PaymentLedgerRecord; name: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [method, setMethod] = useState<PaymentMethod>(row.method ?? 'cash')
  const [referenceNo, setReferenceNo] = useState(row.referenceNo ?? '')
  const [note, setNote] = useState(row.note ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useBodyLock(true)

  async function edit() {
    if (!reason.trim()) return setError(t('workspace.reasonRequired'))
    setBusy(true); setError(null)
    try { await callEditPayment({ groupId, cycleNumber: row.cycleNumber, membershipId: row.membershipId, method, referenceNo: referenceNo || undefined, note: note || undefined, reason }); onDone() } catch { setError(t('workspace.correctionError')); setBusy(false) }
  }

  async function reverse() {
    if (!reason.trim()) return setError(t('workspace.reasonRequired'))
    if (!window.confirm(t('workspace.reverseWarning'))) return
    setBusy(true); setError(null)
    try { await callReversePayment({ groupId, cycleNumber: row.cycleNumber, membershipId: row.membershipId, reason }); onDone() } catch { setError(t('workspace.correctionError')); setBusy(false) }
  }

  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && onClose()}><div className="w-full max-w-lg space-y-4 rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">{t('workspace.editPayment')}</h2><p className="text-sm text-muted">{name} · {formatMinor(row.amountMinor)}</p></div><button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken"><X size={20} weight="bold" /></button></div>{error && <ErrorNote>{error}</ErrorNote>}<Field label={t('dash.paymentMethod')}><Dropdown value={method} onChange={setMethod} options={[{ value: 'cash', label: t('dash.methodCash') }, { value: 'upi', label: t('dash.methodUpi') }, { value: 'bank_transfer', label: t('dash.methodBank') }, { value: 'other', label: t('dash.methodOther') }]} /></Field><Field label={t('dash.refNumber')}><Input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} /></Field><Field label={t('dash.note')}><Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></Field><Field label={t('workspace.correctionReason')}><Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></Field><div className="flex gap-2"><Button variant="secondary" onClick={() => void edit()} disabled={busy} className="flex-1">{t('workspace.saveCorrection')}</Button><Button variant="ghost" onClick={() => void reverse()} disabled={busy} className="flex-1 text-danger">{t('workspace.reversePayment')}</Button></div></div></div>
}
