import { describe, expect, it } from 'vitest'
import { resolveMessageLanguage } from './language'

describe('resolveMessageLanguage', () => {
  it('prefers the customer language over the admin language', () => {
    expect(resolveMessageLanguage('ta', 'en')).toBe('ta')
    expect(resolveMessageLanguage('en', 'ta')).toBe('en')
  })

  it('uses the admin language when the customer has no preference', () => {
    expect(resolveMessageLanguage(undefined, 'ta')).toBe('ta')
  })

  it('falls back to English when neither preference is valid', () => {
    expect(resolveMessageLanguage(undefined, undefined)).toBe('en')
    expect(resolveMessageLanguage('fr', 'de')).toBe('en')
  })

  it('ignores an invalid customer value before using the admin language', () => {
    expect(resolveMessageLanguage('fr', 'ta')).toBe('ta')
  })
})
