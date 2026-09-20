import { describe, expect, it } from 'vitest'
import { addMonthsClamped, generateCycleSchedule, isStartDateEditable, isValidIsoDate } from './schedule.js'

describe('isValidIsoDate', () => {
  it('accepts real calendar dates in ISO format', () => {
    expect(isValidIsoDate('2026-08-23')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
  })

  it('rejects incomplete, malformed, and impossible dates', () => {
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate('2026-08')).toBe(false)
    expect(isValidIsoDate('23/08/2026')).toBe(false)
    expect(isValidIsoDate('2026-02-30')).toBe(false)
  })
})

describe('generateCycleSchedule', () => {
  it('generates weekly dates', () => {
    expect(generateCycleSchedule('2026-08-23', 'weekly', 3)).toEqual([
      '2026-08-23',
      '2026-08-30',
      '2026-09-06',
    ])
  })

  it('generates biweekly dates', () => {
    expect(generateCycleSchedule('2026-08-23', 'biweekly', 3)).toEqual([
      '2026-08-23',
      '2026-09-06',
      '2026-09-20',
    ])
  })

  it('clamps every monthly date to the original anchor day', () => {
    expect(generateCycleSchedule('2024-01-31', 'monthly', 4)).toEqual([
      '2024-01-31',
      '2024-02-29',
      '2024-03-31',
      '2024-04-30',
    ])
  })

  it('rejects invalid inputs', () => {
    expect(() => generateCycleSchedule('2026-02-30', 'weekly', 2)).toThrow()
    expect(() => generateCycleSchedule('2026-02-01', 'weekly', 0)).toThrow()
  })
})

describe('addMonthsClamped', () => {
  it('handles non-leap February', () => {
    expect(addMonthsClamped('2025-01-31', 1)).toBe('2025-02-28')
  })
})

describe('isStartDateEditable', () => {
  it('allows edits while the first cycle is upcoming', () => {
    expect(isStartDateEditable([
      { cycleNumber: 1, status: 'upcoming' },
      { cycleNumber: 2, status: 'upcoming' },
    ])).toBe(true)
  })

  it('blocks edits once the first cycle leaves upcoming', () => {
    expect(isStartDateEditable([
      { cycleNumber: 1, status: 'active' },
      { cycleNumber: 2, status: 'upcoming' },
    ])).toBe(false)
    expect(isStartDateEditable([
      { cycleNumber: 1, status: 'complete' },
      { cycleNumber: 2, status: 'complete' },
    ])).toBe(false)
    expect(isStartDateEditable([])).toBe(false)
    expect(isStartDateEditable([{ cycleNumber: 2, status: 'upcoming' }])).toBe(false)
  })
})
