# Payment History Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin sees all past payments (any group) as a date-filterable chronological list on a dedicated page; members see their own dated payments in their group view.

**Architecture:** Client-side reads of existing `groups/{gid}/cycles/{n}/payments/*` docs — fan out over cycles via `fetchCycles`, keep `status === 'paid'`, normalize `paidAt` (Firestore `Timestamp` despite typed `number`), sort newest first, filter by ISO date range client-side. One shared list component renders both admin and member views. Pure date helpers live in `shared/` so they're unit-testable with the existing vitest setup.

**Tech Stack:** React 19 + Vite PWA (`app/`), Firebase JS SDK Firestore reads, `@chitapp/shared` via `@shared` alias, vitest (shared only), oxlint.

**Design doc:** `docs/plans/2026-08-22-payment-history-design.md`

**Testing note:** The app has no test runner; shared has vitest. New pure logic goes into `shared/src/datetime.ts` with tests. UI is verified by typecheck + lint + manual smoke against the deployed project (read-only queries only — safe per AGENTS.md).

---

### Task 1: Date helpers in shared (TDD)

**Files:**
- Create: `shared/src/datetime.test.ts`
- Create: `shared/src/datetime.ts`
- Modify: `shared/src/index.ts`

**Step 1: Write the failing test**

Create `shared/src/datetime.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatDate, formatMonthHeader, isoDateLocal } from './datetime'

describe('isoDateLocal', () => {
  it('formats a local timestamp as YYYY-MM-DD', () => {
    const ms = new Date(2026, 0, 15, 10, 30).getTime()
    expect(isoDateLocal(ms)).toBe('2026-01-15')
  })

  it('pads month and day', () => {
    const ms = new Date(2026, 2, 5, 0, 5).getTime()
    expect(isoDateLocal(ms)).toBe('2026-03-05')
  })
})

describe('formatDate', () => {
  it('renders day, short month and year in en-IN', () => {
    const ms = new Date(Date.UTC(2026, 0, 10)).getTime()
    const out = formatDate(ms, 'en-IN')
    expect(out).toContain('2026')
    expect(out).toMatch(/Jan/)
  })

  it('renders Tamil month names for ta-IN', () => {
    const ms = new Date(Date.UTC(2026, 0, 10)).getTime()
    const out = formatDate(ms, 'ta-IN')
    expect(out).toContain('2026')
    expect(out).not.toMatch(/Jan/)
  })
})

describe('formatMonthHeader', () => {
  it('renders long month plus year', () => {
    const ms = new Date(Date.UTC(2026, 4, 2)).getTime()
    expect(formatMonthHeader(ms, 'en-IN')).toMatch(/May 2026/)
  })
})
```

**Step 2: Run test to verify it fails**

Run from `shared/`: `npx vitest run src/datetime.test.ts`
Expected: FAIL — cannot resolve `./datetime`.

**Step 3: Implement**

Create `shared/src/datetime.ts`:

```ts
export function isoDateLocal(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms)
}

export function formatMonthHeader(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(ms)
}
```

Add to `shared/src/index.ts` alongside the other re-exports:

```ts
export * from './datetime'
```

**Step 4: Run test to verify it passes**

Run from `shared/`: `npx vitest run src/datetime.test.ts`
Expected: PASS (all).

**Step 5: Rebuild shared dist and typecheck**

Run: `npm run build --prefix shared && npm run typecheck --prefix shared`
Expected: both succeed. (Functions depend on `shared/dist` — never skip this.)

**Step 6: Commit**

```bash
git add shared/src/datetime.ts shared/src/datetime.test.ts shared/src/index.ts
git commit -m "feat(shared): date formatting helpers"
```

---

### Task 2: Payment record reads + range filter in api.ts

**Files:**
- Modify: `app/src/lib/api.ts`

**Step 1: Add `PaymentDoc` to the type import**

In `app/src/lib/api.ts` line 3–10, add `PaymentDoc` to the existing `@shared` type-import list:

