import { describe, expect, it } from 'vitest'
import { summarizePayments, summarizePendingCyclePayments } from './financial'

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

describe('summarizePendingCyclePayments', () => {
  it('sorts cycle numbers and totals integer minor-unit amounts', () => {
    expect(summarizePendingCyclePayments([
      { cycleNumber: 3, amountMinor: 100000 },
      { cycleNumber: 1, amountMinor: 100000 },
      { cycleNumber: 2, amountMinor: 100000 },
    ])).toEqual({ cycleNumbers: [1, 2, 3], totalDueMinor: 300000 })
  })
})
