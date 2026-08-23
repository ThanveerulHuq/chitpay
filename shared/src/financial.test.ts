import { describe, expect, it } from 'vitest'
import { summarizePayments } from './financial'

describe('summarizePayments', () => {
  it('counts only paid payments and sums minor units', () => {
    expect(summarizePayments([
      { status: 'paid', amountMinor: 40000 },
      { status: 'pending', amountMinor: 40000 },
      { status: 'paid', amountMinor: 1250 },
    ])).toEqual({ paidCount: 2, collectedAmountMinor: 41250 })
  })

  it('returns zeroes for an empty cycle', () => {
    expect(summarizePayments([])).toEqual({ paidCount: 0, collectedAmountMinor: 0 })
  })
})
