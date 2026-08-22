import { useEffect, useState } from 'react'
import { Trophy, CalendarCheck } from '@phosphor-icons/react'
import {
  fetchBoard,
  fetchCycle,
  fetchGroup,
  fetchMyMemberships,
} from '@/lib/api'
import { auth } from '@/lib/firebase'
import { formatMinor } from '@shared'
import type { BoardEntry, CycleDoc, GroupDoc } from '@shared'
import { Chip, Page, PageHeader, Skeleton } from '@/components/ui'
import { useT } from '@/i18n'
import LanguageToggle from '@/components/LanguageToggle'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function MemberGroupView({ groupId }: { groupId: string }) {
  const t = useT()
  const [group, setGroup] = useState<{ id: string; data: GroupDoc } | null>(null)
  const [cycle, setCycle] = useState<CycleDoc | null>(null)
  const [board, setBoard] = useState<BoardEntry[] | null>(null)
  const [myStatus, setMyStatus] = useState<'pending' | 'paid' | 'overdue' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const uid = auth.currentUser?.uid ?? null
      const g = await fetchGroup(groupId)
      if (cancelled) return
      setGroup(g)

      // My payment status comes from my membership mirror.
      if (uid) {
        const mirrors = await fetchMyMemberships()
        if (cancelled) return
        const mine = mirrors.filter((m) => m.data.groupId === groupId)
        if (mine.length > 0) setMyStatus(mine[0]!.data.myPaymentStatus ?? 'pending')
      }

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

  const g = group.data
  const overdue = cycle ? todayIso() > cycle.dueDate : false

  return (
    <Page>
      <PageHeader
        title={g.name}
        backTo="/groups"
        rightElement={<LanguageToggle />}
      />
      {g.description && <p className="-mt-3 mb-5 text-sm text-muted">{g.description}</p>}

      {/* Stats strip */}
      <dl className="grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface text-center">
        <Stat label={t('dash.statPerMonth')} value={formatMinor(g.monthlyAmountMinor, g.currency)} />
        <Stat label={t('dash.statMembers')} value={String(g.memberCount)} />
        <Stat label={t('dash.statMonth')} value={`${Math.max(g.currentCycleNumber, 0)} / ${g.durationMonths}`} />
      </dl>

      {/* Your payment */}
      {myStatus && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarCheck size={22} className="shrink-0 text-accent-strong dark:text-accent" />
              <div>
                <p className="text-sm font-semibold">{t('memberView.yourContribution')}</p>
                <p className="text-xs text-muted">
                  {cycle
                    ? t('memberView.dueOn', { date: cycle.dueDate })
                    : t('memberView.fromStartDate', { date: g.startDate })}
                </p>
              </div>
            </div>
            <Chip tone={overdue && myStatus !== 'paid' ? 'overdue' : myStatus === 'paid' ? 'paid' : 'pending'}>
              {myStatus === 'paid'
                ? t('status.paid')
                : overdue
                  ? t('status.overdue')
                  : t('status.pending')}
            </Chip>
          </div>
          <p className="mt-3 text-sm text-muted">
            {t('memberView.payAdminNote')}
          </p>
        </div>
      )}

      {/* Recipient banner */}
      {cycle?.recipientMembershipId && board && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-accent-soft p-4">
          <Trophy size={22} className="shrink-0 text-accent-strong dark:text-accent" />
          <p className="text-sm font-semibold text-accent-strong dark:text-accent">
            {t('memberView.recipientBanner', {
              name:
                board.find((e) => e.membershipId === cycle.recipientMembershipId)?.name ??
                t('memberView.aMember'),
              amount: formatMinor(
                cycle.payout.amountMinor || g.monthlyAmountMinor * Math.max(g.memberCount, 1),
                g.currency,
              ),
            })}
          </p>
        </div>
      )}

      {/* Board — read-only */}
      {board && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">{t('memberView.thisMonthPayments')}</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            {board.map((entry) => (
              <li key={entry.membershipId} className="flex items-center justify-between py-3">
                <span className="truncate text-sm font-medium">{entry.name}</span>
                <Chip tone={entry.status === 'paid' ? 'paid' : 'pending'}>
                  {entry.status === 'paid' ? t('status.paid') : t('status.pending')}
                </Chip>
              </li>
            ))}
          </ul>
        </section>
      )}
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

