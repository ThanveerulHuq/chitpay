import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ImageSquare, PencilSimple, Plus, ShieldStar, Trash, X } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import { Button, ErrorNote, Field, Input, Page, PageHeader, PhoneInput, Skeleton } from '@/components/ui'
import {
  callAddProviderAdmin,
  callGetMyProvider,
  callRemoveProviderAdmin,
  callUpdateProviderAppIcon,
  callUpdateProviderName,
  type MyProvider,
} from '@/lib/api'
import { useAuth } from '@/lib/useAuth'
import { useT } from '@/i18n'
import { prepareProviderAppIcon } from '@/lib/providerIcon'

export default function ProviderSettingsPage() {
  const t = useT()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [data, setData] = useState<MyProvider | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [providerName, setProviderName] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [removeUid, setRemoveUid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const iconInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoadError(false)
    try {
      const next = await callGetMyProvider()
      setData(next)
      setProviderName(next.provider.name)
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => {
    let cancelled = false
    void callGetMyProvider().then(
      (next) => {
        if (cancelled) return
        setData(next)
        setProviderName(next.provider.name)
      },
      () => {
        if (!cancelled) setLoadError(true)
      },
    )
    return () => { cancelled = true }
  }, [])

  async function saveName(event: FormEvent) {
    event.preventDefault()
    const name = providerName.trim()
    if (!name) return
    setBusy(true)
    setActionError(null)
    try {
      await callUpdateProviderName(name)
      setEditingName(false)
      setStatus(t('provider.nameUpdated'))
      await load()
    } catch {
      setActionError(t('provider.updateError'))
    } finally {
      setBusy(false)
    }
  }

  async function removeAdmin() {
    if (!removeUid) return
    setBusy(true)
    setActionError(null)
    try {
      const result = await callRemoveProviderAdmin(removeUid)
      setRemoveUid(null)
      if (result.removedSelf) {
        await logout()
        navigate('/login', { replace: true })
        return
      }
      setStatus(t('provider.adminRemoved'))
      await load()
    } catch {
      setActionError(data?.admins.length === 1 ? t('provider.lastAdminError') : t('provider.removeError'))
    } finally {
      setBusy(false)
    }
  }

  async function updateIcon(file: File) {
    setBusy(true)
    setActionError(null)
    try {
      const appIcon = await prepareProviderAppIcon(file)
      await callUpdateProviderAppIcon(appIcon)
      setStatus(t('provider.iconUpdated'))
      await load()
    } catch {
      setActionError(t('provider.iconError'))
    } finally {
      setBusy(false)
      if (iconInputRef.current) iconInputRef.current.value = ''
    }
  }

  async function removeIcon() {
    setBusy(true)
    setActionError(null)
    try {
      await callUpdateProviderAppIcon(null)
      setStatus(t('provider.iconRemoved'))
      await load()
    } catch {
      setActionError(t('provider.iconError'))
    } finally {
      setBusy(false)
    }
  }

  if (!data && !loadError) {
    return <Page><Skeleton className="h-12 w-full" /><Skeleton className="mt-5 h-48 w-full" /></Page>
  }

  return (
    <Page>
      <PageHeader title={t('provider.title')} backTo="/admin/settings" />
      {loadError && <ErrorNote>{t('provider.loadError')}</ErrorNote>}
      {data && (
        <div className="space-y-6">
          {status && <p role="status" className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium text-accent-strong dark:text-accent">{status}</p>}
          {actionError && <ErrorNote>{actionError}</ErrorNote>}
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">{t('provider.details')}</h2>
              {!editingName && <button type="button" onClick={() => setEditingName(true)} className="rounded-full p-2 text-muted hover:bg-sunken"><PencilSimple size={18} weight="bold" /></button>}
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              {editingName ? (
                <form onSubmit={(event) => void saveName(event)}>
                  <Field label={t('provider.name')}><Input autoFocus maxLength={100} required value={providerName} onChange={(event) => setProviderName(event.target.value)} /></Field>
                  <div className="mt-4 flex gap-3">
                    <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => { setProviderName(data.provider.name); setEditingName(false) }}>{t('common.cancel')}</Button>
                    <Button type="submit" className="flex-1" disabled={busy || !providerName.trim()}>{busy ? t('common.saving') : t('common.save')}</Button>
                  </div>
                </form>
              ) : <p className="font-semibold text-ink">{data.provider.name}</p>}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">{t('provider.appIcon')}</h2>
              <p className="mt-1 text-sm text-muted">{t('provider.appIconHint')}</p>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
              {data.provider.appIcon ? (
                <img
                  src={`data:${data.provider.appIcon.contentType};base64,${data.provider.appIcon.image192}`}
                  alt=""
                  className="size-16 shrink-0 rounded-2xl object-contain"
                />
              ) : (
                <img src="/brand/chitpay-app-icon-hands.png" alt="" className="size-16 shrink-0 rounded-2xl object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {data.provider.appIcon ? t('provider.customIcon') : t('provider.defaultIcon')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    ref={iconInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) void updateIcon(file)
                    }}
                  />
                  <Button type="button" variant="secondary" className="px-3 py-2 text-sm" disabled={busy} onClick={() => iconInputRef.current?.click()}>
                    <ImageSquare size={17} />
                    {data.provider.appIcon ? t('provider.changeIcon') : t('provider.uploadIcon')}
                  </Button>
                  {data.provider.appIcon && (
                    <Button type="button" variant="ghost" className="px-3 py-2 text-sm" disabled={busy} onClick={() => void removeIcon()}>
                      {t('provider.useDefaultIcon')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">{t('provider.admins')}</h2>
                <p className="mt-1 text-sm text-muted">{t('provider.adminsHint')}</p>
              </div>
              <Button className="shrink-0 px-4 py-2 text-sm" onClick={() => { setActionError(null); setAddOpen(true) }}><Plus size={16} weight="bold" />{t('common.add')}</Button>
            </div>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {data.admins.map((admin) => (
                <li key={admin.uid} className="flex items-center gap-3 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong dark:text-accent"><ShieldStar size={20} weight="fill" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{admin.name}{admin.isCurrentUser ? ` ${t('provider.you')}` : ''}</p>
                    <p className="truncate text-xs text-muted">+{admin.phone}</p>
                  </div>
                  <button type="button" disabled={busy} onClick={() => { setActionError(null); setRemoveUid(admin.uid) }} aria-label={t('provider.removeAdmin')} className="rounded-full p-2 text-faint hover:bg-danger-soft hover:text-danger disabled:opacity-40"><Trash size={18} /></button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      {addOpen && <AddAdminDialog busy={busy} onClose={() => setAddOpen(false)} onSubmit={async (name, phone) => {
        setBusy(true); setActionError(null)
        try {
          const result = await callAddProviderAdmin({ name, phone })
          setAddOpen(false)
          setStatus(result.notificationSent ? t('provider.adminAdded') : t('provider.adminAddedNoMessage'))
          await load()
        } catch {
          setActionError(t('provider.addError'))
          setAddOpen(false)
        } finally { setBusy(false) }
      }} />}
      {removeUid && <ConfirmRemoveDialog busy={busy} onClose={() => setRemoveUid(null)} onConfirm={() => void removeAdmin()} />}
    </Page>
  )
}

function AddAdminDialog({ busy, onClose, onSubmit }: { busy: boolean; onClose: () => void; onSubmit: (name: string, phone: string) => Promise<void> }) {
  const t = useT()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  return <div className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <form onSubmit={(event) => { event.preventDefault(); void onSubmit(name.trim(), phone) }} className="w-full max-w-lg rounded-t-3xl border border-line bg-surface p-5 shadow-2xl sm:rounded-3xl">
      <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">{t('provider.addAdmin')}</h2><p className="mt-1 text-sm text-muted">{t('provider.addAdminHint')}</p></div><button type="button" onClick={onClose} disabled={busy} className="rounded-full p-1.5 text-muted"><X size={20} /></button></div>
      <div className="mt-5 space-y-4"><Field label={t('settings.yourName')}><Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label={t('settings.phoneNumber')}><PhoneInput value={phone} onChange={setPhone} /></Field></div>
      <div className="mt-5 flex gap-3"><Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" className="flex-1" disabled={busy || !name.trim() || phone.length !== 10}>{busy ? t('common.adding') : t('provider.addAdmin')}</Button></div>
    </form>
  </div>
}

function ConfirmRemoveDialog({ busy, onClose, onConfirm }: { busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const t = useT()
  return <div className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-t-3xl border border-line bg-surface p-5 shadow-2xl sm:rounded-3xl"><h2 className="text-xl font-bold">{t('provider.removeAdmin')}</h2><p className="mt-2 text-sm text-muted">{t('provider.removeConfirm')}</p><div className="mt-5 flex gap-3"><Button variant="secondary" className="flex-1" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button><Button className="flex-1 bg-danger text-white hover:bg-danger" disabled={busy} onClick={onConfirm}>{t('provider.removeAdmin')}</Button></div></div></div>
}
