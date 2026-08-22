import type { Lang } from './types.js'

/** Typed error codes surfaced by Callable Functions and mapped to UI copy. */
export type AppErrorCode =
  | 'unauthenticated'
  | 'permission_denied'
  | 'not_found'
  | 'already_exists'
  | 'invalid_transition'
  | 'already_selected'
  | 'not_eligible'
  | 'payout_pending'
  | 'rate_limited'
  | 'invalid_argument'
  | 'internal'

const MESSAGES: Record<Lang, Record<AppErrorCode, string>> = {
  en: {
    unauthenticated: 'Please log in to continue.',
    permission_denied: "You don't have access to do that.",
    not_found: 'That record no longer exists.',
    already_exists: 'This already exists.',
    invalid_transition: "That action isn't allowed right now.",
    already_selected: 'A recipient was already selected for this month.',
    not_eligible: 'That member is not eligible for selection.',
    payout_pending: 'Record the payout before starting the next month.',
    rate_limited: 'Too many attempts. Please wait a moment and try again.',
    invalid_argument: 'Something looks wrong with the details entered.',
    internal: 'Something went wrong. Please try again.',
  },
  ta: {
    unauthenticated: 'தொடர உள்நுழையவும்.',
    permission_denied: 'இதைச் செய்வதற்கான அனுமதி உங்களுக்கு இல்லை.',
    not_found: 'அந்த விவரம் கிடைக்கவில்லை.',
    already_exists: 'இது ஏற்கனவே உள்ளது.',
    invalid_transition: 'இந்த செயல் இப்போது அனுமதிக்கப்படவில்லை.',
    already_selected: 'இந்த மாதத்திற்கான வெற்றியாளர் ஏற்கனவே தேர்ந்தெடுக்கப்பட்டுவிட்டார்.',
    not_eligible: 'இந்த உறுப்பினரை இப்போது தேர்ந்தெடுக்க முடியாது.',
    payout_pending: 'அடுத்த மாதத்தைத் தொடங்குவதற்கு முன் பணத்தை வழங்கி பதிவு செய்யவும்.',
    rate_limited: 'அதிக முறை முயற்சிக்கப்பட்டது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
    invalid_argument: 'உள்ளிடப்பட்ட விவரங்கள் சரியாக இல்லை.',
    internal: 'ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயற்சிக்கவும்.',
  },
}

export class AppError extends Error {
  code: AppErrorCode

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? MESSAGES.en[code])
    this.name = 'AppError'
    this.code = code
  }
}

export function userMessage(code: AppErrorCode, lang: Lang = 'en'): string {
  return MESSAGES[lang]?.[code] ?? MESSAGES.en[code]
}
