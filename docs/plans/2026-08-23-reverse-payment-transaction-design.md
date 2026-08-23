# Reverse Payment Transaction Fix Design

## Goal

Restore payment reversal from Admin Group Reports without weakening the atomic consistency of payment, board, counter, membership mirror, and audit-event updates.

## Confirmed cause

The deployed `reversePayment` callable writes the payment document before reading the cycle board. Firestore transactions require all reads to complete before the first write, so the SDK rejects the transaction and the callable returns an `internal` error. The transaction aborts without committing partial changes.

`editPayment` contains the same read-after-write ordering defect and should be corrected with the same change.

## Approach

Keep each operation in its existing single Firestore transaction. Read the group, cycle or member data required by the operation, payment, and board before constructing and applying writes. After validation, write the payment, optional board update, counters and mirrors where applicable, and payment audit event.

This is an ordering-only repair. It does not change schemas, authorization, business rules, callable inputs, UI behavior, or error contracts.

## Error handling and data integrity

Domain validation continues to use `AppError` and `toHttpsError`. Unexpected SDK errors continue to be logged and returned as `internal`. Keeping all mutations in one transaction ensures either every reversal/edit update commits or none do.

## Verification

- Run the repository typecheck.
- Run shared unit tests.
- Inspect the final diff to confirm every transaction read precedes its first write.
- Because the project has no local Firebase emulator, confirm the deployed callable end to end after deployment and check its production logs if it fails.
