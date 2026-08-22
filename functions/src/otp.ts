import { createHash, randomInt } from 'node:crypto'
import {
  OTP_CODE_LENGTH,
  canResendOtp,
  isOtpExpired,
  isOtpLocked,
} from '@chitapp/shared'
import { AppError } from '@chitapp/shared'

export function generateOtpCode(): string {
  let code = ''
  for (let i = 0; i < OTP_CODE_LENGTH; i++) code += randomInt(0, 10).toString()
  return code
}

export function hashOtpCode(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

interface OtpDocData {
  codeHash: string
  expiresAt: number
  attempts: number
  lastSentAt: number
}

interface HasData {
  data(): unknown
}

function asOtpData(data: unknown): Partial<OtpDocData> | undefined {
  return (data ?? undefined) as Partial<OtpDocData> | undefined
}

/** Throws typed errors unless a fresh OTP may be sent. */
export function assertOtpSendable(doc: HasData, now: number): void {
  const d = asOtpData(doc.data())
  if (!d?.lastSentAt) return
  if (!canResendOtp(d.lastSentAt, now)) throw new AppError('rate_limited')
}

export function verifyOtpDoc(
  doc: HasData,
  code: string,
  salt: string,
  now: number,
): boolean {
  const data = asOtpData(doc.data())
  if (!data?.expiresAt || !data.codeHash) return false
  if (isOtpExpired(data.expiresAt, now)) return false
  if (isOtpLocked(data.attempts ?? 0)) throw new AppError('rate_limited')
  return hashOtpCode(code, salt) === data.codeHash
}
