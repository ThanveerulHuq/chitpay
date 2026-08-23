import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition } from './stateMachine.js'

describe('cycle state machine', () => {
  it('allows only upcoming to active to complete', () => {
    expect(canTransition('upcoming', 'active')).toBe(true)
    expect(canTransition('active', 'complete')).toBe(true)
    expect(canTransition('upcoming', 'complete')).toBe(false)
    expect(canTransition('complete', 'active')).toBe(false)
  })

  it('rejects skipped transitions', () => {
    expect(() => assertTransition('upcoming', 'complete')).toThrow(
      'Invalid cycle transition: upcoming -> complete',
    )
  })
})
