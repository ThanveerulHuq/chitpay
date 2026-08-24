import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, Trophy } from '@phosphor-icons/react'
import { callStartCycle } from '@/lib/api'
import { formatIsoDate, formatMinor, getCycleStartBlockReason } from '@shared'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import { Button, Chip, ErrorNote } from '@/components/ui'
import { useI18n } from '@/i18n'
import { groupPath, useExperience } from '@/lib/roleRoutes'
import { useLocale } from '@/lib/format'
import { formatCycleName } from '@/lib/cycleName'

export default function GroupCyclesPage() { return <GroupShell><CyclesContent /></GroupShell> }

function CyclesContent() {
  const { t } = useI18n()
  const locale = useLocale()
  const experience = useExperience()
  const { groupId, group, members, cycles, reload, isReadOnly, isMemberView, showOtherMemberDues } = useGroupWorkspace()
  const [busyCycle, setBusyCycle] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start(cycleNumber: number) {
    setBusyCycle(cycleNumber)
    setError(null)
    try { await callStartCycle(groupId, cycleNumber); await reload() }
    catch (nextError) { setError((nextError as Error).message || t('workspace.startCycleError')) }
    finally { setBusyCycle(null) }
  }

  return <>
    {error && <ErrorNote>{error}</ErrorNote>}
    <div className="mb-4 flex items-center justify-between text-sm text-muted"><span>{frequencyLabel(group.frequency, t)}</span><span>{group.completedCycleCount} / {group.cycleCount} {t('workspace.completeCount')}</span></div>
    <ol className="space-y-3">
      {cycles.map(({ id, data }) => {
        const winner = members.find((member) => member.id === data.recipientMembershipId)?.data.displayName
        const expectedAmount = group.contributionAmountMinor * data.expectedPaymentCount
        const startBlockReason = getCycleStartBlockReason(
          members.filter((member) => member.data.status === 'active').length,
          data.cycleNumber,
          cycles.map((cycle) => cycle.data),
        )
        const startBlockMessage = startBlockReason === 'no_active_members'
          ? t('workspace.startCycleNeedsMember')
          : null
        return <li key={id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <Link to={groupPath(experience, groupId, `cycles/${id}`)} className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><h2 className="font-bold">{formatCycleName(data.plannedStartDate, group.frequency, locale, t)}</h2><StatusChip status={data.status} t={t} /></div>
              <p className="mt-1 text-sm text-muted">{t('workspace.plannedStart', { date: formatIsoDate(data.plannedStartDate) })}</p>
              {data.status !== 'upcoming' && <div className="mt-3 grid grid-cols-2 gap-2 text-sm">{(!isMemberView || showOtherMemberDues) && <><span className="text-muted">{t('workspace.collected')}</span><span className="text-right font-semibold">{formatMinor(data.collectedAmountMinor, group.currency)} / {formatMinor(expectedAmount, group.currency)}</span></>}<span className="text-muted">{t('workspace.winner')}</span><span className="flex items-center justify-end gap-1 font-semibold">{winner ? <><Trophy size={14} />{winner}</> : t('workspace.notSelected')}</span></div>}
            </Link>
            {data.status === 'upcoming' && !isReadOnly ? <div className="flex shrink-0 flex-col items-end gap-1"><Button className="px-3 py-2 text-sm" onClick={() => void start(data.cycleNumber)} disabled={busyCycle !== null || startBlockReason !== null} title={startBlockMessage ?? undefined}><Play size={15} weight="fill" />{busyCycle === data.cycleNumber ? t('dash.starting') : t('workspace.startCycle')}</Button>{startBlockMessage && <p className="max-w-36 text-right text-xs text-muted">{startBlockMessage}</p>}</div> : <ArrowRight size={18} className="mt-1 text-faint" />}
          </div>
        </li>
      })}
    </ol>
  </>
}

function StatusChip({ status, t }: { status: 'upcoming' | 'active' | 'complete'; t: (key: any) => string }) {
  if (status === 'complete') return <Chip tone="paid">{t('workspace.statusComplete')}</Chip>
  if (status === 'active') return <Chip tone="pending">{t('workspace.statusActive')}</Chip>
  return <Chip tone="neutral">{t('workspace.statusUpcoming')}</Chip>
}

function frequencyLabel(frequency: string, t: (key: any) => string) {
  if (frequency === 'weekly') return t('createGroup.frequencyWeekly')
  if (frequency === 'biweekly') return t('createGroup.frequencyBiweekly')
  return t('createGroup.frequencyMonthly')
}
