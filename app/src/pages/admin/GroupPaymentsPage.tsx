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
import DateRangeFields from '@/components/DateRangeFields'
import PaymentHistoryList from '@/components/PaymentHistoryList'
import LanguageToggle from '@/components/LanguageToggle'
import { Page, PageHeader } from '@/components/ui'
import { PaymentsLoadingScreen } from '@/components/LoadingScreens'
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
    return <PaymentsLoadingScreen />
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
