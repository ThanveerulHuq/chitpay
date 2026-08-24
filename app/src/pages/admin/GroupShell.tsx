import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type TouchEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Archive, ArrowCounterClockwise, ArrowLeft, FileText, Gear, X } from '@phosphor-icons/react'
import { callArchiveGroup, callUnarchiveGroup, callUpdateGroupSettings, fetchCycles, fetchGroup, fetchGroupMembers, fetchMyMemberships } from '@/lib/api'
import { formatMinor, resolveGroupVisibility } from '@shared'
import type { CycleDoc, GroupDoc, GroupMemberDoc } from '@shared'
import { Button, ErrorNote, Field, Input, Page, Skeleton } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useAuth } from '@/lib/useAuth'
import { useBodyLock } from '@/lib/useBodyLock'
import { groupPath, groupsPath, settingsPath, useExperience } from '@/lib/roleRoutes'

export interface WorkspaceValue {
  groupId: string
  group: GroupDoc
  members: { id: string; data: GroupMemberDoc }[]
  cycles: { id: string; data: CycleDoc }[]
  reload: () => Promise<void>
  isReadOnly: boolean
  isMemberView: boolean
  isAdmin: boolean
  ownMembershipIds: Set<string>
  showOtherMembers: boolean
  showOtherMemberDues: boolean
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

const MOBILE_BREAKPOINT = 768
const SWIPE_DISTANCE = 64
const SWIPE_DIRECTION_RATIO = 1.25

export function useGroupWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useGroupWorkspace must be used inside GroupShell')
  return context
}

export default function GroupShell({ children }: { children: ReactNode }) {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const experience = useExperience()
  const { t } = useI18n()
  const isMemberView = experience === 'member' || !isAdmin
  const [group, setGroup] = useState<{ id: string; data: GroupDoc } | null>(null)
  const [members, setMembers] = useState<{ id: string; data: GroupMemberDoc }[]>([])
  const [cycles, setCycles] = useState<{ id: string; data: CycleDoc }[]>([])
  const [ownMembershipIds, setOwnMembershipIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const reload = useCallback(async () => {
    const [nextGroup, nextMembers, nextCycles, memberships] = await Promise.all([
      fetchGroup(groupId),
      fetchGroupMembers(groupId),
      fetchCycles(groupId),
      isMemberView ? fetchMyMemberships() : Promise.resolve([]),
    ])
    setGroup(nextGroup)
    setMembers(nextMembers.sort((a, b) => a.data.slotNo - b.data.slotNo))
    setCycles(nextCycles.sort((a, b) => Number(a.id) - Number(b.id)))
    setOwnMembershipIds(new Set(memberships.filter(({ data }) => data.groupId === groupId).map(({ data }) => data.membershipId)))
    setLoading(false)
  }, [groupId, isMemberView])

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetchGroup(groupId),
      fetchGroupMembers(groupId),
      fetchCycles(groupId),
      isMemberView ? fetchMyMemberships() : Promise.resolve([]),
    ]).then(
      ([nextGroup, nextMembers, nextCycles, memberships]) => {
        if (cancelled) return
        setGroup(nextGroup)
        setMembers(nextMembers.sort((a, b) => a.data.slotNo - b.data.slotNo))
        setCycles(nextCycles.sort((a, b) => Number(a.id) - Number(b.id)))
        setOwnMembershipIds(new Set(memberships.filter(({ data }) => data.groupId === groupId).map(({ data }) => data.membershipId)))
        setLoading(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [groupId, isMemberView])

  const isArchived = group?.data.status === 'archived'
  const isReadOnly = isMemberView || isArchived
  const visibility = group ? resolveGroupVisibility(group.data) : { showOtherMembers: true, showOtherMemberDues: true }
  const showOtherMembers = !isMemberView || visibility.showOtherMembers
  const showOtherMemberDues = !isMemberView || visibility.showOtherMemberDues
  const isCycleDetail = /\/cycles\/[^/]+$/.test(location.pathname)
  const isReportsPage = location.pathname.endsWith('/reports')
  const isMembersPage = location.pathname.endsWith('/members')
  const isCyclesPage = location.pathname.endsWith('/cycles')
  const canSwipeBetweenTabs = isMembersPage || isCyclesPage
  const backTo = isCycleDetail
    ? groupPath(experience, groupId, 'cycles')
    : isReportsPage
      ? groupPath(experience, groupId)
      : isArchived && !isMemberView
        ? settingsPath(experience)
        : groupsPath(experience)
  const value = useMemo<WorkspaceValue | null>(
    () => group ? ({ groupId, group: group.data, members, cycles, reload, isReadOnly, isMemberView, isAdmin, ownMembershipIds, showOtherMembers, showOtherMemberDues }) : null,
    [groupId, group, members, cycles, reload, isReadOnly, isMemberView, isAdmin, ownMembershipIds, showOtherMembers, showOtherMemberDues],
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

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    swipeStart.current = null
    if (!canSwipeBetweenTabs || window.innerWidth >= MOBILE_BREAKPOINT || event.touches.length !== 1) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, select, textarea, [contenteditable="true"], [role="dialog"], [data-swipe-ignore]')) return
    const touch = event.touches[0]
    swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLElement>) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || event.changedTouches.length !== 1) return

    const touch = event.changedTouches[0]
    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < SWIPE_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY) * SWIPE_DIRECTION_RATIO) return

    if (deltaX < 0 && isMembersPage) {
      event.preventDefault()
      void navigate(groupPath(experience, groupId, 'cycles'))
    } else if (deltaX > 0 && isCyclesPage) {
      event.preventDefault()
      void navigate(groupPath(experience, groupId))
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
  const personCount = new Set(members.filter(({ id, data }) => (
    data.status === 'active' && (showOtherMembers || ownMembershipIds.has(id))
  )).map(({ data }) => data.uid)).size
  const canEditSettings = isAdmin && !isMemberView && !isArchived

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
            {(!isReportsPage || canEditSettings) && (
              <div className="flex shrink-0 items-center gap-1">
                {!isReportsPage && (
                  <Link
                    to={groupPath(experience, groupId, 'reports')}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-accent-strong hover:bg-accent-soft dark:text-accent"
                  >
                    <FileText size={17} weight="bold" />
                    {t('workspace.reports')}
                  </Link>
                )}
                {canEditSettings && (
                  <button
                    type="button"
                    onClick={() => { setSettingsSaved(false); setSettingsOpen(true) }}
                    aria-label={t('workspace.groupSettings')}
                    title={t('workspace.groupSettings')}
                    className="rounded-full p-2 text-muted transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <Gear size={20} weight="bold" />
                  </button>
                )}
              </div>
            )}
          </div>
          <p className="pb-2 text-sm text-muted">
            {t('workspace.contribution')}{' '}
            <strong className="font-bold text-ink tabular-nums">
              {formatMinor(group.data.contributionAmountMinor, group.data.currency)}
            </strong>
          </p>
          {!isReportsPage && (
            <nav aria-label={t('workspace.tabs')} className="grid grid-cols-2 gap-1 pt-2">
              <WorkspaceTab to={groupPath(experience, groupId)} active={location.pathname.endsWith('/members')}>
                {t('workspace.membersTab')}{' '}
                <span className="text-xs tabular-nums text-faint">{personCount}</span>
              </WorkspaceTab>
              <WorkspaceTab to={groupPath(experience, groupId, 'cycles')} active={location.pathname.includes('/cycles')}>
                {t('workspace.cyclesTab')}{' '}
                <span className="text-xs tabular-nums text-faint">
                  {group.data.completedCycleCount} / {group.data.cycleCount}
                </span>
              </WorkspaceTab>
            </nav>
          )}
        </header>
        {settingsSaved && <p role="status" className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent-strong dark:text-accent">{t('workspace.groupSettingsSaved')}</p>}
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
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { swipeStart.current = null }}
          className={`pt-4 ${canSwipeBetweenTabs ? 'touch-pan-y' : ''}`}
        >
          {children}
        </div>
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
      {settingsOpen && canEditSettings && (
        <GroupSettingsSheet
          groupId={groupId}
          group={group.data}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            setSettingsOpen(false)
            setSettingsSaved(true)
            void reload()
          }}
        />
      )}
    </WorkspaceContext.Provider>
  )
}

