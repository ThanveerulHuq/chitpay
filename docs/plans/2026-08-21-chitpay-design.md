# ChitPay — Technical Design

Date: 2026-08-21
Source: [Mobile-First Chit Group Management App — PRD](../../Mobile-First%20Chit%20Group%20Management%20App%20—%20PRD.md)

## 1. Stack & Structure

- **Frontend:** Vite + React SPA, TypeScript, Tailwind CSS, React Router; PWA via `vite-plugin-pwa`; static hosting on Firebase Hosting
- **Backend:** Firestore, Firebase Auth (custom tokens), Callable Cloud Functions (TypeScript)
- **Local dev:** Firebase Emulator Suite (Auth + Firestore + Functions)

```
chitapp/
├── src/              # React app
├── shared/           # Domain types, state machine, templates (used by app AND functions)
├── functions/        # Callable Cloud Functions (TS)
├── firestore.rules
└── firebase.json     # Hosting + emulator config
```

Currency stored as integer minor units everywhere; formatted only at render.

## 2. Data Model (Firestore)

```
users/{uid}
  name, phone, roles: ["admin" | "member"]

users/{uid}/memberships/{membershipId}
  groupId, groupName, monthlyAmountMinor, currency, status,
  myPaymentStatus: pending|paid|overdue|null, selectedInCycle?, joinedAt

groups/{gid}
  adminUid, name, monthlyAmountMinor, currency, dueDay,
  durationMonths, startDate, description, requirePaidToWin,
  status: active|completed|archived, currentCycleNumber,
  memberCount, paidCount, collectedAmountMinor   # denormalized counters

groups/{gid}/members/{membershipId}      # displayName ONLY — no phone numbers
  uid, slotNo, displayName, status: active|inactive, selectedInCycle?

groups/{gid}/cycles/{cycleNumber}
  monthNumber, periodStart, dueDate,
  status: upcoming → payment_open → collection_complete
        → recipient_selected → payout_recorded → complete,
  recipientMembershipId?,
  payout { amountMinor, status, paidAt?, recordedBy? }

groups/{gid}/cycles/{n}/payments/{membershipId}
  amountMinor, status: pending|paid,
  method: cash|upi|bank_transfer|other, referenceNo?, note?,
  paidAt?, recordedBy?

groups/{gid}/cycles/{n}/board            # denormalized payment board
  entries: [{ membershipId, name, status, method }]

groups/{gid}/messages/{id}               # WhatsApp delivery log (immutable)

otps/{phone}                             # code hash, expiry, attempt count

selections/{selectionId}                 # top-level, immutable audit record
  groupId, cycleNumber, selectedMembershipId, eligibleMemberIds[],
  eligibleCount, performedBy, selectedAt
```

### Key decisions

1. **Multiple memberships per group** — a person can hold two or more slots in the same group. Membership has its own ID decoupled from `uid`; payments, eligibility and selection all operate per `membershipId`.
2. **Privacy by location** — phones live only on `users/{uid}` (unreadable by members). Group docs carry `displayName` only; Firestore rules cannot mask fields, so separation-by-location enforces "no phone display".
3. **Denormalized counters/board** — dashboards read one document; `board` renders the full payment view for both admin and members.
4. **Member-side mirrors** (`users/{uid}/memberships/*`) power My Groups in one read; updated only inside the same transactions as source-of-truth writes.
5. **Overdue is derived** at render time (pending past dueDate) — no cron jobs.
6. **Selection audit record is immutable**, written once in the confirming transaction.

## 3. Auth — WhatsApp OTP primary, password fallback

Firebase native phone auth does SMS only, so auth is custom:

```
requestOtp(phone)       → 6-digit code, hash stored in otps/{phone} (5-min TTL),
                          sent via BSP template login_code; cooldown enforced
verifyOtp(phone, code)  → verify hash + attempts ≤ 5 → Admin SDK mints
                          Firebase custom token → client signInWithCustomToken
```

- **Fallback:** every member account also gets a generated readable password (e.g. `K7PM-X2QF`), shared by the admin when adding the member.
- Same phone may hold both roles; one uid may hold many memberships.
- Rate limits live on the `otps/{phone}` doc, enforced inside the Callables.

## 4. Monthly Cycle State Machine & Mutations

```
upcoming → payment_open → collection_complete
        → recipient_selected → payout_recorded → complete
```

Pure function `canTransition(from, to)` lives in `shared/` — used by UI for CTA visibility and authoritatively enforced inside Callable transactions.

### Callable Functions (all mutations transactional)

| Function | Behavior |
|---|---|
| `startNextCycle` | Creates cycle doc (`payment_open`, dueDate from group's dueDay), bumps currentCycleNumber |
| `markPaid` | payment → paid (+method/reference/note), updates counters, board entry, member mirror; idempotent |
| `confirmSelection` | Validates state + eligibility, writes immutable audit record, sets recipient, updates slot + mirrors. Retry-safe; double-confirm loses race deterministically with typed `ALREADY_SELECTED` |
| `recordPayout` | Requires `recipient_selected`; sets payout_recorded, updates mirror |
| `deactivateMember` | Marks slot inactive; history untouched; pool size unchanged |

**Random selection:** client-side pick via `crypto.getRandomValues` over the eligible list (active slots, not previously selected, plus paid-only filter if `requirePaidToWin`). Nothing persists until Confirm succeeds server-side — closing the app mid-animation leaves clean retryable state.

## 5. WhatsApp (BSP)

- Provider-agnostic `MessagingService` interface (`sendTemplate`, `normalizeStatus`); Meta Cloud API message format as baseline; BSP adapter swapped in later.
- Pre-approved templates: `login_code`, `member_invite`, `payment_reminder`, `overdue_reminder`, `recipient_notification`, `payout_confirmation`.
- Bulk reminders loop server-side — no browser popup limits.
- No delivery-status webhook; send results recorded at send time only.

## 6. Privacy & Access Control

- Members read: own `users/{uid}` doc, own memberships mirrors, `board`, and member names of groups they belong to (active membership required).
- Members write: nothing except their own display name.
- All money mutations re-verify role + group ownership server-side; security rules are defense-in-depth, not the only gate.
- Admin writes restricted to groups where `adminUid == request.auth.uid`.

## 7. Edge Cases

- **Overdue:** derived at render; overdue reminder template selected automatically.
- **Member leaves:** deactivation preserves history and configured pool size.
- **Payout pending:** cycle stays `recipient_selected` until payout recorded; premature close rejected.
- **Offline:** Firestore persistence for reads/queued direct writes; mutation CTAs disabled with banner when offline (Callables need connectivity).
- **Duplicate phone:** intentional re-add allowed as a second slot with warning.
- **Errors:** typed errors from `shared/errors.ts` mapped to human messages + recovery actions.

## 8. Testing & Milestones

- Vitest units: state machine, templates, currency utils, eligibility filter
- Emulator-based function tests: double-select race, payout-before-selection rejection, mirror consistency after each mutation
- Security-rules tests: member cannot write payments; cross-group isolation
- One Playwright e2e covering PRD §32 acceptance script

Milestones:
1. Scaffold + shared domain logic
2. Auth (WhatsApp OTP + password fallback)
3. Admin core (group, members, invites)
4. Collection loop (cycle start, mark paid, reminders)
5. Selection feature
6. Payout + cycle close + history
7. Member app
8. PWA polish, KPI dashboard, e2e
