# Multi-cycle Payment Reminder Template Replacement

## Goal

Replace the monthly payment reminder templates with reminders that accurately cover one or more pending chit cycles.

## Template contract

Create and approve these Kwic WhatsApp templates:

- `pending_payments_reminder_en`
- `pending_payments_reminder_ta`

Both templates use the same variables:

- `member_name`
- `group_name`
- `pending_cycles`
- `total_due`
- `group_id` as the dynamic ChitPay button URL suffix

The message describes pending cycle contributions and their total. It does not call the contribution monthly and does not require a single due date.

## Rollout

1. Create both new templates and submit them for approval.
2. Keep the existing `payment_reminder_en` and `payment_reminder_ta` templates during approval.
3. Update both backend reminder paths to use the new template contract.
4. Deploy and verify successful delivery through Firebase message logs.
5. Delete the old templates only after the new templates are approved and verified.

## Error handling and verification

The backend continues recording one delivery log with the provider error when sending fails. Repository typecheck and shared tests must pass before deployment. A production reminder is verified only when its Firestore message log reports `sent`.