```ts
import type {
  BoardDoc,
  CycleDoc,
  GroupDoc,
  GroupMemberDoc,
  MembershipMirrorDoc,
  PaymentDoc,
  PaymentMethod,
} from '@shared'
```

Also extend the value import at line 2 to include `isoDateLocal`:

```ts
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { isoDateLocal } from '@shared'
```

**Step 2: Append the helpers at the end of the file**

```ts
function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis()
  }
  return null
}

export interface PaymentRecord {
  cycleNumber: number
  membershipId: string
  amountMinor: number
  method: PaymentMethod | null
  referenceNo: string | null
  note: string | null
  paidAtMs: number | null
}

async function fetchCyclePayments(
  groupId: string,
  cycleNumber: number,
): Promise<(PaymentDoc & { membershipId: string })[]> {
  const snap = await getDocs(
    collection(db, 'groups', groupId, 'cycles', String(cycleNumber), 'payments'),
  )
  return snap.docs.map((d) => ({ ...(d.data() as PaymentDoc), membershipId: d.id }))
}

export async function fetchGroupPaymentRecords(
  groupId: string,
  membershipIds?: string[],
): Promise<PaymentRecord[]> {
  const wanted = membershipIds ? new Set(membershipIds) : null
  const cycles = await fetchCycles(groupId)
  const perCycle = await Promise.all(
    cycles.map(async ({ id }) => {
      const cycleNumber = Number(id)
      const payments = await fetchCyclePayments(groupId, cycleNumber)
      return payments
        .filter((p) => p.status === 'paid' && (!wanted || wanted.has(p.membershipId)))
        .map<PaymentRecord>((p) => ({
          cycleNumber,
          membershipId: p.membershipId,
          amountMinor: p.amountMinor,
          method: p.method,
          referenceNo: p.referenceNo,
          note: p.note,
          paidAtMs: toMillis(p.paidAt),
        }))
    }),
  )
  return perCycle.flat().sort((a, b) => (b.paidAtMs ?? 0) - (a.paidAtMs ?? 0))
}

export function filterPaymentsByRange<T extends { paidAtMs: number | null }>(
  records: T[],
  fromIso: string,
  toIso: string,
): T[] {
  return records.filter((r) => {
    if (!r.paidAtMs) return false
    const iso = isoDateLocal(r.paidAtMs)
    if (fromIso && iso < fromIso) return false
    if (toIso && iso > toIso) return false
    return true
  })
}
```

**Step 3: Typecheck**

Run: `npm run typecheck`
Expected: succeeds (Task 1 already rebuilt `shared/dist`).

**Step 4: Commit**

```bash
git add app/src/lib/api.ts
git commit -m "feat(app): payment history read helpers"
```

---

### Task 3: i18n strings

**Files:**
- Modify: `app/src/i18n/en.ts` (~line 162, after the `memberView` block)
- Modify: `app/src/i18n/ta.ts` (same relative spot)

**Step 1: Add English keys**

Append inside the object in `app/src/i18n/en.ts`:

```ts
  'dash.allPayments': 'All payments',
  'payments.title': 'Payment history',
  'payments.from': 'From',
  'payments.to': 'To',
  'payments.total': 'Collected',
  'payments.empty': 'No payments yet',
  'memberView.yourPayments': 'Your payments',
```

(`dash.allPayments` goes next to the other `dash.*` keys near line 140; the rest grouped after `memberView.aMember`.)

**Step 2: Add Tamil keys**

Same keys in `app/src/i18n/ta.ts`:

```ts
  'dash.allPayments': 'எல்லா செலுத்துதல்களும்',
  'payments.title': 'செலுத்துதல் வரலாறு',
  'payments.from': 'இருந்து',
  'payments.to': 'வரை',
  'payments.total': 'மொத்த வசூல்',
  'payments.empty': 'இன்னும் செலுத்துதல்கள் இல்லை',
  'memberView.yourPayments': 'உங்கள் செலுத்துதல்கள்',
```

