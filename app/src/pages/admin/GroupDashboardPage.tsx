import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  WhatsappLogo,
  X,
  Bell,
  Trophy,
  HandCoins,
  Money,
  QrCode,
  Bank,
  DotsThreeOutline,
} from '@phosphor-icons/react'
import {
  callAddMember,
  callMarkPaid,
  callSendReminder,
  callStartNextCycle,
  callConfirmSelection,
  callRecordPayout,
  fetchBoard,
  fetchCycle,
  fetchCycles,
  fetchGroup,
  fetchGroupMembers,
} from '@/lib/api'
import { whatsappLink } from '@/lib/whatsapp'
import { formatMinor, toMinor, userMessage } from '@shared'
import type { BoardEntry, CycleDoc, GroupDoc, GroupMemberDoc, PaymentMethod } from '@shared'
import MemberGroupView from '@/pages/member/MemberGroupView'
import { auth } from '@/lib/firebase'
import {
  Button,
  Chip,
  ErrorNote,
  Field,
  Input,
  Page,
  PageHeader,
  PhoneInput,
  Skeleton,
  Textarea,
} from '@/components/ui'
import { useI18n, useT } from '@/i18n'
import { useAuth } from '@/lib/useAuth'
import { useViewMode } from '@/lib/useViewMode'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function GroupDashboardPage() {
  const { groupId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const { viewMode } = useViewMode()
  const { t } = useI18n()
  const [group, setGroup] = useState<{ id: string; data: GroupDoc } | null>(null)
  const [members, setMembers] = useState<{ id: string; data: GroupMemberDoc }[]>([])
  const [cycle, setCycle] = useState<CycleDoc | null>(null)
  const [board, setBoard] = useState<BoardEntry[] | null>(null)
  const [cycles, setCycles] = useState<{ id: string; data: CycleDoc }[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [g, m, cy] = await Promise.all([
      fetchGroup(groupId),
      fetchGroupMembers(groupId),
      fetchCycles(groupId),
    ])
    setGroup(g)
    setMembers(m.sort((a, b) => a.data.slotNo - b.data.slotNo))
    setCycles(cy)
    if (g && g.data.currentCycleNumber > 0) {
      const n = g.data.currentCycleNumber
      const [c, b] = await Promise.all([fetchCycle(groupId, n), fetchBoard(groupId, n)])
      setCycle(c)
      setBoard(b)
    } else {
      setCycle(null)
      setBoard(null)
    }
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [g, m, cy] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMembers(groupId),
        fetchCycles(groupId),
      ])
      if (cancelled) return
      setGroup(g)
      setMembers(m.sort((a, b) => a.data.slotNo - b.data.slotNo))
      setCycles(cy)
      if (g && g.data.currentCycleNumber > 0) {
        const n = g.data.currentCycleNumber
        const [c, b] = await Promise.all([fetchCycle(groupId, n), fetchBoard(groupId, n)])
        if (cancelled) return
        setCycle(c)
        setBoard(b)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])

  if (loading || !group) {
    return (
      <Page>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-14 w-full" />
        <Skeleton className="mt-6 h-64 w-full" />
      </Page>
    )
  }

  // Members get a read-only view; admins get the management dashboard unless view=member is explicitly requested
  const forceMemberView = searchParams.get('view') === 'member' || (isAdmin && viewMode === 'member')
  if (forceMemberView || (group.data.adminUid !== auth.currentUser?.uid && !isAdmin)) {
    return <MemberGroupView groupId={groupId} />
  }

  const g = group.data

  return (
    <Page>
      <PageHeader
        title={g.name}
        backTo="/groups"
      />

      {/* Stats strip */}
      <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface text-center">
        <Stat label={t('dash.statPerMonth')} value={formatMinor(g.monthlyAmountMinor, g.currency)} />
        <Stat label={t('dash.statMembers')} value={String(g.memberCount)} />
        <Stat label={t('dash.statMonth')} value={`${Math.max(g.currentCycleNumber, 0)} / ${g.durationMonths}`} />
      </dl>

      <CycleSection
        groupId={groupId}
        group={g}
        cycle={cycle}
        board={board}
        members={members}
        onChanged={reload}
      />

      <HistorySection cycles={cycles} members={members} currency={g.currency} />

      {/* Roster */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">
          {t('dash.rosterHeading', { count: g.memberCount })}
        </h2>
        {members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="text-sm text-muted">{t('dash.rosterEmpty')}</p>
            <p className="mt-1 text-xs text-faint">
              {t('dash.rosterEmptyHint')}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            {members.map(({ id, data: m }) => (
              <li key={id} className="flex items-center justify-between py-3">
                <span className="truncate text-sm font-medium">{m.displayName}</span>
                {m.status === 'inactive' ? (
                  <Chip tone="neutral">{t('common.inactive')}</Chip>
                ) : (
                  <span className="text-xs text-faint">
                    {t('common.slot', { slotNo: m.slotNo })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddMemberSection groupId={groupId} onAdded={reload} />
    </Page>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-4">
      <dt className="text-[11px] uppercase tracking-wide text-faint">{label}</dt>
      <dd className="mt-1 truncate text-sm font-bold tabular-nums">{value}</dd>
    </div>
  )
}

function CycleSection({
  groupId,
  group,
  cycle,
  board,
  members,
  onChanged,
}: {
  groupId: string
  group: GroupDoc
  cycle: CycleDoc | null
  board: BoardEntry[] | null
  members: { id: string; data: GroupMemberDoc }[]
  onChanged: () => void
}) {
  const { t, lang } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState<BoardEntry | null>(null)
  const [reminding, setReminding] = useState(false)

  async function handleStart() {
    setError(null)
    setBusy(true)
    try {
      await callStartNextCycle(groupId)
      onChanged()
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemindAll() {
    setError(null)
    setReminding(true)
    try {
      await callSendReminder({ groupId })
    } catch (err) {
      setError(errMessage(err, lang))
    } finally {
      setReminding(false)
    }
  }

  // No month started yet
  if (!cycle || !board) {
    const allMonthsDone = group.currentCycleNumber >= group.durationMonths
    return (
      <section className="mt-6">
        {error && <ErrorNote>{error}</ErrorNote>}
        {allMonthsDone ? (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center">
            <p className="font-semibold">{t('dash.allMonthsDoneTitle')}</p>
            <p className="mt-1 text-sm text-muted">{t('dash.allMonthsDoneDesc')}</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center">
            <p className="font-semibold">{t('dash.readyStartTitle')}</p>
            <p className="mx-auto mt-1 max-w-[32ch] text-sm text-muted">
              {t('dash.readyStartDesc')}
            </p>
            <Button onClick={handleStart} disabled={busy} className="mt-5">
              {busy ? t('dash.starting') : t('dash.startMonth', { month: 1 })}
            </Button>
          </div>
        )}
      </section>
    )
  }

  const overdue = todayIso() > cycle.dueDate
  const paidCount = board.filter((e) => e.status === 'paid').length
  const progress = group.memberCount > 0 ? (paidCount / group.memberCount) * 100 : 0

  return (
    <section className="mt-6">
      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Month header */}
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">
            {t('dash.monthHeading', { current: cycle.monthNumber })}
            <span className="ml-1.5 text-sm font-medium text-muted">
              {t('dash.ofTotalMonths', { total: group.durationMonths })}
            </span>
          </h2>
          <Chip tone={overdue ? 'overdue' : 'pending'}>
            {overdue
              ? t('dash.overdueWasDue', { date: cycle.dueDate })
              : t('dash.dueOn', { date: cycle.dueDate })}
          </Chip>
        </div>

        {/* Progress */}
        <div className="mt-3 flex items-baseline justify-between text-sm">
          <span className="text-muted">
            {t('dash.progressPaid', { paid: paidCount, total: group.memberCount })}
          </span>
          <span className="font-semibold tabular-nums">
            {formatMinor(group.collectedAmountMinor, group.currency)}{' '}
            <span className="font-normal text-faint">
              {t('dash.ofTotalPool', {
                totalPool: formatMinor(group.monthlyAmountMinor * group.memberCount, group.currency),
              })}
            </span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {board.some((e) => e.status === 'pending') && (
          <Button
            variant="secondary"
            onClick={handleRemindAll}
            disabled={reminding}
            className="mt-4 w-full"
          >
            <Bell size={16} weight="fill" />
            {reminding ? t('common.sending') : t('dash.remindUnpaid')}
          </Button>
        )}
      </div>

      {/* Payment board */}
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
        {board.map((entry) => {
          const isOverdue = entry.status === 'pending' && overdue
          return (
            <li key={entry.membershipId}>
              <button
                type="button"
                disabled={entry.status === 'paid'}
                onClick={() => setMarking(entry)}
                className="flex w-full items-center justify-between py-3 text-left disabled:cursor-default"
              >
                <span className="truncate text-sm font-medium">{entry.name}</span>
                {entry.status === 'paid' ? (
                  <Chip tone="paid">
                    <span className="inline-flex items-center gap-1.5">
                      {entry.method && (
                        <PaymentMethodIcon method={entry.method} size={13} weight="bold" />
                      )}
                      <span>
                        {entry.method
                          ? t('dash.paidWithMethod', { method: methodLabel(entry.method, t) })
                          : t('status.paid')}
                      </span>
                    </span>
                  </Chip>
                ) : (
                  <span className="flex items-center gap-2">
                    <Chip tone={isOverdue ? 'overdue' : 'pending'}>
                      {isOverdue ? t('status.overdue') : t('status.pending')}
                    </Chip>
                    <span className="text-faint" aria-hidden>
                      ›
                    </span>
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {marking && (
        <MarkPaidSheet
          groupId={groupId}
          group={group}
          entry={marking}
          onClose={() => setMarking(null)}
          onDone={() => {
            setMarking(null)
            onChanged()
          }}
        />
      )}

      <SelectionSection
        groupId={groupId}
        group={group}
        cycle={cycle}
        board={board}
        members={members}
        onChanged={onChanged}
        onError={setError}
      />
    </section>
  )
}

export function PaymentMethodIcon({
  method,
  size = 14,
  weight = 'regular',
  className = '',
}: {
  method: PaymentMethod
  size?: number
  weight?: 'regular' | 'bold' | 'fill'
  className?: string
}) {
  switch (method) {
    case 'cash':
      return <Money size={size} weight={weight} className={className} />
    case 'upi':
      return <QrCode size={size} weight={weight} className={className} />
    case 'bank_transfer':
      return <Bank size={size} weight={weight} className={className} />
    case 'other':
      return <DotsThreeOutline size={size} weight={weight} className={className} />
  }
}

export function methodLabel(method: PaymentMethod, t: (key: any) => string): string {
  switch (method) {
    case 'cash':
      return t('dash.methodCash')
    case 'upi':
      return t('dash.methodUpi')
    case 'bank_transfer':
      return t('dash.methodBank')
    case 'other':
      return t('dash.methodOther')
  }
}

function MarkPaidSheet({
  groupId,
  group,
  entry,
  onClose,
  onDone,
}: {
  groupId: string
  group: GroupDoc
  entry: BoardEntry
  onClose: () => void
  onDone: () => void
}) {
  const { t, lang } = useI18n()
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [referenceNo, setReferenceNo] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await callMarkPaid({
        groupId,
        membershipId: entry.membershipId,
        method,
        referenceNo: referenceNo || undefined,
        note: note || undefined,
      })
      onDone()
    } catch (err) {
      setError(errMessage(err, lang))
      setBusy(false)
    }
  }

  const methodOptions: {
    value: PaymentMethod
    label: string
    Icon: typeof Money
  }[] = [
    { value: 'cash', label: t('dash.methodCash'), Icon: Money },
    { value: 'upi', label: t('dash.methodUpi'), Icon: QrCode },
    { value: 'bank_transfer', label: t('dash.methodBank'), Icon: Bank },
    { value: 'other', label: t('dash.methodOther'), Icon: DotsThreeOutline },
  ]

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-10 flex items-end bg-black/40 sm:items-center sm:justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg space-y-5 rounded-t-2xl bg-surface p-6 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {t('dash.markPaidTitle', { name: entry.name })}
            </h2>
            <p className="text-sm text-muted">
              {formatMinor(group.monthlyAmountMinor, group.currency)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-full p-1 text-muted hover:text-ink"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Field label={t('dash.paymentMethod')}>
          <div
            role="radiogroup"
            aria-label={t('dash.paymentMethod')}
            className="mt-2 grid grid-cols-2 gap-2"
          >
            {methodOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={method === value}
                onClick={() => setMethod(value)}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition-colors ${
                  method === value
                    ? 'border-accent bg-accent-soft text-accent-strong dark:border-accent dark:text-accent font-semibold'
                    : 'border-line bg-surface text-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                <Icon size={18} weight={method === value ? 'bold' : 'regular'} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('dash.refNumber')} hint={t('dash.refNumberHint')}>
          <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </Field>
        <Field label={t('dash.note')} hint={t('common.optional')}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t('common.saving') : t('dash.recordPayment')}
        </Button>
      </form>
    </div>
  )
}

function errMessage(err: unknown, lang: 'en' | 'ta' = 'en'): string {
  const code = (err as { code?: string })?.code ?? ''
  switch (code) {
    case 'functions/failed-precondition':
      return (
        (err as { message?: string }).message?.match(/"([^"]+)"/)?.[1] ??
        userMessage('invalid_transition', lang)
      )
    case 'functions/already-exists':
      return userMessage('already_exists', lang)
    case 'functions/already-selected':
      return userMessage('already_selected', lang)
    case 'functions/not-eligible':
      return userMessage('not_eligible', lang)
    default:
      return userMessage('internal', lang)
  }
}

function securePick<T>(items: T[]): T {
  const rand = new Uint32Array(1)
  crypto.getRandomValues(rand)
  return items[rand[0] % items.length]!
}

function PayoutSection({
  groupId,
  recipientName,
  poolAmountMinor,
  currency,
  onChanged,
  onError,
}: {
  groupId: string
  recipientName: string
  poolAmountMinor: number
  currency: string
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(String(poolAmountMinor / 100))
  const [busy, setBusy] = useState(false)

  async function handleRecord() {
    setBusy(true)
    try {
      await callRecordPayout({ groupId, amountMinor: toMinor(Number(amount)) })
      setOpen(false)
      onChanged()
    } catch (err) {
      onError(errMessage(err, lang))
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <HandCoins size={22} className="shrink-0 text-accent-strong dark:text-accent" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {t('dash.payoutNotice', {
                name: recipientName,
                amount: formatMinor(poolAmountMinor, currency),
              })}
            </p>
            <p className="text-xs text-muted">{t('dash.payoutHint')}</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="mt-4 w-full">
          {t('dash.recordPayout')}
        </Button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-end bg-black/40 sm:items-center sm:justify-center"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg space-y-5 rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
            <h2 className="text-lg font-bold">{t('dash.recordPayoutTitle')}</h2>
            <Field label={t('dash.payoutAmountLabel')} hint={t('dash.payoutAmountHint')}>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <p className="-mt-2 text-xs text-muted">
              {t('dash.payoutClosesMonth')}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleRecord} disabled={busy} className="flex-1">
                {busy ? t('dash.recording') : t('dash.confirmPayout')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function HistorySection({
  cycles,
  members,
  currency,
}: {
  cycles: { id: string; data: CycleDoc }[]
  members: { id: string; data: GroupMemberDoc }[]
  currency: string
}) {
  const t = useT()
  const done = cycles
    .filter((c) => c.data.status === 'complete')
    .sort((a, b) => Number(a.id) - Number(b.id))
  if (done.length === 0) return null

  const nameById = new Map(members.map(({ id, data }) => [id, data.displayName]))

  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-semibold text-muted">{t('dash.pastMonths')}</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
        {done.map(({ id, data }) => (
          <li key={id} className="flex items-center justify-between py-3">
            <span className="text-sm text-muted">
              {t('dash.pastMonthLabel', { month: data.monthNumber })}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="max-w-[10rem] truncate text-sm font-medium">
                {nameById.get(data.recipientMembershipId ?? '') ?? '—'}
              </span>
              <span className="text-sm tabular-nums text-faint">
                {formatMinor(data.payout.amountMinor, currency)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SelectionSection({
  groupId,
  group,
  cycle,
  board,
  members,
  onChanged,
  onError,
}: {
  groupId: string
  group: GroupDoc
  cycle: CycleDoc
  board: BoardEntry[]
  members: { id: string; data: GroupMemberDoc }[]
  onChanged: () => void
  onError: (msg: string) => void
}) {
  const { t, lang } = useI18n()
  const [picking, setPicking] = useState(false)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [winner, setWinner] = useState<BoardEntry | null>(null)
  const [busy, setBusy] = useState(false)

  const memberById = new Map(members.map(({ id, data }) => [id, data]))

  // Eligibility: active slot, never selected before, paid this month if required.
  const eligible = board.filter((e) => {
    const m = memberById.get(e.membershipId)
    if (!m || m.status !== 'active' || m.selectedInCycle != null) return false
    if (group.requirePaidToWin && e.status !== 'paid') return false
    return true
  })

  // Already decided — payout flow or completed banner.
  if (cycle.recipientMembershipId) {
    const recipient = board.find((e) => e.membershipId === cycle.recipientMembershipId)
    const pool = group.monthlyAmountMinor * Math.max(group.memberCount, 1)

    if (cycle.status === 'recipient_selected') {
      return (
        <PayoutSection
          groupId={groupId}
          recipientName={recipient?.name ?? t('memberView.aMember')}
          poolAmountMinor={pool}
          currency={group.currency}
          onChanged={onChanged}
          onError={onError}
        />
      )
    }

    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
        <Trophy size={22} className="shrink-0 text-accent-strong dark:text-accent" />
        <div>
          <p className="text-sm font-semibold text-accent-strong dark:text-accent">
            {t('dash.monthCompleteBanner', {
              month: cycle.monthNumber,
              amount: formatMinor(cycle.payout.amountMinor, group.currency),
              name: recipient?.name ?? t('memberView.aMember'),
            })}
          </p>
          <p className="text-xs text-muted">
            {cycle.monthNumber >= group.durationMonths
              ? t('dash.finalMonthDoneBanner')
              : t('dash.readyNextMonthBanner')}
          </p>
        </div>
      </div>
    )
  }

  if (cycle.status !== 'payment_open' && cycle.status !== 'collection_complete') return null

  async function handleConfirm() {
    if (!winner) return
    setBusy(true)
    try {
      await callConfirmSelection({ groupId, membershipId: winner.membershipId })
      setWinner(null)
      onChanged()
    } catch (err) {
      onError(errMessage(err, lang))
      setWinner(null)
    } finally {
      setBusy(false)
    }
  }

  function startPick() {
    if (eligible.length === 0) return
    const w = securePick(eligible)
    setPicking(true)
    let ticks = 0
    const totalTicks = 18 + securePick([0, 1, 2, 3])
    const timer = setInterval(() => {
      ticks++
      if (ticks >= totalTicks) {
        clearInterval(timer)
        setHighlightId(w.membershipId)
        setTimeout(() => {
          setPicking(false)
          setWinner(w)
        }, 450)
      } else {
        setHighlightId(eligible[ticks % eligible.length]!.membershipId)
      }
    }, 90)
  }

  if (eligible.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center">
        <p className="text-sm font-semibold">{t('dash.noEligibleTitle')}</p>
        <p className="mt-1 text-xs text-muted">
          {group.requirePaidToWin && board.some((e) => e.status === 'pending')
            ? t('dash.noEligibleMustPay')
            : t('dash.noEligibleAllPicked')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-center">
        {picking ? (
          <ul aria-live="polite" className="divide-y divide-line">
            {eligible.map((e) => (
              <li
                key={e.membershipId}
                className={`py-2.5 text-sm font-medium transition-colors ${
                  highlightId === e.membershipId
                    ? 'rounded-xl bg-accent-soft text-accent-strong dark:text-accent'
                    : 'text-faint'
                }`}
              >
                {e.name}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="font-semibold">
              {cycle.monthNumber === group.durationMonths
                ? t('dash.finalMonth')
                : t('dash.pickRecipient')}
            </p>
            <p className="mx-auto mt-1 max-w-[34ch] text-sm text-muted">
              {t('dash.eligibleMembersCount', {
                type: group.requirePaidToWin ? t('dash.eligiblePaid') : t('dash.eligibleAll'),
                count: eligible.length,
                pool: formatMinor(
                  group.monthlyAmountMinor * Math.max(group.memberCount, 1),
                  group.currency,
                ),
              })}
            </p>
            <Button onClick={startPick} className="mt-4">
              {t('dash.pickRandomly')}
            </Button>
          </>
        )}
      </div>

      {winner && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-end bg-black/40 sm:items-center sm:justify-center"
          onClick={(e) => e.target === e.currentTarget && setWinner(null)}
        >
          <div className="w-full max-w-lg rounded-t-2xl bg-surface p-6 text-center sm:rounded-2xl">
            <Trophy size={28} className="mx-auto text-accent-strong dark:text-accent" weight="fill" />
            <h2 className="mt-3 text-lg font-bold">{winner.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {t('dash.winnerReceives', {
                amount: formatMinor(
                  group.monthlyAmountMinor * Math.max(group.memberCount, 1),
                  group.currency,
                ),
              })}
            </p>
            <div className="mt-5 flex gap-3">
              <Button variant="secondary" onClick={() => setWinner(null)} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleConfirm} disabled={busy} className="flex-1">
                {busy ? t('common.confirming') : t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AddMemberSection({
  groupId,
  onAdded,
}: {
  groupId: string
  onAdded: () => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ name: string; phone: string; password: string } | null>(
    null,
  )

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const fullPhone = `+91${phone}`
      const res = await callAddMember({ groupId, name, phone: fullPhone })
      setInvite({ name, phone: fullPhone, password: res.password })
      setName('')
      setPhone('')
      setOpen(false)
      onAdded()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <Button variant="secondary" onClick={() => setOpen(true)} className="mt-6 w-full">
          {t('dash.addMember')}
        </Button>
      )}

      {open && (
        <form
          onSubmit={handleAdd}
          className="mt-6 space-y-5 rounded-2xl border border-line bg-surface p-5"
        >
          <h2 className="font-semibold">{t('dash.addMember')}</h2>
          {error && <ErrorNote>{error}</ErrorNote>}
          <Field label={t('dash.memberName')}>
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t('dash.memberPhone')} hint={t('dash.memberPhoneHint')}>
            <PhoneInput
              value={phone}
              onChange={setPhone}
            />
          </Field>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false)
                setError(null)
              }}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={busy || phone.length !== 10} className="flex-1">
              {busy ? t('common.adding') : t('common.add')}
            </Button>
          </div>
        </form>
      )}

      {invite && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-10 flex items-end bg-black/40 sm:items-center sm:justify-center"
        >
          <div className="w-full max-w-lg rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-bold">
                {t('dash.memberAddedTitle', { name: invite.name })}
              </h2>
              <button
                onClick={() => setInvite(null)}
                aria-label={t('common.close')}
                className="rounded-full p-1 text-muted hover:text-ink"
              >
                <X size={18} weight="bold" />
              </button>
            </div>
            <p className="mt-1 text-sm text-muted">{t('dash.shareLoginDetails')}</p>
            <div className="mt-4 rounded-2xl bg-sunken p-4 text-center">
              <p className="text-[11px] uppercase tracking-wide text-faint">
                {t('dash.passwordLabel')}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{invite.password}</p>
            </div>
            <a
              href={whatsappLink(
                invite.phone,
                t('dash.whatsappInviteText', {
                  name: invite.name,
                  password: invite.password,
                }),
              )}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3 font-semibold text-[#06301b] transition-transform active:scale-[0.98]"
            >
              <WhatsappLogo size={20} weight="fill" />
              {t('dash.sendViaWhatsapp')}
            </a>
            <button
              onClick={() => setInvite(null)}
              className="mt-3 w-full py-2 text-center text-sm text-muted underline-offset-2 hover:text-ink hover:underline"
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