function GroupSettingsSheet({ groupId, group, onClose, onSaved }: { groupId: string; group: GroupDoc; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n()
  const initialVisibility = resolveGroupVisibility(group)
  const [name, setName] = useState(group.name)
  const [showOtherMembers, setShowOtherMembers] = useState(initialVisibility.showOtherMembers)
  const [showOtherMemberDues, setShowOtherMemberDues] = useState(initialVisibility.showOtherMemberDues)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useBodyLock(true)

  async function save(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('workspace.groupNameRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await callUpdateGroupSettings({ groupId, name: trimmedName, showOtherMembers, showOtherMemberDues })
      onSaved()
    } catch {
      setError(t('workspace.groupSettingsError'))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <form onSubmit={(event) => void save(event)} role="dialog" aria-modal="true" aria-labelledby="group-settings-title" className="w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="group-settings-title" className="text-xl font-bold">{t('workspace.groupSettings')}</h2>
            <p className="mt-1 text-sm text-muted">{t('workspace.groupSettingsHint')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken hover:text-ink disabled:opacity-40"><X size={20} weight="bold" /></button>
        </div>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        <div className="mt-5">
          <Field label={t('createGroup.name')}>
            <Input required value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
        <div className="mt-6 space-y-4 border-t border-line pt-5">
          <VisibilityCheckbox
            checked={showOtherMembers}
            label={t('createGroup.showOtherMembersLabel')}
            hint={t('createGroup.showOtherMembersHint')}
            onChange={(checked) => {
              setShowOtherMembers(checked)
              if (!checked) setShowOtherMemberDues(false)
            }}
          />
          <VisibilityCheckbox
            checked={showOtherMemberDues}
            disabled={!showOtherMembers}
            label={t('createGroup.showOtherMemberDuesLabel')}
            hint={t('createGroup.showOtherMemberDuesHint')}
            onChange={setShowOtherMemberDues}
          />
        </div>
        <div className="mt-7 flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="flex-1">{t('common.cancel')}</Button>
          <Button type="submit" disabled={busy} className="flex-1">{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>
    </div>
  )
}

function VisibilityCheckbox({ checked, disabled = false, label, hint, onChange }: { checked: boolean; disabled?: boolean; label: string; hint: string; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex items-start gap-3 text-sm ${disabled ? 'text-faint' : 'text-ink'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-5 shrink-0 accent-accent disabled:opacity-50" />
      <span><span className="font-medium">{label}</span><span className="mt-0.5 block text-xs leading-5 text-muted">{hint}</span></span>
    </label>
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
