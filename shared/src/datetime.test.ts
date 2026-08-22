import { describe, it, expect } from 'vitest'
import { formatDate, formatMonthHeader, isoDateLocal } from './datetime'

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
  it('renders day, short month and year in en-IN', () => {
    const ms = new Date(Date.UTC(2026, 0, 10)).getTime()
    const out = formatDate(ms, 'en-IN')
    expect(out).toContain('2026')
    expect(out).toMatch(/Jan/)
  })

  it('renders Tamil month names for ta-IN', () => {
    const ms = new Date(Date.UTC(2026, 0, 10)).getTime()
    const out = formatDate(ms, 'ta-IN')
    expect(out).toContain('2026')
    expect(out).not.toMatch(/Jan/)
  })
})

describe('formatMonthHeader', () => {
  it('renders long month plus year', () => {
    const ms = new Date(Date.UTC(2026, 4, 2)).getTime()
    expect(formatMonthHeader(ms, 'en-IN')).toMatch(/May 2026/)
  })
})
