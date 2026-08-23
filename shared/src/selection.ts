export type SelectionParticipantValidationError =
  | 'empty_participants'
  | 'duplicate_participants'
  | 'winner_not_participating'
  | 'ineligible_participant'

/** Validates the exact membership-slot pool submitted for a recipient draw. */
export function validateSelectionParticipants(
  selectedMembershipId: string,
  participantMembershipIds: string[],
  eligibleMembershipIds: Iterable<string>,
): SelectionParticipantValidationError | null {
  if (participantMembershipIds.length === 0) return 'empty_participants'

  const participantIds = new Set(participantMembershipIds)
  if (participantIds.size !== participantMembershipIds.length) return 'duplicate_participants'
  if (!participantIds.has(selectedMembershipId)) return 'winner_not_participating'

  const eligibleIds = new Set(eligibleMembershipIds)
  if (participantMembershipIds.some((membershipId) => !eligibleIds.has(membershipId))) {
    return 'ineligible_participant'
  }

  return null
}
