import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { AppError, type AppErrorCode } from '@chitapp/shared'

const CODE_MAP: Record<AppErrorCode, FunctionsErrorCode> = {
  unauthenticated: 'unauthenticated',
  permission_denied: 'permission-denied',
  not_found: 'not-found',
  already_exists: 'already-exists',
  rate_limited: 'resource-exhausted',
  invalid_argument: 'invalid-argument',
  invalid_transition: 'failed-precondition',
  already_selected: 'failed-precondition',
  not_eligible: 'failed-precondition',
  payout_pending: 'failed-precondition',
  internal: 'internal',
}

/** Converts AppError into an HttpsError with the code preserved for the client, logging details. */
export function toHttpsError(err: unknown, context?: Record<string, unknown>): HttpsError {
  if (err instanceof AppError) {
    const functionsCode = CODE_MAP[err.code] ?? 'internal'
    logger.warn(`AppError [${err.code}]: ${err.message}`, {
      code: err.code,
      message: err.message,
      functionsCode,
      ...(context ?? {}),
    })
    return new HttpsError(functionsCode, err.message, { code: err.code })
  }

  logger.error('Unhandled error:', err, context)
  return new HttpsError('internal', 'internal' satisfies AppErrorCode)
}

