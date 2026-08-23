import { describe, expect, it } from 'vitest'
import { getCycleStartBlockReason } from './cycleStart.js'

describe('getCycleStartBlockReason', () => {
  it('blocks every cycle until an active member exists', () => {
    expect(getCycleStartBlockReason(0, 1, [])).toBe('no_active_members')
    expect(getCycleStartBlockReason(0, 2, [{ cycleNumber: 1, status: 'active' }])).toBe(
      'no_active_members',
    )
  })

  it('allows the first cycle when an active member exists', () => {
    expect(getCycleStartBlockReason(1, 1, [])).toBeNull()
  })

  it('blocks a later cycle while any earlier cycle is upcoming or missing', () => {
    expect(
      getCycleStartBlockReason(1, 3, [
        { cycleNumber: 1, status: 'active' },
        { cycleNumber: 2, status: 'upcoming' },
      ]),
    ).toBe('previous_cycle_upcoming')
    expect(
      getCycleStartBlockReason(1, 3, [{ cycleNumber: 1, status: 'complete' }]),
    ).toBe('previous_cycle_upcoming')
  })

  it('allows a later cycle when every earlier cycle has started', () => {
    expect(
      getCycleStartBlockReason(2, 3, [
        { cycleNumber: 1, status: 'complete' },
        { cycleNumber: 2, status: 'active' },
      ]),
    ).toBeNull()
  })
})
