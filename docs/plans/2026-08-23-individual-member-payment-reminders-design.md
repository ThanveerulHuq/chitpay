# Individual Member Payment and Reminder Actions

## Goal

Add per-member payment and reminder actions to the Members tab and to member rows inside an active cycle. The Members tab must summarize all pending active-cycle contributions, let an admin choose which pending cycle to record, and send one consolidated reminder covering every pending active cycle.

## Members tab

- Load every active cycle board and derive each member's pending cycle list in ascending cycle-number order.
- Show only the member's total pending amount. Do not show an oldest-cycle label in the row.
- Show Record payment and Send reminder actions only when the group is writable and the member has at least one pending active cycle.
- Record payment opens the existing payment sheet with the member fixed. The sheet adds a selector containing only that member's pending active cycles and defaults to the oldest.
- Changing the selected cycle loads that cycle's board and records the payment against the chosen cycle.
- After a successful payment, refresh the group and pending-cycle data so totals and available actions update.
- Send reminder calls a new server-side member reminder operation and covers all pending active cycles in one message.

## Active cycle detail

- Keep the existing per-member Record payment action fixed to the opened cycle.
- Add a per-member Send reminder action beside it for pending rows.
- The cycle-detail reminder remains cycle-specific and uses the existing reminder operation.
- Paid rows, archived groups, and member/read-only views expose no mutation actions.

## Consolidated reminder backend

Add an admin-only callable that accepts a group and membership ID. The server:

1. Validates authentication, admin access, and group writability.
2. Loads all active cycles and checks the member's payment document in each cycle.
3. Keeps pending payments, sorts them by cycle number, and totals their integer minor-unit amounts.
4. Returns a harmless no-pending result if a concurrent payment cleared the debt.
5. Resolves the member's phone and language and sends one localized `pending_payments_reminder` Kwic template.
6. Passes the pending cycle list/count and formatted total due to the provider template.
7. Writes one message log containing all included cycle numbers and returns the sent count, pending-cycle count, and total due.

The existing cycle reminder callable remains unchanged for cycle-detail actions.

## Messaging and localization

- Add `pending_payments_reminder` to the shared message-template type.
- Extend template variables with the pending-cycle list and count.
- Add English and Tamil fallback renderings and tests.
- Add matching English and Tamil UI strings for total pending, reminder/payment labels, cycle selection, and transient failures.
- Kwic must have approved `pending_payments_reminder_en` and `pending_payments_reminder_ta` templates with the same named variables before the consolidated reminder is usable in production.

## Error handling

- Disable only the member action currently in progress.
- Display reminder or payment-loading failures contextually on the page or in the sheet.
- Treat a no-longer-pending race as success and refresh the member data.
- Keep all amounts in integer minor units.

## Verification

- Shared tests cover consolidated English and Tamil reminder text.
- App typechecking verifies bilingual dictionary completeness and sheet props.
- Run `npm run typecheck`, `npm run test:shared`, `npm run lint --prefix app`, and `git diff --check`.
- Preserve unrelated in-progress workspace changes.
