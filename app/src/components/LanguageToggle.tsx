import { useI18n } from '@/i18n'

export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()

  return (
    <div
      role="radiogroup"
      aria-label={t('a11y.toggleLang')}
      className={`inline-flex items-center rounded-xl border border-line bg-surface-sunken p-0.5 text-xs font-semibold ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={lang === 'en'}
        onClick={() => setLang('en')}
        className={`rounded-lg px-2.5 py-1 transition-all ${
          lang === 'en'
            ? 'bg-surface text-ink shadow-xs'
            : 'text-muted hover:text-ink'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={lang === 'ta'}
        onClick={() => setLang('ta')}
        className={`rounded-lg px-2.5 py-1 transition-all ${
          lang === 'ta'
            ? 'bg-surface text-ink shadow-xs'
            : 'text-muted hover:text-ink'
        }`}
      >
        தமிழ்
      </button>
    </div>
  )
}
