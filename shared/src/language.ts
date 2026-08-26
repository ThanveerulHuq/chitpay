import type { Lang } from './types.js'

function isLang(value: unknown): value is Lang {
  return value === 'en' || value === 'ta'
}

/** Resolves a group-message language without trusting stored Firestore values. */
export function resolveMessageLanguage(
  customerLanguage: unknown,
  adminLanguage: unknown,
): Lang {
  if (isLang(customerLanguage)) return customerLanguage
  if (isLang(adminLanguage)) return adminLanguage
  return 'en'
}
