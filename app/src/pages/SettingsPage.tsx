import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Buildings, CaretRight, CheckCircle, Globe, PencilSimple, ShieldStar, SignOut, User, UsersThree } from '@phosphor-icons/react'
import { Page, PageHeader, Button, ErrorNote, Field, Input } from '@/components/ui'
import { useAuth } from '@/lib/useAuth'
import { callUpdateOwnName } from '@/lib/api'
import { useI18n } from '@/i18n'
import type { Lang } from '@/i18n/types'
import { groupsPath, settingsPath, useExperience } from '@/lib/roleRoutes'

export default function SettingsPage() {
  const { lang, setLang, t } = useI18n()
  const { user, profile, logout, isAdmin } = useAuth()
  const experience = useExperience()
  const [name, setName] = useState('')
  const [savedName, setSavedName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameBusy, setNameBusy] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  const languages: Array<{ code: Lang; label: string; subLabel: string }> = [
    { code: 'en', label: 'English', subLabel: 'English' },
    { code: 'ta', label: 'தமிழ்', subLabel: 'Tamil' },
  ]

  const phone = profile?.phone || user?.phoneNumber || ''
  const displayedName = savedName || profile?.name || ''

  async function saveName(event: FormEvent) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName || cleanName === displayedName) return
    setNameBusy(true)
    setNameError(false)
    setNameSaved(false)
    try {
      await callUpdateOwnName(cleanName)
      setName(cleanName)
      setSavedName(cleanName)
      setEditingName(false)
      setNameSaved(true)
    } catch {
      setNameError(true)
    } finally {
      setNameBusy(false)
    }
  }

  return (
    <Page>
      <PageHeader title={t('settings.title')} backTo={groupsPath(experience)} />

      <div className="space-y-6">
        {/* Language Selection */}
        <section>
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
              {t('settings.language')}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {isAdmin && experience === 'admin' ? t('settings.providerLanguageDesc') : t('settings.languageDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {languages.map((item) => {
              const isSelected = lang === item.code
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => setLang(item.code)}
                  className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? 'border-accent bg-accent-soft/40 shadow-xs'
                      : 'border-line bg-surface hover:bg-sunken'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${
                        isSelected
                          ? 'bg-accent text-on-accent'
                          : 'bg-sunken text-muted'
                      }`}
                    >
                      <Globe size={20} weight={isSelected ? 'bold' : 'regular'} />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{item.label}</p>
                      <p className="text-xs text-muted">{item.subLabel}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle
                      size={22}
                      weight="fill"
                      className="text-accent"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* Account Details */}
        <section>
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
              {t('settings.account')}
            </h2>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-sunken text-muted">
                {isAdmin ? (
                  <ShieldStar size={24} weight="fill" className="text-accent" />
                ) : (
                  <User size={24} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {displayedName || t('settings.account')}
                </p>
                {phone && (
                  <p className="truncate text-xs text-muted">{phone}</p>
                )}
              </div>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
                {isAdmin ? t('common.admin') : t('common.member')}
              </span>
              {isAdmin && experience === 'admin' && (
                <button
                  type="button"
                  onClick={() => { setName(displayedName); setNameError(false); setNameSaved(false); setEditingName(true) }}
                  aria-label={t('settings.editOwnName')}
                  className="rounded-full p-2 text-muted hover:bg-sunken hover:text-ink"
                >
                  <PencilSimple size={18} weight="bold" />
                </button>
              )}
            </div>
            {nameSaved && <p role="status" className="mt-3 text-sm font-medium text-accent-strong dark:text-accent">{t('settings.nameUpdated')}</p>}
            {editingName && (
              <form onSubmit={saveName} className="mt-4 border-t border-line pt-4">
                {nameError && <ErrorNote>{t('settings.nameUpdateError')}</ErrorNote>}
                <Field label={t('settings.yourName')}>
                  <Input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
                </Field>
                <div className="mt-4 flex gap-3">
                  <Button type="button" variant="secondary" disabled={nameBusy} onClick={() => { setName(displayedName); setEditingName(false); setNameError(false) }} className="flex-1">{t('common.cancel')}</Button>
                  <Button type="submit" disabled={nameBusy || !name.trim() || name.trim() === displayedName} className="flex-1">{nameBusy ? t('common.saving') : t('common.save')}</Button>
                </div>
              </form>
            )}
          </div>
        </section>

        {isAdmin && experience === 'admin' && (
          <section className="space-y-3">
            {profile?.providerId && (
              <Link to={`${settingsPath(experience)}/provider`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-muted">
                  <Buildings size={20} weight="bold" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{t('provider.title')}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t('provider.settingsHint')}</span>
                </span>
                <CaretRight size={18} className="shrink-0 text-faint" />
              </Link>
            )}
            <Link to={`${settingsPath(experience)}/members`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-muted">
                <UsersThree size={20} weight="bold" />
              </div>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{t('settings.manageMembers')}</span>
                <span className="mt-0.5 block text-xs text-muted">{t('settings.manageMembersHint')}</span>
              </span>
              <CaretRight size={18} className="shrink-0 text-faint" />
            </Link>
            <Link to={`${settingsPath(experience)}/archived-groups`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-muted">
                <Archive size={20} weight="bold" />
              </div>
              <span className="min-w-0 flex-1 font-semibold text-ink">{t('settings.archivedGroups')}</span>
              <CaretRight size={18} className="shrink-0 text-faint" />
            </Link>
          </section>
        )}

        {/* Logout Action */}
        <section className="pt-2">
          <Button
            variant="secondary"
            onClick={logout}
            className="w-full text-danger hover:bg-danger-soft/40 hover:text-danger"
          >
            <SignOut size={18} />
            {t('common.logout')}
          </Button>
        </section>

        {/* App Info Footer */}
        <div className="mt-12 flex flex-col items-center justify-center text-center text-xs text-faint">
          <img
            src="/brand/chitpay-app-icon-hands.png"
            alt=""
            className="mb-2 size-7 rounded-lg object-contain opacity-70"
          />
          <p className="font-semibold text-muted">{t('settings.appInfo')}</p>
          <p className="mt-0.5">{t('settings.appDescription')}</p>
        </div>
      </div>
    </Page>
  )
}
