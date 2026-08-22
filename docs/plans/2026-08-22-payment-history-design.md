# Payment History Design

Date: 2026-08-22
Status: Approved

## Goal

Surface dated payment records that already exist in Firestore but are never read today:

- **Admin**: see all past payments across cycles as a flat chronological list (newest first), filterable by date range — a single-day lookup is just from == to. Optional month group headers.
- **Members**: see their own past payments (across all slots they hold in a group) with dates, in a simple filterable history section inside the member group view.

Decisions made during brainstorming:

- Admin view combines all three browsing modes in one screen: flat dated list (default), date-range filter (enables single-day lookup), month/cycle group headers.
- Members get the same history list plus date filtering.
- Admin view lives on a dedicated page, not inline on the dashboard.

## Approach chosen

**Client-side reads, iterating cycles** (no functions changes, no deploy):

1. `fetchCycles(groupId)` already returns every cycle.
2. New helper fetches each cycle's `payments` subcollection (admin) or gets specific `payments/{membershipId}` docs (member).
3. Merge, keep only `status === 'paid'`, sort by `paidAt` descending, filter by date range client-side.

Rejected alternatives:

- **Callable `listPayments`** — more code plus a deploy, yet internally iterates the same cycles; repo convention reserves callables for writes, reads are client-side today.
- **Denormalized payment log** written on `markPaid` — efficient future reads but needs backfill of historical data and extra write paths; YAGNI at current scale (≤25 members × ~24 months ≈ few hundred docs).

## Data access

New in `app/src/lib/api.ts`:

- `fetchCyclePayments(groupId, cycleNumber)` — reads `groups/{gid}/cycles/{n}/payments/*`.
- `fetchGroupPaymentRecords(groupId, opts?: { membershipIds? })` — fans out over all cycles via `fetchCycles`, awaits `fetchCyclePayments` (or per-membership `getDoc`s when `membershipIds` given), returns flattened `PaymentRecord[]` sorted newest first.

View type (local to app):

```ts
interface PaymentRecord {
  cycleNumber: number
  membershipId: string
  amountMinor: number
  method: PaymentMethod | null
  paidAtMs: number | null
  referenceNo: string | null
  note: string | null
}
```

Only `status === 'paid'` docs are returned (pending docs have no date and don't belong in a dated history).

### Firestore Timestamp caveat

`paidAt` is typed `number | null` in shared, but writes use `FieldValue.serverTimestamp()`, so reads return a Firestore `Timestamp`. Conversion helper normalizes both shapes (`typeof v === 'object' && 'toMillis' in v` → `.toMillis()`).

## UI

### Shared component

`app/src/components/PaymentHistoryList.tsx` — renders grouped rows (grouped by calendar month via `Intl.DateTimeFormat`, newest first); props: `records`, `currency`, `showMember` (name column for admin). Empty state when no payments match.

### Admin page

- Route `/groups/:groupId/payments` in `App.tsx`, guarded: admins only — non-admins redirect back to the group page.
- Entry point: "All payments" link/button on the admin dashboard (near the Past months section).
- Contents: `PageHeader` (back to dashboard), From/To using existing `DateInput`, total collected in range, then `PaymentHistoryList` with `showMember`.
- Row: member name · amount (`formatMinor`) · method icon (existing `PaymentMethodIcon`) · paid date · reference/note.
- Defaults to all time; filters apply client-side.

### Member section

"Your payments" section appended to `MemberGroupView` below the current-month board: same From/To filters and `PaymentHistoryList` with `showMember={false}`, showing the member's own records. Membership IDs come from `users/{uid}/memberships` mirror filtered to the group — one uid holding multiple slots sees all its slots' payments.

## Date formatting

First date-formatting utility in the repo: `app/src/lib/format.ts` with `formatDate(ms)` and `formatMonthHeader(ms)` using `Intl.DateTimeFormat('ta-IN' | 'en-IN')` selected by the active i18n language (per the Tamil localization plan). Device-local timezone. Existing raw ISO-string rendering elsewhere stays unchanged.

## i18n

New keys in both `en.ts` and `ta.ts` (missing Tamil key fails typecheck): payments title, all-payments link label, from/to labels, total-in-range label, your-payments heading, empty state.

## Edge cases

- Pending payments excluded everywhere (no `paidAt`).
- Paid docs with null `paidAt` (shouldn't exist) sort last defensively.
- Current open cycle's payments appear once paid — history isn't limited to completed cycles.
- Multi-slot members: all their slots' payments show in both views (admin keyed by slot name).
- Payouts stay in the existing Past months section; untouched.

## Testing & verification

- No shared/functions changes, so `npm run typecheck`, `npm run lint --prefix app` are the gates; `npm run test:shared` run per repo convention.
- Manual smoke: admin range filter incl. single day; member sees own slots with dates; Tamil locale renders formatted dates/month headers.

## Out of scope

- Server-side pagination or callable-backed reads.
- CSV/export.
- Backfilling denormalized fields onto payment docs.
