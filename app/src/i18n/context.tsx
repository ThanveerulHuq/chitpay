import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuth } from '@/lib/useAuth'
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

  // Sync with user's Firestore profile if available
  const profileLang = profile?.language
  useEffect(() => {
    if (profileLang) {
      setLangState(profileLang)
      try {
        localStorage.setItem(STORAGE_KEY, profileLang)
      } catch {
        // ignore storage errors
      }
    }
  }, [profileLang])

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

      // Persist to user profile if logged in
      const currentUid = user?.uid ?? auth.currentUser?.uid
      if (currentUid) {
        try {
          await setDoc(doc(db, 'users', currentUid), { language: nextLang }, { merge: true })
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
