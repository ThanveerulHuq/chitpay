import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, CalendarBlank, CurrencyInr, Gear } from '@phosphor-icons/react'
import { fetchMyGroups, fetchMyMemberships } from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { formatMinor } from '@shared'
import type { MembershipMirrorDoc } from '@shared'
import { Chip, Page, Skeleton, Button } from '@/components/ui'
import { useT } from '@/i18n'
import { useViewMode } from '@/lib/useViewMode'

type ListEntry =
  | { kind: 'admin'; id: string; name: string; amountMinor: number; currency: string; memberCount: number; cycleNumber: number; durationMonths: number }
  | { kind: 'member'; id: string; name: string; amountMinor: number; currency: string; myStatus: MembershipMirrorDoc['myPaymentStatus'] }

export default function GroupsListPage() {
  const t = useT()
  const { isAdmin } = useAuth()
  const { viewMode } = useViewMode()
  const [allEntries, setAllEntries] = useState<ListEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [adminGroups, memberships] = await Promise.all([
        fetchMyGroups(),
        fetchMyMemberships(),
      ])
      if (cancelled) return

      const adminEntries: ListEntry[] = adminGroups.map(({ id, data: g }) => ({
        kind: 'admin',
        id,
        name: g.name,
        amountMinor: g.monthlyAmountMinor,
        currency: g.currency,
        memberCount: g.memberCount,
        cycleNumber: g.currentCycleNumber,
        durationMonths: g.durationMonths,
      }))
      const memberEntries: ListEntry[] = memberships
        .map((m) => ({
          kind: 'member',
          id: m.data.groupId,
          name: m.data.groupName,
          amountMinor: m.data.monthlyAmountMinor,
          currency: m.data.currency,
          myStatus: m.data.myPaymentStatus,
        }))

      setAllEntries([...adminEntries, ...memberEntries])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const entries = allEntries.filter((e) => isAdmin ? e.kind === viewMode : e.kind === 'member')

  return (
    <Page>
      <header className="sticky top-0 z-30 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-line/50 bg-bg/90 px-4 py-3.5 backdrop-blur pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <img
            src="/brand/chitpay-app-icon-hands.png"
            alt=""
            className="size-8 rounded-xl object-contain shadow-xs"
          />
          <h1 className="text-2xl font-bold tracking-tight">ChitPay</h1>
        </div>
        <div className="flex items-center gap-2">
          {(!isAdmin || viewMode === 'admin') && (
            <Link
              to="/groups/new"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-transform active:scale-[0.98]"
            >
              <Plus size={16} weight="bold" />
              {t('groups.newGroup')}
            </Link>
          )}
          <Link
            to="/settings"
            aria-label={t('settings.title')}
            className="rounded-full p-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Gear size={20} />
          </Link>
        </div>
      </header>

      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:text-accent">
            <Users size={28} />
          </div>
          <p className="mt-4 font-semibold">{t('groups.emptyTitle')}</p>
          <p className="mt-1 max-w-[28ch] text-sm text-muted">
            {t('groups.emptyDesc')}
          </p>
          {(!isAdmin || viewMode === 'admin') && (
            <Link to="/groups/new" className="mt-5">
              <Button>{t('groups.createFirst')}</Button>
            </Link>
          )}
        </div>
      )}

      <AdminKpiStrip entries={entries} />

      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={`${entry.kind}-${entry.id}`}>
            <Link
              to={`/groups/${entry.id}${entry.kind === 'member' ? '?view=member' : ''}`}
              className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken active:scale-[0.99] motion-safe:transition-transform"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate font-semibold">{entry.name}</h2>
                <span className="shrink-0 text-sm text-muted">
                  {t('common.perMonth', { amount: formatMinor(entry.amountMinor, entry.currency) })}
                </span>
              </div>
              <div className="mt-2.5 flex items-center gap-3 text-xs text-muted">
                {entry.kind === 'admin' ? (
                  <>
                    <Chip tone="neutral">{t('common.admin')}</Chip>
                    <span className="inline-flex items-center gap-1">
                      <Users size={13} /> {entry.memberCount}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarBlank size={13} />
                      {Math.max(entry.cycleNumber, 0)}/{entry.durationMonths}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 font-medium text-ink">
                      <CurrencyInr size={13} weight="bold" />
                      {formatMinor(entry.amountMinor * entry.memberCount * Math.max(entry.cycleNumber, 0), entry.currency)}
                    </span>
                  </>
                ) : (
                  <Chip tone={entry.myStatus === 'paid' ? 'paid' : 'pending'}>
                    {entry.myStatus == null ? t('status.notStarted') : entry.myStatus === 'paid' ? t('status.paid') : t('status.paymentDue')}
                  </Chip>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  )
}

function AdminKpiStrip({ entries }: { entries: ListEntry[] }) {
  const t = useT()
  const adminEntries = entries.filter((e): e is Extract<ListEntry, { kind: 'admin' }> => e.kind === 'admin')
  if (adminEntries.length === 0) return null

  const members = adminEntries.reduce((sum, g) => sum + g.memberCount, 0)
  const monthlyPool = adminEntries.reduce(
    (sum, g) => sum + g.amountMinor * g.memberCount,
    0,
  )

  return (
    <dl className="mb-5 grid grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface text-center">
      <div className="px-2 py-3">
        <dt className="text-[11px] uppercase tracking-wide text-faint">{t('groups.kpiGroups')}</dt>
        <dd className="mt-0.5 text-sm font-bold tabular-nums">{adminEntries.length}</dd>
      </div>
      <div className="px-2 py-3">
        <dt className="text-[11px] uppercase tracking-wide text-faint">{t('groups.kpiMembers')}</dt>
        <dd className="mt-0.5 text-sm font-bold tabular-nums">{members}</dd>
      </div>
      <div className="px-2 py-3">
        <dt className="text-[11px] uppercase tracking-wide text-faint">{t('groups.kpiMonthlyPool')}</dt>
        <dd className="mt-0.5 truncate text-sm font-bold tabular-nums">
          {formatMinor(monthlyPool, adminEntries[0]!.currency)}
        </dd>
      </div>
    </dl>
  )
}

