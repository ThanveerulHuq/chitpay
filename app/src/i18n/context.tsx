import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from '@/lib/useAuth'
import { callUpdateOwnLanguage } from '@/lib/api'
import { auth, db } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'
import type { Lang, TranslationKey } from './types'
import { en } from './en'
import { ta } from './ta'

const STORAGE_KEY = 'chitapp_lang'

const DICTIONARIES = {
  en,
  ta,
}

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ta') return saved
  } catch {
    // localStorage might be unavailable or restricted
  }
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [lang, setLangState] = useState<Lang>(() => getInitialLang())

  // Admins share their provider language; members keep a personal preference.
  const profileLang = profile?.language
  const providerId = profile?.roles.includes('admin') ? profile.providerId : undefined
  useEffect(() => {
    const applyLanguage = (nextLang: Lang | undefined) => {
      if (!nextLang) return
      setLangState(nextLang)
      try {
        localStorage.setItem(STORAGE_KEY, nextLang)
      } catch {
        // ignore storage errors
      }
    }

    if (!providerId) {
      applyLanguage(profileLang)
      return
    }
    return onSnapshot(
      doc(db, 'providers', providerId),
      (snapshot) => applyLanguage((snapshot.data()?.language as Lang | undefined) ?? profileLang),
      () => applyLanguage(profileLang),
    )
  }, [profileLang, providerId])

  // Update <html lang="..."> attribute reactively
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback(
    async (nextLang: Lang) => {
      setLangState(nextLang)
      try {
        localStorage.setItem(STORAGE_KEY, nextLang)
      } catch {
        // ignore
      }

      // The callable writes provider language for admins and personal language for members.
      const currentUid = user?.uid ?? auth.currentUser?.uid
      if (currentUid) {
        try {
          await callUpdateOwnLanguage(nextLang)
        } catch {
          // non-fatal
        }
      }
    },
    [user?.uid],
  )

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = DICTIONARIES[lang] ?? en
      let template: string = dict[key] ?? en[key] ?? key

      if (params) {
        for (const [pKey, pVal] of Object.entries(params)) {
          template = template.replaceAll(`{${pKey}}`, String(pVal))
        }
      }

      return template
    },
    [lang],
  )

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return ctx
}

export function useT() {
  return useI18n().t
}