**Step 3: Typecheck (missing Tamil key must fail)**

Run: `npm run typecheck`
Expected: succeeds. Sanity: temporarily remove one `ta` key → typecheck FAILS → restore.

**Step 4: Commit**

```bash
git add app/src/i18n/en.ts app/src/i18n/ta.ts
git commit -m "feat(app): payment history i18n strings"
```

---

### Task 4: Locale hook + shared UI components

**Files:**
- Create: `app/src/lib/format.ts`
- Create: `app/src/components/DateRangeFields.tsx`
- Create: `app/src/components/PaymentHistoryList.tsx`
- Modify: `app/src/pages/admin/GroupDashboardPage.tsx:421` (export `methodLabel`)

**Step 1: Locale helper**

Create `app/src/lib/format.ts`:

```ts
import { useI18n } from '@/i18n'
import type { Lang } from '@/i18n'

export function localeFor(lang: Lang): string {
  return lang === 'ta' ? 'ta-IN' : 'en-IN'
}

export function useLocale(): string {
  return localeFor(useI18n().lang)
}
```

**Step 2: Export methodLabel**

In `app/src/pages/admin/GroupDashboardPage.tsx:421` change:

```ts
function methodLabel(method: PaymentMethod, t: (key: any) => string): string {
```

to:

```ts
export function methodLabel(method: PaymentMethod, t: (key: any) => string): string {
```

**Step 3: Date range fields**

Create `app/src/components/DateRangeFields.tsx`:

```tsx
import { DateInput, Field } from '@/components/ui'
import { useT } from '@/i18n'

export default function DateRangeFields({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
}) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t('payments.from')}>
        <DateInput value={from} max={to || undefined} onChange={(e) => onFromChange(e.target.value)} />
      </Field>
      <Field label={t('payments.to')}>
        <DateInput value={to} min={from || undefined} onChange={(e) => onToChange(e.target.value)} />
      </Field>
    </div>
  )
}
```

**Step 4: History list**

Create `app/src/components/PaymentHistoryList.tsx`:

```tsx
import { formatDate, formatMinor, formatMonthHeader, isoDateLocal } from '@shared'
import type { PaymentRecord } from '@/lib/api'
import { useT } from '@/i18n'
import { useLocale } from '@/lib/format'
import { methodLabel, PaymentMethodIcon } from '@/pages/admin/GroupDashboardPage'

type Row = PaymentRecord & { name?: string }

export default function PaymentHistoryList({
  records,
  currency,
  showMember = false,
}: {
  records: Row[]
  currency: string
  showMember?: boolean
}) {
  const t = useT()
  const locale = useLocale()

  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-8 text-center">
        <p className="text-sm text-muted">{t('payments.empty')}</p>
      </div>
    )
  }

  const groups: { key: string; headerMs: number; items: Row[] }[] = []
  for (const r of records) {
    if (!r.paidAtMs) continue
    const key = isoDateLocal(r.paidAtMs).slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(r)
    else groups.push({ key, headerMs: r.paidAtMs, items: [r] })
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            {formatMonthHeader(group.headerMs, locale)}
          </h3>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            {group.items.map((r) => (
              <li
                key={`${r.cycleNumber}-${r.membershipId}`}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  {showMember && (
                    <p className="truncate text-sm font-medium">{r.name ?? '—'}</p>
                  )}
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    {r.method && (
                      <PaymentMethodIcon method={r.method} size={12} weight="bold" />
                    )}
                    <span>{r.method ? methodLabel(r.method, t) : t('status.paid')}</span>
                    {r.paidAtMs != null && (
                      <span aria-hidden>·</span>
                    )}
                    {r.paidAtMs != null && <span>{formatDate(r.paidAtMs, locale)}</span>}
                  </p>
                  {(r.referenceNo || r.note) && (
                    <p className="mt-0.5 truncate text-xs text-faint">
                      {[r.referenceNo, r.note].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatMinor(r.amountMinor, currency)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
```

**Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint --prefix app`
Expected: both succeed.

**Step 6: Commit**

```bash
git add app/src/lib/format.ts app/src/components/DateRangeFields.tsx app/src/components/PaymentHistoryList.tsx app/src/pages/admin/GroupDashboardPage.tsx
git commit -m "feat(app): payment history list components"
```

---

### Task 5: Admin payments page, route, dashboard link

**Files:**
- Create: `app/src/pages/admin/GroupPaymentsPage.tsx`
- Modify: `app/src/App.tsx` (import + route)
- Modify: `app/src/pages/admin/GroupDashboardPage.tsx` (link after `<CycleSection … />`)

**Step 1: Page component**

Create `app/src/pages/admin/GroupPaymentsPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import {
  fetchGroup,
  fetchGroupMembers,
  fetchGroupPaymentRecords,
  filterPaymentsByRange,
} from '@/lib/api'
import type { PaymentRecord } from '@/lib/api'
import { formatMinor } from '@shared'
import type { GroupDoc } from '@shared'
import { DateRangeFields } from '@/components/DateRangeFields'
import PaymentHistoryList from '@/components/PaymentHistoryList'
import LanguageToggle from '@/components/LanguageToggle'
import { Page, PageHeader, Skeleton } from '@/components/ui'
import { useT } from '@/i18n'
import { useAuth } from '@/lib/useAuth'

export default function GroupPaymentsPage() {
  const { groupId = '' } = useParams<{ groupId: string }>()
  const t = useT()
  const { isAdmin, loading: authLoading } = useAuth()
  const [group, setGroup] = useState<{ id: string; data: GroupDoc } | null>(null)
  const [rows, setRows] = useState<(PaymentRecord & { name?: string })[] | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [g, members, records] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMembers(groupId),
        fetchGroupPaymentRecords(groupId),
      ])
      if (cancelled) return
      setGroup(g)
      const nameById = new Map(members.map(({ id, data }) => [id, data.displayName]))
      setRows(records.map((r) => ({ ...r, name: nameById.get(r.membershipId) })))
    })()
    return () => {
      cancelled = true
    }
  }, [groupId])

  const visible = useMemo(
    () => filterPaymentsByRange(rows ?? [], from, to),
    [rows, from, to],
  )
  const totalMinor = visible.reduce((sum, r) => sum + r.amountMinor, 0)

  if (authLoading || !rows) {
    return (
      <Page>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-14 w-full" />
        <Skeleton className="mt-6 h-64 w-full" />
      </Page>
    )
  }
  if (!isAdmin) return <Navigate to={`/groups/${groupId}`} replace />
  if (!group) return <Navigate to="/groups" replace />

  return (
    <Page>
      <PageHeader
        title={t('payments.title')}
        backTo={`/groups/${groupId}`}
        rightElement={<LanguageToggle />}
      />

      <DateRangeFields from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <p className="mt-4 text-sm text-muted">
        {t('payments.total')}:{' '}
        <span className="font-semibold tabular-nums text-ink">
          {formatMinor(totalMinor, group.data.currency)}
        </span>
      </p>

      <div className="mt-4">
        <PaymentHistoryList records={visible} currency={group.data.currency} showMember />
      </div>
    </Page>
  )
}
```

Note: `DateRangeFields` was written as a named export in Task 4's file? No — it uses `export default`. Import accordingly: `import DateRangeFields from '@/components/DateRangeFields'`. Use that form here.

**Step 2: Route**

In `app/src/App.tsx` add the import next to `GroupDashboardPage`:

```tsx
import GroupPaymentsPage from '@/pages/admin/GroupPaymentsPage'
```

and after the `/groups/:groupId` route block (line 52–59):

```tsx
        <Route
          path="/groups/:groupId/payments"
          element={
            <RequireAuth>
              <GroupPaymentsPage />
            </RequireAuth>
          }
        />
