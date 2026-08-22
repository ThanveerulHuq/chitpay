/** Pure OTP policy logic — shared by functions (enforcement) and UI (hints). */

export const OTP_CODE_LENGTH = 6
export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000

export function canResendOtp(lastSentAt: number | null, now: number): boolean {
  if (lastSentAt === null) return true
  return now - lastSentAt >= OTP_RESEND_COOLDOWN_MS
}

export function resendInMs(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null || canResendOtp(lastSentAt, now)) return 0
  return OTP_RESEND_COOLDOWN_MS - (now - lastSentAt)
}

export function isOtpExpired(expiresAt: number, now: number): boolean {
  return now >= expiresAt
}

export function isOtpLocked(attempts: number): boolean {
  return attempts >= OTP_MAX_ATTEMPTS
}

/** Normalizes a phone to E.164-ish digits-only form used as doc keys. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  if (digits.length < 10) throw new Error('invalid_phone')
  return digits.length === 10 ? `91${digits}` : digits
}
