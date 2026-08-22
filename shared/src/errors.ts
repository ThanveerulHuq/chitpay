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
    unauthenticated: 'தொடர தயவுசெய்து உள்நுழையவும்.',
    permission_denied: 'இதைச் செய்வதற்கான அனுமதி உங்களுக்கு இல்லை.',
    not_found: 'அந்த விவரம் இப்போது இல்லை.',
    already_exists: 'இது ஏற்கனவே உள்ளது.',
    invalid_transition: 'இந்த செயல் இப்போது அனுமதிக்கப்படவில்லை.',
    already_selected: 'இந்த மாதத்திற்கான பெறுநர் ஏற்கனவே தேர்ந்தெடுக்கப்பட்டுவிட்டார்.',
    not_eligible: 'அந்த உறுப்பினர் தேர்வு செய்ய தகுதியற்றவர்.',
    payout_pending: 'அடுத்த மாதத்தைத் தொடங்குவதற்கு முன் பணப்பட்டுவாடாவை பதிவு செய்யவும்.',
    rate_limited: 'பல முறை முயற்சி செய்யப்பட்டது. சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.',
    invalid_argument: 'உள்ளிடப்பட்ட விவரங்களில் ஏதோ தவறாக உள்ளது.',
    internal: 'ஏதோ தவறு நடந்துவிட்டது. தயவுசெய்து மீண்டும் முயற்சிக்கவும்.',
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
