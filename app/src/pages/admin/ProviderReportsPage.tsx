import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarBlank, HandCoins } from '@phosphor-icons/react'
import { formatDate, formatMinor } from '@shared'
import type { GroupDoc, PaymentMethod } from '@shared'
import ReportDateFilterSheet from '@/components/ReportDateFilterSheet'
import { Button, Chip, Dropdown, ErrorNote, Page, PageHeader, Skeleton } from '@/components/ui'
import {
  fetchCycles,
  fetchGroupMembers,
  fetchGroupPaymentLedger,
  fetchMyGroups,
  filterPaymentsByRange,
  type PaymentLedgerRecord,
} from '@/lib/api'
import { formatCycleName, plannedDateForCycle } from '@/lib/cycleName'
import { useLocale } from '@/lib/format'
import { groupPath, groupsPath } from '@/lib/roleRoutes'
import { useAuth } from '@/lib/useAuth'
import { useI18n } from '@/i18n'
import { PaymentMethodIcon, methodLabel } from '@/pages/admin/GroupDashboardPage'

type ProviderReportFilters = {
  from: string
  to: string
  groupId: string
  method: 'all' | PaymentMethod
}

type ProviderReportEntry = {
  kind: 'payment' | 'payout'
  groupId: string
  groupName: string
  group: GroupDoc
  cycleNumber: number
  membershipId: string
  memberName: string | null
  amountMinor: number
  paidAtMs: number | null
  payment?: PaymentLedgerRecord
}

const emptyFilters: ProviderReportFilters = { from: '', to: '', groupId: 'all', method: 'all' }

function timestampToMillis(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as { toMillis(): number }).toMillis()
  }
  return null
}

