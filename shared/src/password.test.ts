import { describe, it, expect } from 'vitest'
import { generateMemberPassword } from './password.js'

describe('generateMemberPassword', () => {
  it('produces two groups of 4 separated by a dash', () => {
    const pw = generateMemberPassword()
    expect(pw).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
  })

  it('avoids ambiguous characters', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateMemberPassword()).not.toMatch(/[01OIL]/)
    }
  })

  it('is deterministic given a seeded random', () => {
    const seeded = (seed: number) => {
      let n = seed
      return () => {
        n = (n * 7919 + 17) % 1000
        return n / 1000
      }
    }
    expect(generateMemberPassword(seeded(42))).toBe(generateMemberPassword(seeded(42)))
    expect(generateMemberPassword(seeded(42))).not.toBe(generateMemberPassword(seeded(43)))
  })
})
