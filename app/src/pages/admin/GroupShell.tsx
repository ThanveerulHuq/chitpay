import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArrowCounterClockwise, ArrowLeft, FileText } from '@phosphor-icons/react'
import { callArchiveGroup, callUnarchiveGroup, fetchCycles, fetchGroup, fetchGroupMembers } from '@/lib/api'
import { formatMinor } from '@shared'
import type { CycleDoc, GroupDoc, GroupMemberDoc } from '@shared'
import { Button, Page, Skeleton } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/useAuth'
import { useViewMode } from '@/lib/useViewMode'
import { useBodyLock } from '@/lib/useBodyLock'

export interface WorkspaceValue {
  groupId: string
  group: GroupDoc
  members: { id: string; data: GroupMemberDoc }[]
  cycles: { id: string; data: CycleDoc }[]
  reload: () => Promise<void>
  isReadOnly: boolean
  isMemberView: boolean
  isAdmin: boolean
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function useGroupWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useGroupWorkspace must be used inside GroupShell')
  return context
}

export default function GroupShell({ children }: { children: ReactNode }) {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { isAdmin } = useAuth()
  const { viewMode } = useViewMode()
  const { t } = useI18n()
  const [group, setGroup] = useState<{ id: string; data: GroupDoc } | null>(null)
  const [members, setMembers] = useState<{ id: string; data: GroupMemberDoc }[]>([])
  const [cycles, setCycles] = useState<{ id: string; data: CycleDoc }[]>([])
  const [loading, setLoading] = useState(true)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)

  const reload = useCallback(async () => {
    const [nextGroup, nextMembers, nextCycles] = await Promise.all([
      fetchGroup(groupId),
      fetchGroupMembers(groupId),
      fetchCycles(groupId),
    ])
    setGroup(nextGroup)
    setMembers(nextMembers.sort((a, b) => a.data.slotNo - b.data.slotNo))
    setCycles(nextCycles.sort((a, b) => Number(a.id) - Number(b.id)))
    setLoading(false)
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    void Promise.all([fetchGroup(groupId), fetchGroupMembers(groupId), fetchCycles(groupId)]).then(
      ([nextGroup, nextMembers, nextCycles]) => {
        if (cancelled) return
        setGroup(nextGroup)
        setMembers(nextMembers.sort((a, b) => a.data.slotNo - b.data.slotNo))
        setCycles(nextCycles.sort((a, b) => Number(a.id) - Number(b.id)))
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [groupId])

  const isMemberView = !isAdmin || searchParams.get('view') === 'member' || viewMode === 'member'
  const isArchived = group?.data.status === 'archived'
  const isReadOnly = isMemberView || isArchived
  const query = isMemberView ? '?view=member' : ''
  const isCycleDetail = /^\/groups\/[^/]+\/cycles\/[^/]+$/.test(location.pathname)
  const backTo = isCycleDetail ? `/groups/${groupId}/cycles${query}` : isArchived && !isMemberView ? '/settings' : `/groups${query}`
  const value = useMemo<WorkspaceValue | null>(
    () => group ? ({ groupId, group: group.data, members, cycles, reload, isReadOnly, isMemberView, isAdmin }) : null,
    [groupId, group, members, cycles, reload, isReadOnly, isMemberView, isAdmin],
  )

  async function archive() {
    setArchiveBusy(true)
    setArchiveError(null)
    try {
      await callArchiveGroup(groupId)
      setArchiveConfirmOpen(false)
      await reload()
    } catch {
      setArchiveError(t('workspace.archiveError'))
    } finally {
      setArchiveBusy(false)
    }
  }

  async function unarchive() {
    setArchiveBusy(true)
    setArchiveError(null)
    try {
      await callUnarchiveGroup(groupId)
      await reload()
    } catch {
      setArchiveError(t('workspace.unarchiveError'))
    } finally {
      setArchiveBusy(false)
    }
  }

  if (loading || !group || !value) {
    return (
      <Page>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="mt-3 h-12 w-full" />
        <Skeleton className="mt-5 h-64 w-full" />
      </Page>
    )
  }

  return (
    <WorkspaceContext.Provider value={value}>
      <Page>
        <header className="sticky top-0 z-30 -mx-4 border-b border-line/60 bg-bg/95 px-4 pb-0 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center justify-between gap-3 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                to={backTo}
                aria-label={t('common.back')}
                className="shrink-0 rounded-full p-1 text-muted hover:bg-sunken hover:text-ink"
              >
                <ArrowLeft size={20} weight="bold" />
              </Link>
              <h1 className="truncate text-xl font-bold tracking-tight">{group.data.name}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                to={`/groups/${groupId}/reports${query}`}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft dark:text-accent"
              >
                <FileText size={17} weight="bold" />
                {t('workspace.reports')}
              </Link>
            </div>
          </div>
          <p className="pb-2 text-sm text-muted">
            {t('workspace.contribution')}{' '}
            <strong className="font-bold text-ink tabular-nums">
              {formatMinor(group.data.contributionAmountMinor, group.data.currency)}
            </strong>
          </p>
          <nav aria-label={t('workspace.tabs')} className="grid grid-cols-2 gap-1 pt-2">
            <WorkspaceTab to={`/groups/${groupId}/members${query}`} active={location.pathname.endsWith('/members') || location.pathname === `/groups/${groupId}`}>
              {t('workspace.membersTab')}{' '}
              <span className="text-xs tabular-nums text-faint">{group.data.memberCount}</span>
            </WorkspaceTab>
            <WorkspaceTab to={`/groups/${groupId}/cycles${query}`} active={location.pathname.includes('/cycles')}>
              {t('workspace.cyclesTab')}{' '}
              <span className="text-xs tabular-nums text-faint">
                {group.data.completedCycleCount} / {group.data.cycleCount}
              </span>
            </WorkspaceTab>
          </nav>
        </header>
        {isAdmin && !isMemberView && isArchived && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-sunken p-3.5">
            <Archive size={20} weight="bold" className={isArchived ? 'shrink-0 text-muted' : 'shrink-0 text-faint'} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t('workspace.archivedTitle')}</p>
              <p className="text-xs text-muted">{t('workspace.archivedDesc')}</p>
              {archiveError && <p role="alert" className="mt-1 text-xs text-danger">{archiveError}</p>}
            </div>
            <button type="button" disabled={archiveBusy} onClick={() => void unarchive()} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent">
              <ArrowCounterClockwise size={16} weight="bold" />
              {t('workspace.unarchiveAction')}
            </button>
          </div>
        )}
        <div className="pt-4">{children}</div>
        {isAdmin && !isMemberView && !isArchived && (
          <section className="mt-12 text-center">
            {archiveError && <p role="alert" className="mb-3 text-sm text-danger">{archiveError}</p>}
            <button
              type="button"
              onClick={() => { setArchiveError(null); setArchiveConfirmOpen(true) }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-faint transition-colors hover:bg-sunken hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Archive size={16} />
              {t('workspace.archiveAction')}
            </button>
          </section>
        )}
      </Page>
      {archiveConfirmOpen && (
        <ArchiveConfirmationDialog
          busy={archiveBusy}
          error={archiveError}
          onCancel={() => { if (!archiveBusy) setArchiveConfirmOpen(false) }}
          onConfirm={() => void archive()}
        />
      )}
    </WorkspaceContext.Provider>
  )
}

function ArchiveConfirmationDialog({ busy, error, onCancel, onConfirm }: { busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useI18n()
  useBodyLock(true)

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="archive-confirm-title" aria-describedby="archive-confirm-description" className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-2xl">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-danger-soft text-danger">
          <Archive size={23} weight="bold" />
        </div>
        <h2 id="archive-confirm-title" className="mt-4 text-xl font-bold">{t('workspace.archiveModalTitle')}</h2>
        <p id="archive-confirm-description" className="mt-2 text-sm leading-6 text-muted">{t('workspace.archiveConfirm')}</p>
        {error && <p role="alert" className="mt-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} className="flex-1">{t('common.cancel')}</Button>
          <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex flex-1 items-center justify-center rounded-2xl bg-danger px-4 py-3 font-semibold text-white hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 dark:text-danger-soft">
            {busy ? t('common.saving') : t('workspace.confirmArchive')}
          </button>
        </div>
      </section>
    </div>
  )
}

function WorkspaceTab({ to, active, children }: { to: string; active: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={`border-b-2 px-3 py-2.5 text-center text-sm font-semibold transition-colors ${
        active ? 'border-accent text-accent-strong dark:text-accent' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
    </NavLink>
  )
}
