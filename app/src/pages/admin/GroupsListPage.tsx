import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Ticket, Users, CalendarBlank, CurrencyInr, FileText, Gear } from '@phosphor-icons/react'
import { fetchMyGroups, fetchMyMemberships } from '@/lib/api'
import { contributionInPaise, formatMinor } from '@shared'
import { Chip, Page, Button } from '@/components/ui'
import { GroupsListLoadingScreen } from '@/components/LoadingScreens'
import { useT } from '@/i18n'
import { groupPath, groupsPath, providerReportsPath, settingsPath, useExperience } from '@/lib/roleRoutes'
import { useBranding } from '@/lib/brandingContext'

type ListEntry =
  | { kind: 'admin'; id: string; name: string; amountInPaise: number; memberCount: number; completedCycleCount: number; cycleCount: number }
  | { kind: 'member'; id: string; name: string; amountInPaise: number }

export default function GroupsListPage() {
  const t = useT()
  const experience = useExperience()
  const { iconSrc } = useBranding()
  const [allEntries, setAllEntries] = useState<ListEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [adminGroups, memberships] = await Promise.all([
        experience === 'admin' ? fetchMyGroups() : Promise.resolve([]),
        experience === 'member' ? fetchMyMemberships() : Promise.resolve([]),
      ])
      if (cancelled) return

      const adminEntries: ListEntry[] = adminGroups.filter(({ data: g }) => g.status !== 'archived').map(({ id, data: g }) => ({
        kind: 'admin',
        id,
        name: g.name,
        amountInPaise: contributionInPaise(g),
        memberCount: g.memberCount,
        completedCycleCount: g.completedCycleCount,
        cycleCount: g.cycleCount,
      }))
      const memberEntries: ListEntry[] = memberships
        .map((m) => ({
          kind: 'member',
          id: m.data.groupId,
          name: m.data.groupName,
          amountInPaise: contributionInPaise(m.data),
        }))

      setAllEntries([...adminEntries, ...memberEntries])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [experience])

  const entries = allEntries.filter((entry) => entry.kind === experience)

  if (loading) return <GroupsListLoadingScreen />

  return (
    <Page>
      <header className="sticky top-0 z-30 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-line/50 bg-bg/90 px-4 py-3.5 backdrop-blur pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <img
            src={iconSrc}
            alt=""
            className="size-8 rounded-xl object-contain shadow-xs"
          />
          <h1 className="text-2xl font-bold tracking-tight">ChitPay</h1>
        </div>
        <div className="flex items-center gap-2">
          {experience === 'admin' && (
            <Link
              to={providerReportsPath()}
              aria-label={t('workspace.reports')}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-sunken"
            >
              <FileText size={16} weight="bold" />
              <span className="hidden sm:inline">{t('workspace.reports')}</span>
            </Link>
          )}
          {experience === 'admin' && (
            <Link
              to={`${groupsPath(experience)}/new`}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition-transform active:scale-[0.98]"
            >
              <Plus size={16} weight="bold" />
              {t('groups.newGroup')}
            </Link>
          )}
          <Link
            to={settingsPath(experience)}
            aria-label={t('settings.title')}
            className="rounded-full p-2 text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <Gear size={20} />
          </Link>
        </div>
      </header>

      {entries.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong dark:text-accent">
            <Users size={28} />
          </div>
          <p className="mt-4 font-semibold">{t('groups.emptyTitle')}</p>
          <p className="mt-1 max-w-[28ch] text-sm text-muted">
            {t('groups.emptyDesc')}
          </p>
          {experience === 'admin' && (
            <Link to={`${groupsPath(experience)}/new`} className="mt-5">
              <Button>{t('groups.createFirst')}</Button>
            </Link>
          )}
        </div>
      )}

      <AdminKpiStrip entries={entries} />

      <ul className="space-y-3">
        {entries.map((entry) => (
          <li key={`${entry.kind}-${entry.id}`}>
            <div className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken">
              <Link to={groupPath(experience, entry.id)} className="block active:scale-[0.99] motion-safe:transition-transform">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="truncate font-semibold">{entry.name}</h2>
                  <span className="shrink-0 text-sm text-muted">
                    {formatMinor(entry.amountInPaise)}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {entry.kind === 'admin' ? (
                  <>
                    <Chip tone="neutral">{t('common.admin')}</Chip>
                    <span className="inline-flex items-center gap-1">
                      <Ticket size={13} /> {t('workspace.memberChitCount', { count: entry.memberCount })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarBlank size={13} />
                      {entry.completedCycleCount}/{entry.cycleCount}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 font-medium text-ink">
                      <CurrencyInr size={13} weight="bold" />
                      {formatMinor(entry.amountInPaise * entry.memberCount * entry.completedCycleCount)}
                    </span>
                  </>
                ) : (
                  <Chip tone="neutral">{t('workspace.members')}</Chip>
                )}
                </div>
              </Link>
            </div>
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

  const shares = adminEntries.reduce((sum, g) => sum + g.memberCount, 0)
  const monthlyPool = adminEntries.reduce(
    (sum, g) => sum + g.amountInPaise * g.memberCount,
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
        <dd className="mt-0.5 text-sm font-bold tabular-nums">{shares}</dd>
      </div>
      <div className="px-2 py-3">
        <dt className="text-[11px] uppercase tracking-wide text-faint">{t('groups.kpiMonthlyPool')}</dt>
        <dd className="mt-0.5 truncate text-sm font-bold tabular-nums">
          {formatMinor(monthlyPool)}
        </dd>
      </div>
    </dl>
  )
}
