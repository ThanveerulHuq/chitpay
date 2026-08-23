# Flexible Payment Cycles Implementation Plan

## Objective

Implement the approved flexible-cycle design as a clean schema change: persist the full weekly, biweekly, or monthly schedule at group creation; allow any number of cycles to be active; make cycle activities independently orderable; and require an explicit guarded completion action.

## 1. Shared domain model and schedule generator

Files:

- `shared/src/types.ts`
- `shared/src/stateMachine.ts`
- `shared/src/schedule.ts` (new)
- `shared/src/schedule.test.ts` (new)
- `shared/src/index.ts`

Changes:

1. Add `CycleFrequency` and replace monthly/single-current-cycle fields in `GroupDoc` with the approved cycle-neutral fields.
2. Simplify `CycleStatus` to `upcoming | active | complete` and update `CycleDoc` with planned/start/completion timestamps and expected-payment count.
3. Reduce the state machine to `upcoming -> active -> complete`.
4. Add a pure `generateCycleSchedule(startDate, frequency, cycleCount)` helper using UTC-safe 7-day, 14-day, and month-clamped calculations.
5. Export the schedule helper and types.
6. Test normal increments, month-end clamping, leap years, invalid inputs, and state transitions.

Verification:

```bash
npm run test:shared
npm run build --prefix shared
```

## 2. Group creation and membership locking

Files:

- `functions/src/groups.ts`

Changes:

1. Change `CreateGroupInput` validation to accept `contributionAmountMinor`, `frequency`, `cycleCount`, and `startDate`; remove due-day/month fields.
2. Generate the complete planned schedule with the shared helper.
3. Use a Firestore batch to create the group, admin access marker, and all lightweight upcoming cycle documents in one commit.
4. Bound cycle count so the batch remains safely below Firestore's write limit.
5. In `addMember`, reject when `completedCycleCount > 0`.
6. Within the membership transaction, query every active cycle and add the new membership as a pending payment/board entry to each one, incrementing its expected-payment count.
7. Store contribution-neutral data in membership mirrors.

Verification:

- Build functions after rebuilding shared.
- Review all transaction reads occur before writes.

## 3. Independent cycle lifecycle callables

Files:

- `functions/src/cycles.ts`
- `functions/src/selection.ts`
- `functions/src/payout.ts`
- `functions/src/index.ts`

Changes:

1. Replace `startNextCycle` with `startCycle(groupId, cycleNumber)`.
2. Start any upcoming cycle by snapshotting active members, creating its pending payments/board, setting `expectedPaymentCount`, and incrementing the group's active-cycle count.
3. Require explicit `cycleNumber` in payment and reminder inputs; reject operations unless that cycle is active.
4. Update selection to target an explicit active cycle. Keep eligibility rules but remove collection-progress/lifecycle ordering assumptions.
5. Change payout recording to target an explicit active cycle, update only payout facts, and leave the cycle active.
6. Add `completeCycle(groupId, cycleNumber)`. Read all cycle payments before writes, verify every expected payment is paid plus recipient and payout readiness, then update cycle and group counters atomically.
7. Reject payment edits and reversals on completed cycles.
8. Mark the group complete when `completedCycleCount + 1 === cycleCount`.
9. Export the new callables and remove the old start-next export.

Verification:

```bash
npm run build --prefix shared
npm run build --prefix functions
```

## 4. Client API and group creation UI

Files:

- `app/src/lib/api.ts`
- `app/src/pages/admin/CreateGroupPage.tsx`
- `app/src/i18n/en.ts`
- `app/src/i18n/ta.ts`

Changes:

1. Update create-group payload types and callable wrappers for start, payout, selection, and completion with explicit cycle numbers.
2. Replace duration-month/due-day controls with frequency and cycle-count controls.
3. Use the shared schedule generator for a live numbered planned-date preview.
4. Rename monthly contribution copy to cycle-neutral contribution copy.
5. Add matching English and Tamil strings for frequency, schedule preview, planned dates, statuses, and completion readiness.

Verification:

- Exercise all three preview frequencies in the UI.
- Confirm Tamil dictionary type completeness through app build.

## 5. Admin multi-cycle workspace

Files:

- `app/src/pages/admin/GroupShell.tsx`
- `app/src/pages/admin/GroupDashboardPage.tsx`
- `app/src/pages/admin/GroupCyclesPage.tsx`
- `app/src/pages/admin/GroupCycleDetailPage.tsx`
- `app/src/pages/admin/GroupMembersPage.tsx`
- `app/src/components/PaymentSheet.tsx`
- `app/src/components/LoadingScreens.tsx`

Changes:

1. Remove all `currentCycleNumber`, due-date, overdue, and month assumptions.
2. Make the Cycles tab list every persisted cycle ordered by cycle number with planned date and status.
3. Let an admin open and start any upcoming cycle.
4. Load payment boards only for active or completed cycles.
5. Keep every payment action scoped to the detail page's explicit cycle number.
6. Show recipient selection, payout recording, and payment collection independently on active cycle details.
7. Add a completion checklist and explicit Complete Cycle button, enabled only when all three readiness conditions are met.
8. Summarize all active cycles on the dashboard with links instead of rendering a single current cycle.
9. Disable member-add controls after the first completed cycle and explain the lock.
10. Update skeletons where the page structure changes.

Verification:

- Inspect states with zero, one, and multiple active cycles.
- Confirm upcoming cycles have no payment controls.
- Confirm completed cycles are read-only.

## 6. Member schedule and payment views

Files:

- `app/src/pages/member/MemberGroupView.tsx`
- `app/src/components/PaymentHistoryList.tsx`
- `app/src/lib/api.ts`

Changes:

1. Replace the single-current-cycle member presentation with the complete cycle schedule.
2. Show planned date and status without due/overdue language.
3. Show member-appropriate details for active and completed cycles and preserve payment history across explicit cycle numbers.
4. Update contribution labels and cycle headings.

Verification:

- Confirm members see all upcoming, active, and completed cycles.
- Confirm member views expose no admin mutation controls.

## 7. Repository-wide cleanup and final verification

Files:

- `shared/src/templates.ts`
- `shared/src/templates.test.ts`
- `Mobile-First Chit Group Management App — PRD.md` only if product documentation is expected to reflect the implemented behavior
- Any remaining files found by repository-wide searches

Changes:

1. Remove due-date/overdue template dependencies or convert reminders to cycle-neutral contribution reminders.
2. Search for and remove stale schema and copy references: `monthlyAmountMinor`, `dueDay`, `durationMonths`, `currentCycleNumber`, `monthNumber`, `dueDate`, `overdue`, and `startNextCycle`.
3. Confirm no client-side Firestore writes were introduced.
4. Review transaction ordering and completed-cycle immutability.

Final verification:

```bash
npm run typecheck
npm run test:shared
npm run lint --prefix app
git diff --check
```

## Delivery sequence

Implement in the numbered order. Shared types intentionally break downstream builds first; rebuild `shared` before checking functions, then update the app. Keep backend and client callable renames in the same delivery so no compiled client path targets removed functions.
