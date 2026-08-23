import { describe, expect, it } from 'vitest'
import { validateSelectionParticipants } from './selection.js'

describe('validateSelectionParticipants', () => {
  const eligible = ['slot-a', 'slot-b', 'slot-c']

  it('accepts one or more eligible membership slots', () => {
    expect(validateSelectionParticipants('slot-a', ['slot-a'], eligible)).toBeNull()
    expect(validateSelectionParticipants('slot-b', ['slot-a', 'slot-b'], eligible)).toBeNull()
  })

  it('rejects an empty participant pool', () => {
    expect(validateSelectionParticipants('slot-a', [], eligible)).toBe('empty_participants')
  })

  it('rejects duplicate membership slots', () => {
    expect(validateSelectionParticipants('slot-a', ['slot-a', 'slot-a'], eligible)).toBe(
      'duplicate_participants',
    )
  })

  it('rejects a winner outside the participant pool', () => {
    expect(validateSelectionParticipants('slot-b', ['slot-a'], eligible)).toBe(
      'winner_not_participating',
    )
  })

  it('rejects an ineligible participant without conflating slots owned by one user', () => {
    expect(validateSelectionParticipants('slot-a', ['slot-a', 'already-won-slot'], eligible)).toBe(
      'ineligible_participant',
    )
    expect(validateSelectionParticipants('slot-b', ['slot-b'], eligible)).toBeNull()
  })
})
