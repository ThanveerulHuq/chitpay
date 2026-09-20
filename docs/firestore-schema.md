# ChitPay Firestore Schema

This is the canonical reference for the Firestore database used by ChitPay. The TypeScript domain interfaces live in [`shared/src/types.ts`](../shared/src/types.ts); this document also covers operational documents and subcollections that are not exported as shared types.

## Conventions

- Firebase project and Firestore database ID: `chitpay`.
- Money is stored as integer paise values. INR is a system constant and is not persisted in Firestore.
- Dates such as `startDate` and `plannedStartDate` use `YYYY-MM-DD` strings.
- Firestore timestamps are written with `serverTimestamp()`. Shared interfaces currently type them as `number` for application consumption.
- Phone numbers are normalized digits with country code, for example `919751000085`.
- All Firestore writes are performed by callable functions or trusted local scripts. Client writes are denied.
- `providerId` is the canonical ownership boundary. `groups.adminUid` is temporary migration compatibility data.

## Collection Tree

```text
providers/{providerId}
└── admins/{uid}

users/{uid}
├── memberships/{membershipId}
├── groupAccess/{groupId}
└── messages/{messageId}

groups/{groupId}
├── members/{membershipId}
├── paymentEvents/{eventId}
├── selections/{selectionId}
└── cycles/{cycleNumber}
    ├── payments/{membershipId}
    └── board/board

otps/{phone}
loginLinkRequests/{phone}
```

## Providers and Administrators

### `providers/{providerId}`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `name` | string | yes | Display name of the chit provider. |
| `language` | `'en' \| 'ta'` | yes | Shared admin UI language and fallback language for provider messages. |
| `status` | `'active' \| 'inactive'` | yes | Only active providers pass authorization. |
| `appIcon` | object | no | Provider PWA icon: WebP `image192`/`image512` base64 payloads plus a cache-busting `version`. Missing means the default ChitPay icon. |
| `createdBy` | UID | yes | Administrator who created or originally owned the provider. |
| `createdAt` | timestamp | yes | Creation time. |
| `updatedAt` | timestamp | no | Last provider-name update. |

### `providers/{providerId}/admins/{uid}`

The document ID is the administrator's Firebase Auth UID. Every administrator has equal provider permissions.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `uid` | UID | yes | Must equal the document ID. |
| `addedBy` | UID | yes | Administrator who granted access. Self for initial provisioning/migration. |
| `createdAt` | timestamp | yes | Access grant time. |

Provider authorization requires all of the following:

1. `users/{uid}.roles` contains `admin`.
2. `users/{uid}.providerId` equals the provider.
3. `providers/{providerId}/admins/{uid}` exists.
4. `providers/{providerId}.status` is `active`.

## Users and Access Mirrors

### `users/{uid}`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `name` | string | yes | Account-wide display name. |
| `phone` | string | yes | Normalized phone number and login identifier. |
| `roles` | `('admin' \| 'member')[]` | yes | An account may have both roles. |
| `providerId` | provider ID | admin only | An administrator belongs to exactly one provider. Removed when their provider access is revoked. |
| `language` | `'en' \| 'ta'` | no | Personal member preference. It is ignored for provider-admin settings, which use `providers/{providerId}.language`. |
| `createdAt` | timestamp | yes | Account profile creation time. |
| `updatedAt` | timestamp | no | Last account profile update. |
| `lastLoginAt` | timestamp | no | Most recent successful OTP, WhatsApp link, or password login recorded by the application. |

Firebase Auth uses a synthetic email, `{normalizedPhone}@phone.chitapp.app`, while Firestore stores the user profile above.

### `users/{uid}/memberships/{membershipId}`

Member-facing mirror of a group membership slot. The document ID matches `groups/{groupId}/members/{membershipId}`.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `groupId` | group ID | yes | Parent group. |
| `providerId` | provider ID | no | Denormalized provider used for branding. Older mirrors resolve it through the group document. |
| `groupName` | string | yes | Denormalized group name. |
| `membershipId` | membership ID | yes | Must equal the document ID. |
| `contributionAmountInPaise` | positive integer | yes | Denormalized contribution per slot per cycle, in paise. For example, ₹5,000 is stored as `500000`. |
| `status` | `'active' \| 'inactive'` | yes | Mirrors the group membership slot. |
| `selectedInCycle` | integer or null | yes | Cycle where this specific slot was selected as recipient. A user with multiple slots has one value per membership document. |
| `joinedAt` | timestamp | yes | Membership creation time. |

### `users/{uid}/groupAccess/{groupId}`

Read-access marker and membership index.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `membershipIds` | string[] | yes | All membership slots the user owns in this group. Legacy group owners may have an empty array. |

### `users/{uid}/messages/{messageId}`

