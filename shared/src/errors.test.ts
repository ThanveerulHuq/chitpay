import { describe, it, expect } from 'vitest'
import { userMessage, type AppErrorCode } from './errors'

const ALL_CODES: AppErrorCode[] = [
  'unauthenticated',
  'permission_denied',
  'not_found',
  'already_exists',
  'invalid_transition',
  'already_selected',
  'not_eligible',
  'payout_pending',
  'rate_limited',
  'invalid_argument',
  'internal',
]

describe('errors localization', () => {
  it('returns English message by default', () => {
    expect(userMessage('unauthenticated')).toBe('Please log in to continue.')
    expect(userMessage('already_selected')).toBe('A recipient was already selected for this month.')
  })

  it('returns Tamil message when requested', () => {
    expect(userMessage('unauthenticated', 'ta')).toBe('தொடர தயவுசெய்து உள்நுழையவும்.')
    expect(userMessage('already_selected', 'ta')).toBe(
      'இந்த மாதத்திற்கான பெறுநர் ஏற்கனவே தேர்ந்தெடுக்கப்பட்டுவிட்டார்.',
    )
  })

  it('provides non-empty translations for all codes in both languages', () => {
    for (const code of ALL_CODES) {
      const en = userMessage(code, 'en')
      const ta = userMessage(code, 'ta')
      expect(en).toBeTruthy()
      expect(ta).toBeTruthy()
      expect(en).not.toBe(ta)
    }
  })
})
