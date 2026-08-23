import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, CalendarBlank, Users } from '@phosphor-icons/react'
import type { GroupDoc } from '@shared'
import { ErrorNote, Page, PageHeader, Skeleton } from '@/components/ui'
import { fetchMyGroups } from '@/lib/api'
import { useT } from '@/i18n'
import { groupPath, settingsPath } from '@/lib/roleRoutes'

export default function ArchivedGroupsPage() {
  const t = useT()
  const [groups, setGroups] = useState<{ id: string; data: GroupDoc }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchMyGroups()
      .then((nextGroups) => {
        if (cancelled) return
        setGroups(nextGroups.filter(({ data }) => data.status === 'archived'))
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <Page>
      <PageHeader title={t('settings.archivedGroups')} backTo={settingsPath('admin')} />
      {error && <ErrorNote>{t('settings.archivedGroupsError')}</ErrorNote>}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="mt-12 rounded-2xl border border-dashed border-line p-8 text-center">
          <Archive size={30} className="mx-auto text-faint" />
          <p className="mt-3 font-semibold">{t('settings.noArchivedGroups')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map(({ id, data }) => (
            <li key={id}>
              <Link
                to={groupPath('admin', id)}
                className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-muted">
                    <Archive size={20} weight="bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{data.name}</p>
                    <p className="mt-1 flex items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><Users size={13} />{data.memberCount}</span>
                      <span className="inline-flex items-center gap-1"><CalendarBlank size={13} />{data.completedCycleCount}/{data.cycleCount}</span>
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
