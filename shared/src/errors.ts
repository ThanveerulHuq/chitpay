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

const MESSAGES: Record<AppErrorCode, string> = {
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
}

export class AppError extends Error {
  code: AppErrorCode

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? MESSAGES[code])
    this.name = 'AppError'
    this.code = code
  }
}

export function userMessage(code: AppErrorCode): string {
  return MESSAGES[code]
}