export default function ProviderReportsPage() {
  const { loading: authLoading } = useAuth()
  const { t } = useI18n()
  const locale = useLocale()
  const [groups, setGroups] = useState<{ id: string; data: GroupDoc }[]>([])
  const [entries, setEntries] = useState<ProviderReportEntry[]>([])
  const [filters, setFilters] = useState<ProviderReportFilters>(emptyFilters)
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    void fetchMyGroups()
      .then(async (nextGroups) => {
        const groupEntries = await Promise.all(nextGroups.map(async ({ id: groupId, data: group }) => {
          const [members, cycles] = await Promise.all([
            fetchGroupMembers(groupId),
            fetchCycles(groupId),
          ])
          const payments = await fetchGroupPaymentLedger(groupId, undefined, cycles.map(({ id }) => id))
          const nameById = new Map(members.map(({ id, data }) => [id, data.displayName]))
          const memberName = (membershipId: string) => nameById.get(membershipId) ?? null

          const paymentEntries = payments.map<ProviderReportEntry>((payment) => ({
            kind: 'payment',
            groupId,
            groupName: group.name,
            group,
            cycleNumber: payment.cycleNumber,
            membershipId: payment.membershipId,
            memberName: memberName(payment.membershipId),
            amountMinor: payment.amountMinor,
            paidAtMs: payment.paidAtMs,
            payment,
          }))
          const payoutEntries = cycles.flatMap<ProviderReportEntry>(({ id, data }) => {
            if (data.payout.status !== 'paid' || !data.recipientMembershipId) return []
            return [{
              kind: 'payout',
              groupId,
              groupName: group.name,
              group,
              cycleNumber: Number(id),
              membershipId: data.recipientMembershipId,
              memberName: memberName(data.recipientMembershipId),
              amountMinor: data.payout.amountMinor,
              paidAtMs: timestampToMillis(data.payout.paidAt),
            }]
          })
          return [...paymentEntries, ...payoutEntries]
        }))

        if (cancelled) return
        setGroups(nextGroups)
        setEntries(groupEntries.flat().sort((a, b) => (b.paidAtMs ?? 0) - (a.paidAtMs ?? 0)))
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [authLoading])

  const visible = useMemo(() => filterPaymentsByRange(entries, filters.from, filters.to).filter((entry) => {
    if (filters.groupId !== 'all' && entry.groupId !== filters.groupId) return false
    if (filters.method !== 'all' && (entry.kind === 'payout' || entry.payment?.method !== filters.method)) return false
    return true
  }), [entries, filters])
  const collectedTotal = visible
    .filter((entry) => entry.kind === 'payment' && entry.payment?.status === 'paid')
    .reduce((sum, entry) => sum + entry.amountMinor, 0)
  const payoutTotal = visible
    .filter((entry) => entry.kind === 'payout')
    .reduce((sum, entry) => sum + entry.amountMinor, 0)
  const groupOptions = useMemo(() => [
    { value: 'all', label: t('providerReports.allGroups') },
    ...groups
      .slice()
      .sort((a, b) => a.data.name.localeCompare(b.data.name, locale))
      .map(({ id, data }) => ({ value: id, label: data.name })),
  ], [groups, locale, t])
  const hasDateFilter = Boolean(filters.from || filters.to)

  if (authLoading) {
    return <Page><Skeleton className="h-16 w-full" /><Skeleton className="mt-5 h-64 w-full" /></Page>
  }
  return (
    <Page>
      <PageHeader title={t('providerReports.title')} backTo={groupsPath('admin')} />
      {loadError && <ErrorNote>{t('providerReports.loadError')}</ErrorNote>}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{t('payments.total')}: <strong className="font-semibold tabular-nums text-ink">{formatMinor(collectedTotal)}</strong></span>
        <span>{t('payments.payouts')}: <strong className="font-semibold tabular-nums text-ink">{formatMinor(payoutTotal)}</strong></span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Dropdown
          value={filters.groupId}
          onChange={(groupId) => setFilters((current) => ({ ...current, groupId }))}
          ariaLabel={t('providerReports.groupFilter')}
          compact
          containerClassName="!mt-0"
          className="!mt-0 h-12"
          options={groupOptions}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:contents">
          <Dropdown
            value={filters.method}
            onChange={(method) => setFilters((current) => ({ ...current, method }))}
            ariaLabel={t('workspace.methodFilter')}
            compact
            containerClassName="!mt-0"
            className="!mt-0 h-12"
            options={[
              { value: 'all', label: t('workspace.allMethods') },
              { value: 'cash', label: t('dash.methodCash') },
              { value: 'upi', label: t('dash.methodUpi') },
              { value: 'bank_transfer', label: t('dash.methodBank') },
              { value: 'other', label: t('dash.methodOther') },
            ]}
          />
          <Button variant="secondary" onClick={() => setDateFilterOpen(true)} className="h-12 self-start px-3 py-0 text-sm" aria-label={t('workspace.dateFilter')}>
            <CalendarBlank size={17} weight="bold" />
            <span className="hidden sm:inline">{t('workspace.dateFilter')}</span>
            {hasDateFilter && <span aria-hidden className="size-2 rounded-full bg-accent" />}
          </Button>
        </div>
      </div>

      {loadError ? null : loading ? (
        <div className="mt-5 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          {t('providerReports.empty')}
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          {visible.map((entry, index) => {
            const cycleName = formatCycleName(
              plannedDateForCycle(entry.group, entry.cycleNumber),
              entry.group.frequency,
              locale,
              t,
            )
            const reportPath = groupPath('admin', entry.groupId, 'reports')
            if (entry.kind === 'payout') {
              return (
                <li key={`payout-${entry.groupId}-${entry.cycleNumber}`} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 truncate text-sm font-semibold">{entry.memberName ?? t('memberView.aMember')}</p>
                      <Chip tone="neutral">{t('payments.payout')}</Chip>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Link to={reportPath} className="font-medium text-accent-strong hover:underline dark:text-accent" aria-label={t('providerReports.openGroupReport', { group: entry.groupName })}>{entry.groupName}</Link>
                      <span aria-hidden>·</span><HandCoins size={13} weight="bold" />{t('payments.payout')}
                      <span aria-hidden>·</span>{cycleName}
                      {entry.paidAtMs && <><span aria-hidden>·</span><span className="whitespace-nowrap">{formatDate(entry.paidAtMs, locale)}</span></>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMinor(entry.amountMinor)}</span>
                </li>
              )
            }

            const row = entry.payment
            if (!row) return null
            return (
              <li key={`payment-${entry.groupId}-${row.cycleNumber}-${row.membershipId}-${row.eventId ?? index}`} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 truncate text-sm font-semibold">{entry.memberName ?? t('memberView.aMember')}</p>
                    <Chip tone={row.status === 'paid' ? 'paid' : 'neutral'}>{row.status === 'paid' ? t('status.paid') : t('workspace.reversed')}</Chip>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Link to={reportPath} className="font-medium text-accent-strong hover:underline dark:text-accent" aria-label={t('providerReports.openGroupReport', { group: entry.groupName })}>{entry.groupName}</Link>
                    <span aria-hidden>·</span>
                    {row.method && <PaymentMethodIcon method={row.method} size={12} weight="bold" />}
                    {row.method ? methodLabel(row.method, t) : t('workspace.reversed')}
                    <span aria-hidden>·</span>{cycleName}
                    {row.paidAtMs && <><span aria-hidden>·</span><span className="whitespace-nowrap">{formatDate(row.paidAtMs, locale)}</span></>}
                  </p>
                  {row.reason && <p className="mt-0.5 truncate text-xs text-faint">{row.reason}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMinor(row.amountMinor)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {dateFilterOpen && (
        <ReportDateFilterSheet
          from={filters.from}
          to={filters.to}
          onClose={() => setDateFilterOpen(false)}
          onApply={(from, to) => {
            setFilters((current) => ({ ...current, from, to }))
            setDateFilterOpen(false)
          }}
        />
      )}
    </Page>
  )
}
