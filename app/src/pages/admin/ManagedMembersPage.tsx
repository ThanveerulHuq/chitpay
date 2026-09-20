import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { MagnifyingGlass, PencilSimple, UserCircle, UsersThree, Warning, X } from '@phosphor-icons/react'
import {
  callListManagedMembers,
  callUpdateManagedMemberProfile,
  type ManagedMember,
} from '@/lib/api'
import { Button, Chip, ErrorNote, Field, Input, Page, PageHeader, PhoneInput, Skeleton } from '@/components/ui'
import { useBodyLock } from '@/lib/useBodyLock'
import { useI18n } from '@/i18n'

export default function ManagedMembersPage() {
  const { t } = useI18n()
  const [members, setMembers] = useState<ManagedMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ManagedMember | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function retryLoad() {
    setLoading(true)
    setLoadError(false)
    try {
      setMembers(await callListManagedMembers())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    void callListManagedMembers()
      .then((result) => {
        if (!cancelled) setMembers(result)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return members
    return members.filter((member) => (
      member.names.some((name) => name.toLowerCase().includes(query))
      || member.phone.includes(query.replace(/\D/g, ''))
      || member.groups.some((group) => group.name.toLowerCase().includes(query))
    ))
  }, [members, search])

  function saved(updated: ManagedMember, phoneChanged: boolean, notificationSent: boolean) {
    setMembers((current) => current
      .map((member) => member.uid === updated.uid ? updated : member)
      .sort((a, b) => a.name.localeCompare(b.name)))
    setEditing(null)
    setNotice(
      phoneChanged
        ? notificationSent
          ? t('managedMembers.updatedAndSent')
          : t('managedMembers.updatedSendFailed')
        : t('managedMembers.updated'),
    )
  }

  return (
    <Page>
      <PageHeader title={t('managedMembers.title')} backTo="/admin/settings" />
      <p className="mb-4 text-sm leading-6 text-muted">{t('managedMembers.description')}</p>

      {notice && (
        <div role="status" className="mb-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent-strong dark:text-accent">
          {notice}
        </div>
      )}

      <div className="relative">
        <MagnifyingGlass size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('managedMembers.search')}
          aria-label={t('managedMembers.search')}
          className="mt-0 pl-9"
        />
      </div>

      {loading ? (
        <ManagedMemberSkeleton loadingLabel={t('common.loading')} />
      ) : loadError ? (
        <div className="mt-5 text-center">
          <ErrorNote>{t('managedMembers.loadError')}</ErrorNote>
          <Button variant="secondary" onClick={() => void retryLoad()}>{t('common.retry')}</Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <UsersThree size={34} className="mx-auto text-faint" />
          <p className="mt-3 font-semibold">{members.length ? t('managedMembers.noMatches') : t('managedMembers.empty')}</p>
          <p className="mt-1 text-sm text-muted">{members.length ? t('managedMembers.noMatchesHint') : t('managedMembers.emptyHint')}</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {visible.map((member) => (
            <li key={member.uid}>
              <button
                type="button"
                onClick={() => {
                  if (member.isAdmin) return
                  setNotice(null)
                  setEditing(member)
                }}
                disabled={member.isAdmin}
                aria-label={member.isAdmin ? t('managedMembers.adminProtected', { name: member.name }) : undefined}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors enabled:hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-sunken text-muted">
                  <UserCircle size={25} weight="fill" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{member.name}</span>
                  <span className="mt-1 block truncate text-xs text-faint">
                    {t('managedMembers.slotSummary', { slots: member.slotCount, groups: member.groupCount })}
                  </span>
                </span>
                {member.isAdmin ? (
                  <Chip tone="neutral">{t('common.admin')}</Chip>
                ) : member.inactiveSlotCount > 0 ? (
                  <Chip tone="neutral">{t('common.inactive')}</Chip>
                ) : null}
                {member.isAdmin ? (
                  <span className="sr-only">{t('managedMembers.adminCannotEdit')}</span>
                ) : (
                  <PencilSimple size={18} className="shrink-0 text-muted" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <EditMemberSheet
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={saved}
        />
      )}
    </Page>
  )
}

function ManagedMemberSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div role="status" className="mt-5 space-y-3">
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="size-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-1/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EditMemberSheet({
  member,
  onClose,
  onSaved,
}: {
  member: ManagedMember
  onClose: () => void
  onSaved: (member: ManagedMember, phoneChanged: boolean, notificationSent: boolean) => void
}) {
  const { lang, t } = useI18n()
  const [names, setNames] = useState(member.names)
  const [phone, setPhone] = useState(member.phone.replace(/^91/, ''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useBodyLock(true)

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busy, onClose])

  const cleanNames = names.map((name) => name.trim())
  const changed = cleanNames.some((name, index) => name !== member.names[index]) || `91${phone}` !== member.phone
  const valid = cleanNames.every((name) => name.length > 0) && phone.length === 10

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!valid || !changed) return
    setBusy(true)
    setError(null)
    try {
      const result = await callUpdateManagedMemberProfile({
        uid: member.uid,
        names: member.names.map((currentName, index) => ({ currentName, name: cleanNames[index]! })),
        phone: `+91${phone}`,
      })
      onSaved({ ...member, names: result.names, name: result.names.join(' / '), phone: `91${phone}` }, result.phoneChanged, result.notificationSent)
    } catch (caught) {
      const code = (caught as { code?: string })?.code
      setError(
        code === 'functions/already-exists'
          ? t('managedMembers.phoneInUse')
          : code === 'functions/invalid-argument'
            ? t('managedMembers.invalidDetails')
            : lang === 'ta'
              ? 'உறுப்பினர் விவரங்களைப் புதுப்பிக்க முடியவில்லை.'
              : 'Could not update this member.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-member-title"
        aria-describedby="edit-member-description"
        className="w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-member-title" className="text-xl font-bold">{t('managedMembers.editTitle')}</h2>
            <p id="edit-member-description" className="mt-1 text-sm text-muted">{t('managedMembers.editDescription')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close')} className="rounded-full p-2 text-muted hover:bg-sunken disabled:opacity-40">
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="mt-4 flex gap-3 rounded-2xl bg-sunken p-3.5 text-sm text-muted">
          <Warning size={20} weight="fill" className="mt-0.5 shrink-0 text-accent-strong dark:text-accent" />
          <p>{t('managedMembers.accountWideWarning')}</p>
        </div>

        <form onSubmit={save} className="mt-5 space-y-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-ink">{t('managedMembers.namesLabel')}</legend>
            {names.map((name, index) => <Input key={`${member.names[index]}-${index}`} autoFocus={index === 0} required maxLength={100} value={name} aria-label={t('managedMembers.nameNumber', { count: index + 1 })} onChange={(event) => setNames((current) => current.map((value, nameIndex) => nameIndex === index ? event.target.value : value))} />)}
          </fieldset>
          <Field label={t('dash.memberPhone')} hint={t('managedMembers.phoneHint')}>
            <PhoneInput value={phone} onChange={setPhone} />
          </Field>
          <div>
            <p className="text-xs font-semibold text-faint">{t('managedMembers.groupsLabel')}</p>
            <p className="mt-1 text-sm text-muted">{member.groups.map((group) => group.name).join(', ')}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy || !valid || !changed} className="flex-1">{busy ? t('common.saving') : t('common.save')}</Button>
          </div>
        </form>
      </section>
    </div>
  )
}