Audit record for every WhatsApp delivery attempt addressed to this user. Keeping login and group messages together makes the user's delivery history queryable without knowing a group.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `recipientUid` | UID | yes | Must match the parent user. |
| `groupId` | group ID or null | yes | Related group; null for login and provider-level messages. |
| `cycleNumber` | integer | no | Primary related cycle. |
| `cycleNumbers` | integer[] | no | Used by consolidated reminders. |
| `template` | message template | yes | One of the templates defined by `MessageTemplate`. |
| `toPhone` | string | yes | Normalized destination number used for this attempt. |
| `membershipId` | membership ID or null | yes | Related slot, when applicable. |
| `providerMessageId` | string or null | yes | External messaging-provider identifier. |
| `status` | `'queued' \| 'sent' \| 'delivered' \| 'read' \| 'failed'` | yes | Delivery state. |
| `error` | string or null | yes | Provider error when delivery fails. |
| `sentBy` | UID or null | yes | Acting administrator; null for automated login messages. |
| `createdAt` | timestamp or epoch milliseconds | yes | Attempt creation time. |
| `updatedAt` | timestamp or epoch milliseconds | yes | Latest known status time. |

Message template values are `login_code`, `login_link`, `login_access`, `member_invite`, `payment_reminder`, `pending_payments_reminder`, `recipient_notification`, and `payout_confirmation`.

## Groups

### `groups/{groupId}`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `providerId` | provider ID | canonical | Provider that owns and administers the group. |
| `adminUid` | UID | legacy only | Temporary compatibility field until provider migration cleanup. |
| `name` | string | yes | Group display name. |
| `contributionAmountInPaise` | positive integer | yes | Contribution per membership slot per cycle, in paise. For example, ₹5,000 is stored as `500000`. |
| `frequency` | `'weekly' \| 'biweekly' \| 'monthly'` | yes | Cycle schedule frequency. |
| `cycleCount` | integer | yes | Total planned cycles, from 1 to 100. |
| `startDate` | date string | yes | First planned cycle date. |
| `description` | string | no | Optional group description. |
| `showOtherMembers` | boolean | no | Missing legacy value is treated as `true`. |
| `showOtherMemberDues` | boolean | no | Missing legacy value is treated as `true`; disabled when member visibility is disabled. |
| `status` | `'active' \| 'completed' \| 'archived'` | yes | Group lifecycle state. |
| `statusBeforeArchive` | `'active' \| 'completed'` | archived only | State restored during unarchive. |
| `archivedAt` | timestamp | archived only | Archive time. |
| `archivedBy` | UID | archived only | Administrator who archived the group. |
| `memberCount` | integer | yes | Number of active membership slots, not unique people. |
| `activeCycleCount` | integer | yes | Denormalized active-cycle count. |
| `completedCycleCount` | integer | yes | Denormalized completed-cycle count. |
| `createdAt` | timestamp | yes | Creation time. |

### `groups/{groupId}/members/{membershipId}`

Each document is one chit slot. A user may own multiple slots in the same group.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `uid` | UID | yes | Account that owns the slot. |
| `slotNo` | integer | yes | Stable sequential slot number. |
| `displayName` | string | yes | Name assigned to this share. Slots owned by one UID may use different names when a mobile login is shared. |
| `status` | `'active' \| 'inactive'` | yes | Slot lifecycle state. |
| `selectedInCycle` | integer or null | yes | Recipient cycle for this specific chit slot. If one user owns three shares, they have three membership documents and each slot is selected independently. |
| `totalContributedMinor` | integer | yes | Denormalized lifetime paid amount. |
| `paidCycleCount` | integer | yes | Denormalized number of paid cycles. |
| `joinedAt` | timestamp | yes | Slot creation time. |

## Cycles, Payments, and Board

### `groups/{groupId}/cycles/{cycleNumber}`

The document ID is the string form of `cycleNumber`.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `cycleNumber` | integer | yes | 1-based cycle number. |
| `plannedStartDate` | date string | yes | Scheduled start date. |
| `startedAt` | timestamp or null | yes | Actual start time. |
| `completedAt` | timestamp or null | yes | Completion time. |
| `status` | `'upcoming' \| 'active' \| 'complete'` | yes | Cycle lifecycle state. |
| `expectedPaymentCount` | integer | yes | Number of membership-slot payments expected. |
| `recipientMembershipId` | membership ID or null | yes | Selected payout recipient slot. |
| `payout.amountMinor` | integer | yes | Payout amount. |
| `payout.status` | `'pending' \| 'paid'` | yes | Payout state. |
| `payout.paidAt` | timestamp or null | yes | Payout time. |
| `payout.recordedBy` | UID or null | yes | Acting administrator. |
| `paidCount` | integer | yes | Denormalized number of paid slots. |
| `collectedAmountMinor` | integer | yes | Denormalized collected total. |
| `createdAt` | timestamp | yes | Creation time. |

