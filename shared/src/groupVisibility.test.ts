import { describe, expect, it } from 'vitest'
import { resolveGroupVisibility } from './groupVisibility.js'

describe('group member visibility', () => {
  it('keeps legacy groups visible by default', () => {
    expect(resolveGroupVisibility({})).toEqual({
      showOtherMembers: true,
      showOtherMemberDues: true,
    })
  })

  it('allows the roster without exposing dues', () => {
    expect(resolveGroupVisibility({ showOtherMembers: true, showOtherMemberDues: false })).toEqual({
      showOtherMembers: true,
      showOtherMemberDues: false,
    })
  })

  it('always hides dues when the roster is hidden', () => {
    expect(resolveGroupVisibility({ showOtherMembers: false, showOtherMemberDues: true })).toEqual({
      showOtherMembers: false,
      showOtherMemberDues: false,
    })
  })
})
