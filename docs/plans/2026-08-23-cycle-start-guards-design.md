# Cycle Start Guards Design

## Goal

Prevent an admin from starting a cycle before the group has an active member, and prevent cycles from being started out of sequence. A previous cycle only needs to have started; it does not need to be complete.

## Product rules

- A cycle cannot start while the group has no active members.
- Cycle 1 can start as soon as at least one active member exists.
- Cycle N can start only when every earlier cycle is `active` or `complete`.
- A previous active cycle does not block the next cycle, so multiple cycles may remain active simultaneously.
- Planned start dates remain informational and do not gate cycle starts.
- Admins should see member-required guidance when no active member exists. Later cycles that are waiting on earlier cycles remain disabled without an additional description.

## Backend enforcement

The `startCycle` callable remains the authority. Inside its Firestore transaction it will:

1. Validate the group, admin access, group lifecycle, requested cycle number, and upcoming cycle status as it does today.
2. Verify that the group has at least one active member.
3. For cycle numbers greater than 1, read every earlier cycle and reject the start if any earlier cycle is missing or still `upcoming`.
4. Snapshot active members and create the board and payment records only after all guards pass.

The ordering check happens in the same transaction as the status update, so concurrent attempts cannot bypass the sequence.

## App experience

Both the cycles list and an upcoming cycle's detail page derive the same availability rules from the loaded members and cycles:

- With no active members, the start action is disabled and guidance asks the admin to add a member.
- If an earlier cycle is still upcoming, the start action is disabled without an additional description.
- When the rules are satisfied, the existing start action remains available.
- Read-only and member views continue to hide start actions.

New guidance is added to both English and Tamil dictionaries.

The app-side checks improve clarity but do not replace backend enforcement. If state changes between rendering and the click, the callable returns the authoritative error.

## Verification

- Confirm the backend rejects a start with zero active members.
- Confirm Cycle 2 cannot start while Cycle 1 is upcoming.
- Confirm Cycle 2 can start while Cycle 1 is active or complete.
- Confirm later cycles cannot skip any earlier upcoming cycle.
- Confirm list and detail views disable unavailable starts and display localized guidance.
- Run `npm run typecheck`, `npm run test:shared`, and `npm run lint --prefix app`.
