import { describe, it, expect } from 'vitest'
import {
  canResendOtp,
  resendInMs,
  isOtpExpired,
  isOtpLocked,
  normalizePhone,
} from './otp.js'

describe('otp policy', () => {
  it('allows first send immediately', () => {
    expect(canResendOtp(null, 1000)).toBe(true)
    expect(resendInMs(null, 1000)).toBe(0)
  })

  it('blocks resend within cooldown and reports remaining time', () => {
    const now = 100_000
    expect(canResendOtp(now - 30_000, now)).toBe(false)
    expect(resendInMs(now - 30_000, now)).toBe(30_000)
    expect(canResendOtp(now - 61_000, now)).toBe(true)
  })

  it('expires codes', () => {
    expect(isOtpExpired(5000, 4999)).toBe(false)
    expect(isOtpExpired(5000, 5000)).toBe(true)
  })

  it('locks after max attempts', () => {
    expect(isOtpLocked(4)).toBe(false)
    expect(isOtpLocked(5)).toBe(true)
  })

  it('normalizes phones to digits with country code', () => {
    expect(normalizePhone('98765 43210')).toBe('919876543210')
    expect(normalizePhone('+91-9876543210')).toBe('919876543210')
    expect(normalizePhone('919876543210')).toBe('919876543210')
    expect(() => normalizePhone('12345')).toThrow('invalid_phone')
  })
})