```

(Vite Router matches more-specific static segments before params suffixes; verify by loading the page in Step 4.)

**Step 3: Dashboard entry point**

In `app/src/pages/admin/GroupDashboardPage.tsx`, directly below `<CycleSection … />` (currently ~line 146):

```tsx
      <a
        href={`/groups/${groupId}/payments`}
        className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold hover:bg-sunken"
      >
        {t('dash.allPayments')}
        <span aria-hidden className="text-faint">›</span>
      </a>
```

**Step 4: Manual smoke (read-only)**

Run: `npm run dev`
- Sign in as admin, open a group → "All payments" link appears under the current-month section.
- Open it → rows sorted newest-first, grouped by month, member names shown.
- Set From == To on a known payment day → only that day's payments remain; total updates.
- Clear dates → everything returns.

**Step 5: Typecheck + lint**

Run: `npm run typecheck && npm run lint --prefix app`
Expected: pass.

**Step 6: Commit**

```bash
git add app/src/pages/admin/GroupPaymentsPage.tsx app/src/App.tsx app/src/pages/admin/GroupDashboardPage.tsx
git commit -m "feat(app): admin payment history page"
```

---

### Task 6: Member "Your payments" section

**Files:**
- Modify: `app/src/pages/member/MemberGroupView.tsx`

**Step 1: Imports**

Update the api import (lines 3–8):

```tsx
import {
  fetchBoard,
  fetchCycle,
  fetchGroup,
  fetchGroupPaymentRecords,
  fetchMyMemberships,
  filterPaymentsByRange,
} from '@/lib/api'
import type { PaymentRecord } from '@/lib/api'
```

Add component imports:

```tsx
import DateRangeFields from '@/components/DateRangeFields'
import PaymentHistoryList from '@/components/PaymentHistoryList'
```

**Step 2: State + fetch**

Add state next to the others (after line 25):

```tsx
  const [myRecords, setMyRecords] = useState<PaymentRecord[] | null>(null)
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
```

Extend the mirror branch inside the main effect (lines 36–41 become):

```tsx
      if (uid) {
        const mirrors = await fetchMyMemberships()
        if (cancelled) return
        const mine = mirrors.filter((m) => m.data.groupId === groupId)
        if (mine.length > 0) setMyStatus(mine[0]!.data.myPaymentStatus ?? 'pending')
        const ids = mine.map((m) => m.id)
        const records = ids.length > 0 ? await fetchGroupPaymentRecords(groupId, ids) : []
        if (cancelled) return
        setMyRecords(records)
      }
```

**Step 3: Derived filtered rows**

After `const overdue = …` (line 68), add:

```tsx
  const visibleMine = myRecords ? filterPaymentsByRange(myRecords, rangeFrom, rangeTo) : []
```

(`useMemo` unnecessary at this scale; keep plain.)

**Step 4: Render section**

Append after the read-only board `</section>` closing tag (after line 157), still inside `{board && …}` sibling level:

```tsx
      {/* Your payment history */}
      {myRecords && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">{t('memberView.yourPayments')}</h2>
          <DateRangeFields
            from={rangeFrom}
            to={rangeTo}
            onFromChange={setRangeFrom}
            onToChange={setRangeTo}
          />
          <div className="mt-4">
            <PaymentHistoryList records={visibleMine} currency={g.currency} />
          </div>
        </section>
      )}
```

**Step 5: Manual smoke (read-only)**

Run: `npm run dev`
- Sign in as a member → open a group → "Your payments" lists that member's slots with dates, no name column.
- Toggle language to Tamil → headings, month headers and dates render in Tamil.
- Date filtering works; empty state shows when range excludes everything.

**Step 6: Full verification gate**

Run: `npm run typecheck && npm run test:shared && npm run lint --prefix app`
Expected: all pass.

**Step 7: Commit**

```bash
git add app/src/pages/member/MemberGroupView.tsx
git commit -m "feat(app): member payment history section"
```
