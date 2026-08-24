import { describe, it, expect } from 'vitest'
import { formatDate, formatIsoDate, formatMonthHeader, isoDateLocal } from './datetime'

describe('isoDateLocal', () => {
  it('formats a local timestamp as YYYY-MM-DD', () => {
    const ms = new Date(2026, 0, 15, 10, 30).getTime()
    expect(isoDateLocal(ms)).toBe('2026-01-15')
  })

  it('pads month and day', () => {
    const ms = new Date(2026, 2, 5, 0, 5).getTime()
    expect(isoDateLocal(ms)).toBe('2026-03-05')
  })
})

describe('formatDate', () => {
  it('renders a timestamp as DD-MM-YYYY', () => {
    const ms = new Date(2026, 0, 10).getTime()
    expect(formatDate(ms, 'en-IN')).toBe('10-01-2026')
  })

  it('uses the same numeric format for every locale', () => {
    const ms = new Date(2026, 10, 9).getTime()
    expect(formatDate(ms, 'ta-IN')).toBe('09-11-2026')
  })
})

describe('formatIsoDate', () => {
  it('converts an ISO date to DD-MM-YYYY', () => {
    expect(formatIsoDate('2026-08-24')).toBe('24-08-2026')
  })

  it('leaves non-ISO values unchanged', () => {
    expect(formatIsoDate('')).toBe('')
  })
})

describe('formatMonthHeader', () => {
  it('renders long month plus year', () => {
    const ms = new Date(Date.UTC(2026, 4, 2)).getTime()
    expect(formatMonthHeader(ms, 'en-IN')).toMatch(/May 2026/)
  })
})
