# Willing Member Selection Design

## Goal

Limit each cycle's recipient selection to membership slots whose members are willing to participate, while preserving the rule that a person with multiple membership slots may win once per slot.

## Eligibility

A membership slot is eligible when it:

- is active;
- has not already been selected in an earlier cycle; and
- satisfies the group's paid-member requirement, when enabled.

Eligibility remains slot-based. If one person owns two membership slots and one slot has already won, only that slot is excluded; the person's other slot can still participate and win.

## Admin Flow

The active-cycle selection section shows a checklist of eligible membership slots. The admin temporarily ticks the slots willing to participate in that cycle.

- With no willing slots, selection is disabled.
- With one willing slot, that slot is presented as the winner without randomization.
- With two or more willing slots, the existing secure client-side picker chooses among only those slots.
- The admin must confirm the presented winner before the result is permanently recorded.

Willing-slot choices are local UI state. They are intentionally cleared by refresh, navigation, or successful confirmation.

## Backend Validation

Winner confirmation includes the selected membership ID and the complete list of willing membership IDs. Inside the existing Firestore transaction, the backend recalculates eligibility and rejects:

- an empty willing list;
- duplicate willing membership IDs;
- any willing slot that is no longer eligible;
- a selected winner outside the willing list; or
- a second selection for the same cycle.

The backend remains the authority for active status, prior selection, and paid-only eligibility.

## Audit Record

The immutable selection record stores the willing participant membership IDs and their count. These values describe the actual draw pool rather than every member who could theoretically have participated.

Existing audit field names remain compatible: `eligibleMembershipIds` and `eligibleCount` will contain the validated willing draw pool.

## Verification

Cover these cases in automated tests where practical and verify the UI behavior:

- an already-selected slot cannot be ticked or confirmed;
- a second slot owned by the same user remains eligible;
- zero willing slots disables selection;
- one willing slot is presented directly;
- multiple willing slots use random selection;
- paid-only groups exclude unpaid slots; and
- tampered confirmation requests are rejected by the backend.
