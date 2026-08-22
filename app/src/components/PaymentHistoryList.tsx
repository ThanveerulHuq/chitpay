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
                    {r.paidAtMs != null && <span aria-hidden>·</span>}
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
