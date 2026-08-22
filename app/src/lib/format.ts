import { useI18n } from '@/i18n'
import type { Lang } from '@/i18n'

export function localeFor(lang: Lang): string {
  return lang === 'ta' ? 'ta-IN' : 'en-IN'
}

export function useLocale(): string {
  return localeFor(useI18n().lang)
}
