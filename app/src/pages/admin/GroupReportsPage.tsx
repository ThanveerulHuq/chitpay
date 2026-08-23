import { useCallback, useEffect, useMemo, useState } from 'react'
import { PencilSimple, Receipt, X } from '@phosphor-icons/react'
import { callEditPayment, callReversePayment, fetchGroupPaymentLedger, fetchMyMemberships, type PaymentLedgerRecord } from '@/lib/api'
import { formatDate, formatMinor } from '@shared'
import type { GroupDoc, PaymentMethod } from '@shared'
import DateRangeFields from '@/components/DateRangeFields'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import { Button, Chip, ErrorNote, Field, Input, Select, Textarea } from '@/components/ui'
import { useI18n } from '@/i18n'
import { PaymentMethodIcon, methodLabel } from '@/pages/admin/GroupDashboardPage'
import { useLocale } from '@/lib/format'
import { useBodyLock } from '@/lib/useBodyLock'

export default function GroupReportsPage() {
  return <GroupShell><ReportsContent /></GroupShell>
}

function ReportsContent() {
  const { t } = useI18n()
  const locale = useLocale()
  const { groupId, group, members, isReadOnly } = useGroupWorkspace()
  const [rows, setRows] = useState<PaymentLedgerRecord[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<'all' | 'paid' | 'reversed'>('all')
  const [cycle, setCycle] = useState('all')
  const [method, setMethod] = useState<'all' | PaymentMethod>('all')
  const [selected, setSelected] = useState<PaymentLedgerRecord | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const ids = isReadOnly ? (await fetchMyMemberships()).filter((entry) => entry.data.groupId === groupId).map((entry) => entry.data.membershipId) : undefined
    const records = await fetchGroupPaymentLedger(groupId, ids)
    setRows(records)
    setLoading(false)
  }, [groupId, isReadOnly])

  useEffect(() => { void reload() }, [reload])

  const nameById = useMemo(() => new Map(members.map(({ id, data }) => [id, data.displayName])), [members])
  const visible = rows.filter((row) => {
    const day = row.paidAtMs ? new Date(row.paidAtMs).toISOString().slice(0, 10) : ''
    if (from && day < from) return false
    if (to && day > to) return false
    if (status !== 'all' && row.status !== status) return false
    if (cycle !== 'all' && row.cycleNumber !== Number(cycle)) return false
    if (method !== 'all' && row.method !== method) return false
    return true
  })
  const total = visible.filter((row) => row.status === 'paid').reduce((sum, row) => sum + row.amountMinor, 0)

  return (
    <>
      <div className="flex items-center gap-2"><Receipt size={22} className="text-accent-strong dark:text-accent" /><div><h1 className="text-lg font-bold">{t('workspace.reports')}</h1><p className="text-sm text-muted">{t('workspace.reportsHint')}</p></div></div>
      <DateRangeFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} aria-label={t('workspace.statusFilter')} className="mt-0 px-3 py-2 text-sm"><option value="all">{t('workspace.filterAll')}</option><option value="paid">{t('status.paid')}</option><option value="reversed">{t('workspace.reversed')}</option></Select>
        <Select value={cycle} onChange={(event) => setCycle(event.target.value)} aria-label={t('workspace.cycleFilter')} className="mt-0 px-3 py-2 text-sm"><option value="all">{t('workspace.allCycles')}</option>{Array.from(new Set(rows.map((row) => row.cycleNumber))).sort((a, b) => a - b).map((number) => <option key={number} value={number}>{t('workspace.month', { month: number })}</option>)}</Select>
        <Select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} aria-label={t('workspace.methodFilter')} className="mt-0 px-3 py-2 text-sm"><option value="all">{t('workspace.allMethods')}</option><option value="cash">{t('dash.methodCash')}</option><option value="upi">{t('dash.methodUpi')}</option><option value="bank_transfer">{t('dash.methodBank')}</option><option value="other">{t('dash.methodOther')}</option></Select>
      </div>
      <p className="mt-4 text-sm text-muted">{t('payments.total')}: <span className="font-semibold tabular-nums text-ink">{formatMinor(total, group.currency)}</span></p>
      {loading ? <div className="mt-5 rounded-2xl bg-sunken p-8 text-center text-sm text-muted">{t('common.loading')}</div> : visible.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{t('payments.empty')}</div> : <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface px-4">{visible.map((row, index) => <li key={`${row.cycleNumber}-${row.membershipId}-${row.eventId ?? index}`} className="flex items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{nameById.get(row.membershipId) ?? t('memberView.aMember')}</p><p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">{row.method && <PaymentMethodIcon method={row.method} size={12} weight="bold" />}{row.method ? methodLabel(row.method, t) : t('workspace.reversed')}<span aria-hidden>·</span>{t('workspace.month', { month: row.cycleNumber })}{row.paidAtMs && <><span aria-hidden>·</span>{formatDate(row.paidAtMs, locale)}</>}</p>{row.reason && <p className="mt-0.5 truncate text-xs text-faint">{row.reason}</p>}</div><div className="flex shrink-0 items-center gap-2"><Chip tone={row.status === 'paid' ? 'paid' : 'neutral'}>{row.status === 'paid' ? t('status.paid') : t('workspace.reversed')}</Chip><span className="text-sm font-semibold tabular-nums">{formatMinor(row.amountMinor, group.currency)}</span>{!isReadOnly && row.status === 'paid' && <button type="button" onClick={() => setSelected(row)} className="rounded-full p-2 text-muted hover:bg-sunken hover:text-ink" aria-label={t('workspace.editPayment')}><PencilSimple size={16} weight="bold" /></button>}</div></li>)}</ul>}
      {selected && <PaymentCorrectionSheet groupId={groupId} group={group} row={selected} name={nameById.get(selected.membershipId) ?? t('memberView.aMember')} onClose={() => setSelected(null)} onDone={() => { setSelected(null); void reload() }} />}
    </>
  )
}

function PaymentCorrectionSheet({ groupId, group, row, name, onClose, onDone }: { groupId: string; group: GroupDoc; row: PaymentLedgerRecord; name: string; onClose: () => void; onDone: () => void }) {
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

  return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && onClose()}><div className="w-full max-w-lg space-y-4 rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">{t('workspace.editPayment')}</h2><p className="text-sm text-muted">{name} · {formatMinor(row.amountMinor, group.currency)}</p></div><button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken"><X size={20} weight="bold" /></button></div>{error && <ErrorNote>{error}</ErrorNote>}<Field label={t('dash.paymentMethod')}><Select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}><option value="cash">{t('dash.methodCash')}</option><option value="upi">{t('dash.methodUpi')}</option><option value="bank_transfer">{t('dash.methodBank')}</option><option value="other">{t('dash.methodOther')}</option></Select></Field><Field label={t('dash.refNumber')}><Input value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} /></Field><Field label={t('dash.note')}><Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} /></Field><Field label={t('workspace.correctionReason')}><Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></Field><div className="flex gap-2"><Button variant="secondary" onClick={() => void edit()} disabled={busy} className="flex-1">{t('workspace.saveCorrection')}</Button><Button variant="ghost" onClick={() => void reverse()} disabled={busy} className="flex-1 text-danger">{t('workspace.reversePayment')}</Button></div></div></div>
}
