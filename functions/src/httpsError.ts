import { HttpsError } from 'firebase-functions/v2/https'
import { AppError, AppErrorCode } from '@chitapp/shared'

/** Converts AppError into an HttpsError with the code preserved for the client. */
export function toHttpsError(err: unknown): HttpsError {
  if (err instanceof AppError) {
    const { code } = err
    return new HttpsError(
      code === 'unauthenticated' ? 'unauthenticated'
        : code === 'permission_denied' ? 'permission-denied'
        : code === 'not_found' ? 'not-found'
        : code === 'already_exists' ? 'already-exists'
        : code === 'rate_limited' ? 'resource-exhausted'
        : code === 'invalid_argument' ? 'invalid-argument'
        : 'internal',
      code,
    )
  }
  console.error('Unhandled error:', err)
  return new HttpsError('internal', 'internal' satisfies AppErrorCode)
}
