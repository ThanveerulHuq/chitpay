# Individual Member Payment and Reminder Implementation Plan

## 1. Shared messaging contract

- Add the consolidated reminder template ID and variables.
- Render English and Tamil consolidated reminder fallbacks.
- Add unit tests for cycle lists, counts, and total amounts.

## 2. Backend callable

- Add `sendMemberReminder(groupId, membershipId)` in the cycle functions.
- Discover pending payments across all active cycles on the server.
- Send one localized template and write one multi-cycle message log.
- Export the callable from the functions entrypoint.

## 3. Client data and payment sheet

- Add the callable wrapper.
- Derive pending active cycles per member from active boards.
- Extend the payment sheet with an optional pending-cycle selector while preserving fixed-cycle use from cycle detail.

## 4. Member-row actions

- Show total pending plus Record payment and Send reminder actions in the Members tab.
- Add the cycle-specific individual reminder beside Record payment in active cycle member rows.
- Add bilingual action, status, and error strings.

## 5. Verification

- Run repository typecheck, shared tests, app lint, and diff validation.
- Review the final diff for accidental overlap with unrelated working-tree changes.
