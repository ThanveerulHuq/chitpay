import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, CalendarBlank, CheckCircle, Globe, ShieldStar, SignOut, User, Users } from '@phosphor-icons/react'
import { Page, PageHeader, Button } from '@/components/ui'
import { useAuth } from '@/lib/useAuth'
import { useI18n } from '@/i18n'
import type { Lang } from '@/i18n/types'
import { fetchMyGroups } from '@/lib/api'
import type { GroupDoc } from '@shared'
import { useViewMode } from '@/lib/useViewMode'

export default function SettingsPage() {
  const { lang, setLang, t } = useI18n()
  const { user, profile, logout, isAdmin } = useAuth()
  const { setViewMode } = useViewMode()
  const [archivedGroups, setArchivedGroups] = useState<{ id: string; data: GroupDoc }[]>([])
  const [archivesLoading, setArchivesLoading] = useState(isAdmin)

  useEffect(() => {
    let cancelled = false
    if (!isAdmin) {
      return
    }
    void fetchMyGroups()
      .then((groups) => {
        if (cancelled) return
        setArchivedGroups(groups.filter(({ data }) => data.status === 'archived'))
      })
      .catch(() => {
        if (!cancelled) setArchivedGroups([])
      })
      .finally(() => {
        if (!cancelled) setArchivesLoading(false)
      })
    return () => { cancelled = true }
  }, [isAdmin])

  const languages: Array<{ code: Lang; label: string; subLabel: string }> = [
    { code: 'en', label: 'English', subLabel: 'English' },
    { code: 'ta', label: 'தமிழ்', subLabel: 'Tamil' },
  ]

  const phone = profile?.phone || user?.phoneNumber || ''

  return (
    <Page>
      <PageHeader title={t('settings.title')} backTo="/groups" />

      <div className="space-y-6">
        {/* Language Selection */}
        <section>
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
              {t('settings.language')}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t('settings.languageDesc')}
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
                  {profile?.name || t('settings.account')}
                </p>
                {phone && (
                  <p className="truncate text-xs text-muted">{phone}</p>
                )}
              </div>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-muted">
                {isAdmin ? t('common.admin') : 'Member'}
              </span>
            </div>
          </div>
        </section>

        {isAdmin && (
          <section>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
                {t('settings.archivedGroups')}
              </h2>
              <p className="mt-1 text-sm text-muted">{t('settings.archivedGroupsDesc')}</p>
            </div>
            {archivesLoading ? (
              <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
                {t('common.loading')}
              </div>
            ) : archivedGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                <Archive size={26} className="mx-auto text-faint" />
                <p className="mt-2 text-sm text-muted">{t('settings.noArchivedGroups')}</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {archivedGroups.map(({ id, data }) => (
                  <li key={id}>
                    <Link to={`/groups/${id}`} onClick={() => setViewMode('admin')} className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-sunken">
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
