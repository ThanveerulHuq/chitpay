# Flexible Payment Cycles Design

## Goal

Replace the monthly, single-current-cycle workflow with a cycle-neutral schedule that supports weekly, biweekly, and monthly groups. Every planned cycle is visible immediately after group creation. Admins may start any cycle before or after its planned date, and multiple cycles may be active at once.

The planned start date is informational. Cycles have no due date and no overdue state.

## Product rules

- Group frequency is `weekly`, `biweekly`, or `monthly`.
- Group creation accepts a start date and cycle count, previews the full schedule, and persists every cycle as a lightweight `upcoming` document.
- Weekly dates advance by 7 days, biweekly dates by 14 days, and monthly dates use month-clamped increments from the original start date.
- An admin may start any upcoming cycle regardless of its planned date or the state of other cycles.
- Starting a cycle snapshots the active members and creates that cycle's payment documents and board.
- Multiple cycles may be active simultaneously.
- After a cycle starts, payment collection, recipient selection, and payout recording are independent activities and may happen in any order.
- Completing a cycle is a separate explicit admin action. It succeeds only when every expected payment is paid, a recipient is selected, and payout is recorded.
- Members may be added until the first cycle is completed. A member added while cycles are active is added as pending to every active cycle.
- After the first cycle completes, group membership is locked.
- The group completes when all planned cycles are complete.
- This is a clean test-mode schema change. No backward compatibility or migration layer is required.

## Data model

### Group

Replace monthly and single-current-cycle fields with cycle-neutral fields:

```ts
type CycleFrequency = 'weekly' | 'biweekly' | 'monthly'

interface GroupDoc {
  adminUid: string
  name: string
  contributionAmountMinor: number
  currency: string
  frequency: CycleFrequency
  cycleCount: number
  startDate: string
  description?: string
  requirePaidToWin: boolean
  status: 'active' | 'completed' | 'archived'
  memberCount: number
  activeCycleCount: number
  completedCycleCount: number
  createdAt: number
}
```

Remove `monthlyAmountMinor`, `dueDay`, `durationMonths`, `currentCycleNumber`, and group-level paid/collected counters. Payment progress belongs to each active cycle.

### Cycle

```ts
interface CycleDoc {
  cycleNumber: number
  plannedStartDate: string
  startedAt: number | null
  completedAt: number | null
  status: 'upcoming' | 'active' | 'complete'
  expectedPaymentCount: number
  recipientMembershipId: string | null
  payout: {
    amountMinor: number
    status: 'pending' | 'paid'
    paidAt: number | null
    recordedBy: string | null
  }
  paidCount: number
  collectedAmountMinor: number
  createdAt: number
}
```

An upcoming cycle is deliberately lightweight: it has schedule and lifecycle metadata but no board or payment subcollection. Those records are created when the cycle starts.

The active state does not encode partial activity ordering. Readiness for completion is derived from payment counts, recipient presence, and payout status.

## Backend operations

### Create group

`createGroup` validates the frequency, start date, contribution, and bounded cycle count. It creates the group and every lightweight cycle document atomically. The schedule generator lives in `shared` so backend behavior and the create-form preview use identical logic.

### Start cycle

Replace `startNextCycle` with `startCycle(groupId, cycleNumber)`.

The transaction:

1. Verifies admin access, active group status, and an `upcoming` cycle.
2. Rejects a start when there are no active members.
3. Snapshots all active membership slots.
4. Creates one pending payment per slot and the board document.
5. Sets the cycle to `active`, records `startedAt`, and stores `expectedPaymentCount`.
6. Increments `activeCycleCount` on the group.
7. Sets the relevant membership mirrors to pending for this cycle's member-facing data flow.

The planned start date remains unchanged when a cycle starts early or late.

### Add member

`addMember` rejects additions when `completedCycleCount > 0`. Before the lock, it creates the membership and adds a pending payment/board entry to every active cycle, incrementing each cycle's `expectedPaymentCount`.

The transaction also changes a group counter or version read by start/complete operations so concurrent member addition cannot leave a cycle with a partial snapshot.

### Cycle activities

Every callable takes an explicit `cycleNumber`; none falls back to a group-level current cycle.

- `markPaid` and reminders require an active cycle.
- `confirmSelection` requires an active cycle and preserves the existing eligibility rules. It does not depend on collection progress.
- `recordPayout` requires an active cycle and a selected recipient, but does not complete the cycle. Payment collection may continue afterward.
- Payment reversal is allowed only while the cycle is active. A completed cycle is immutable.

### Complete cycle

Add `completeCycle(groupId, cycleNumber)` as an explicit operation.

The transaction verifies:

- the cycle is active;
- all expected payment documents exist and are paid;
- `paidCount === expectedPaymentCount`;
- a recipient is selected; and
- payout status is `paid`.

It then marks the cycle complete, records `completedAt`, decrements `activeCycleCount`, and increments `completedCycleCount`. Completing the final outstanding cycle marks the group complete. Transaction conflicts protect concurrent completions and member additions.

## State model

The lifecycle becomes intentionally small:

```text
upcoming -> active -> complete
```

Recipient selection and payout status are facts on an active cycle, not lifecycle states. Payments, selection, and payout can therefore occur in any valid order. Only the completion guard joins those independent activities.

## App experience

### Create group

- Replace duration-in-months and due-day inputs with frequency and cycle count.
- Rename monthly contribution copy to contribution.
- Show a live, numbered preview of all planned cycle dates before submission.

### Admin workspace

- The Cycles tab shows the entire schedule immediately, with `Upcoming`, `Active`, or `Complete` status.
- An admin can open any upcoming cycle and start it, even when other cycles are active.
- Each active cycle detail has its own payment board, recipient selection, payout action, and completion checklist/action.
- The dashboard summarizes and links to all active cycles rather than choosing one current cycle.
- Member addition controls are disabled with an explanation after the first completed cycle.

### Member workspace

- Members see the complete planned schedule.
- Active and completed cycle details expose the existing member-appropriate payment and recipient information.
- No screen displays due dates, overdue badges, or current-month language.

All new or changed UI strings are added to both English and Tamil dictionaries.

## Errors and consistency

- Starting an already-started cycle is rejected without duplicating payment records.
- Starting a cycle with no active members is rejected.
- Planned dates never gate an operation.
- Completion verifies payment documents instead of trusting only denormalized counters.
- Completed cycles reject payment edits/reversals and other lifecycle mutations.
- Group and cycle counter updates happen in the same Firestore transactions as their source changes.
- The cycle-count limit keeps group creation below Firestore batch limits with room for group/access documents.

## Testing and verification

Shared tests cover:

- weekly and biweekly date increments;
- monthly clamping across short months and leap years; and
- the simplified cycle transition rules.

Backend tests cover:

- creation of the complete lightweight schedule;
- early and late starts;
- multiple simultaneous active cycles;
- explicit-cycle payments, selection, payout, and reminders;
- all supported activity orderings;
- adding a member to all active cycles before the lock;
- rejecting member addition after the first completion;
- completion guards and final group completion; and
- rejection of mutations on completed cycles.

App verification covers:

- schedule preview;
- admin and member full-cycle lists;
- navigation among multiple active cycles;
- completion readiness; and
- English/Tamil dictionary completeness.

Before handoff, run:

```bash
npm run typecheck
npm run test:shared
npm run lint --prefix app
```
