import { describe, it, expect } from 'vitest'
import { toMinor, fromMinor, formatMinor } from './currency'

describe('currency', () => {
  it('converts major to minor without float drift', () => {
    expect(toMinor(10000)).toBe(1000000)
    expect(toMinor(0.1 + 0.2)).toBe(30)
  })

  it('rounds fractional paise deterministically', () => {
    expect(toMinor(10.555)).toBe(1056)
  })

  it('round-trips', () => {
    expect(fromMinor(toMinor(1234.56))).toBeCloseTo(1234.56)
  })

  it('formats whole-rupee amounts without decimals', () => {
    expect(formatMinor(20000000)).toMatch(/2,00,000/)
  })

  it('formats paise with decimals', () => {
    expect(formatMinor(1050)).toMatch(/10\.50/)
  })
})
