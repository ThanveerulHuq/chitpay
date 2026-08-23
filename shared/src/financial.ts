import type { PaymentDoc } from './types.js'

export interface PaymentSummary {
  paidCount: number
  collectedAmountMinor: number
}

/** Computes the denormalized cycle counters from source payment documents. */
export function summarizePayments(payments: Pick<PaymentDoc, 'status' | 'amountMinor'>[]): PaymentSummary {
  return payments.reduce<PaymentSummary>(
    (summary, payment) => payment.status === 'paid'
      ? {
          paidCount: summary.paidCount + 1,
          collectedAmountMinor: summary.collectedAmountMinor + payment.amountMinor,
        }
      : summary,
    { paidCount: 0, collectedAmountMinor: 0 },
  )
}
