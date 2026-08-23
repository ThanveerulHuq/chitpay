import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Archive, ArrowCounterClockwise, ArrowLeft, FileText, Receipt } from '@phosphor-icons/react'
import { callArchiveGroup, callUnarchiveGroup, fetchCycles, fetchGroup, fetchGroupMembers } from '@/lib/api'
import { formatMinor } from '@shared'
import type { CycleDoc, GroupDoc, GroupMemberDoc } from '@shared'
import { Page, Skeleton } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/useAuth'
import { useViewMode } from '@/lib/useViewMode'
import PaymentSheet from '@/components/PaymentSheet'

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
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)

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
    if (!window.confirm(t('workspace.archiveConfirm'))) return
    setArchiveBusy(true)
    setArchiveError(null)
    try {
      await callArchiveGroup(groupId)
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
              {!isReadOnly && group.data.currentCycleNumber > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft/70 dark:text-accent"
                >
                  <Receipt size={17} weight="bold" />
                  {t('workspace.paymentAction')}
                </button>
              )}
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
            {t('workspace.perMonth')}{' '}
            <strong className="font-bold text-ink tabular-nums">
              {formatMinor(group.data.monthlyAmountMinor, group.data.currency)}
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
                {Math.max(group.data.currentCycleNumber, 0)} / {group.data.durationMonths}
              </span>
            </WorkspaceTab>
          </nav>
        </header>
        {isAdmin && !isMemberView && (
          <div className={`mt-4 flex items-center gap-3 rounded-2xl border p-3.5 ${isArchived ? 'border-line bg-sunken' : 'border-line/70 bg-surface'}`}>
            <Archive size={20} weight="bold" className={isArchived ? 'shrink-0 text-muted' : 'shrink-0 text-faint'} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{isArchived ? t('workspace.archivedTitle') : t('workspace.archiveTitle')}</p>
              <p className="text-xs text-muted">{isArchived ? t('workspace.archivedDesc') : t('workspace.archiveDesc')}</p>
              {archiveError && <p role="alert" className="mt-1 text-xs text-danger">{archiveError}</p>}
            </div>
            <button type="button" disabled={archiveBusy} onClick={() => void (isArchived ? unarchive() : archive())} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent">
              {isArchived ? <ArrowCounterClockwise size={16} weight="bold" /> : <Archive size={16} weight="bold" />}
              {isArchived ? t('workspace.unarchiveAction') : t('workspace.archiveAction')}
            </button>
          </div>
        )}
        <div className="pt-4">{children}</div>
        {!isReadOnly && paymentOpen && group.data.currentCycleNumber > 0 && (
          <PaymentSheet
            groupId={groupId}
            group={group.data}
            cycleNumber={group.data.currentCycleNumber}
            onClose={() => setPaymentOpen(false)}
            onDone={() => {
              setPaymentOpen(false)
              void reload()
            }}
          />
        )}
      </Page>
    </WorkspaceContext.Provider>
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