### `groups/{groupId}/cycles/{cycleNumber}/payments/{membershipId}`

One payment state per expected membership slot.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `amountMinor` | integer | yes | Expected or paid amount. |
| `status` | `'pending' \| 'paid'` | yes | Current payment state. |
| `method` | `'cash' \| 'upi' \| 'bank_transfer' \| 'other'` or null | yes | Payment method. |
| `referenceNo` | string or null | yes | Optional payment reference. |
| `note` | string or null | yes | Optional administrator note. |
| `paidAt` | timestamp or null | yes | Payment recording time. |
| `recordedBy` | UID or null | yes | Administrator who recorded payment. |
| `updatedAt` | timestamp or null | no | Last edit/reversal time. |

### `groups/{groupId}/paymentEvents/{eventId}`

Immutable audit trail for payment changes.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `groupId` | group ID | yes | Must match the parent group. |
| `cycleNumber` | integer | yes | Related cycle and the main query/filter key. |
| `membershipId` | membership ID | yes | Related payment document. |
| `type` | `'recorded' \| 'edited' \| 'reversed'` | yes | Audit event type. |
| `before` | payment snapshot or null | yes | State before the operation. |
| `after` | payment snapshot or null | yes | State after the operation. |
| `reason` | string or null | yes | Required by operations that collect a reason. |
| `performedBy` | UID | yes | Acting administrator. |
| `createdAt` | timestamp | yes | Event time. |

A payment snapshot contains `status`, `amountMinor`, `method`, `referenceNo`, `note`, and `paidAt`.

### `groups/{groupId}/cycles/{cycleNumber}/board/board`

Materialized collection board for fast UI reads.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `entries` | board entry[] | yes | One entry per active expected membership slot. |

Each board entry contains `membershipId`, denormalized member `name`, payment `status`, and payment `method`.

### `groups/{groupId}/selections/{selectionId}`

Immutable recipient-selection audit.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `groupId` | group ID | yes | Must match the parent group. |
| `cycleNumber` | integer | yes | Related cycle. |
| `selectedMembershipId` | membership ID | yes | Winning slot. |
| `selectedMemberName` | string | yes | Denormalized winner name. |
| `eligibleMembershipIds` | string[] | yes | Participant snapshot supplied at confirmation. |
| `eligibleCount` | integer | yes | Participant count. |
| `performedBy` | UID | yes | Acting administrator. |
| `poolAmountMinor` | integer | yes | Pool amount at selection time. |
| `selectedAt` | timestamp | yes | Selection time. |

## Global Operational Collections

### `otps/{phone}`

Temporary OTP challenge keyed by normalized phone number.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `codeHash` | string | yes | SHA-256 hash; cleared after lockout. |
| `expiresAt` | epoch milliseconds | yes | Expiry time. |
| `attempts` | integer | yes | Failed verification count. |
| `lastSentAt` | epoch milliseconds | yes | Resend throttle timestamp. |
| `message` | object | no | Temporary delivery metadata for the OTP WhatsApp attempt. Copied into `users/{uid}/messages` after successful verification. |

The document is deleted after successful verification. Before verification there may be no Firebase UID, so OTP delivery metadata cannot yet be stored beneath a user. Failed or abandoned OTP attempts remain only on the temporary OTP document and may be replaced by a later request.

### `loginLinkRequests/{phone}`

Rate-limit marker keyed by normalized phone number.

| Field | Type | Required | Notes |
|---|---|---:|---|
| `lastSentAt` | epoch milliseconds | yes | Last WhatsApp login-link request time. |

## Relationship and Consistency Rules

- A provider has many admins and groups; an admin belongs to one provider.
- Every provider must retain at least one administrator.
- A group belongs to one provider after migration.
- A user may own multiple membership slots in a group. `selectedInCycle` is tracked independently on each slot, so selecting one share does not mark the user's other shares as selected.
- A user's phone remains account-wide and unique, while member lists derive the user's visible names from the unique `displayName` values on their slots.
- Membership changes must update the group member document, user membership mirror, group-access marker, active-cycle payments, and board entries together.
- Payment mutations update the payment document, board, cycle totals, member totals, and a group-level immutable payment event in one transaction.
- Selection mutations update the cycle recipient, group member, user mirror, and group-level immutable selection audit in one transaction.
- Denormalized counters and display fields are maintained by Cloud Functions; clients must not write them directly.

## Migration Note

Provider migration is staged. During compatibility rollout, a group may contain either canonical `providerId` or legacy `adminUid`. Follow the [provider migration runbook](plans/provider-migration-runbook.md). The separate schema-v2 migration copies renamed amount fields, user message history, group-level payment events and selections, and Auth last-login metadata before legacy fields are removed; follow the [schema-v2 migration runbook](plans/schema-v2-migration-runbook.md).
