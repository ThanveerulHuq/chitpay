import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, Trophy } from '@phosphor-icons/react'
import { callStartNextCycle, fetchBoard } from '@/lib/api'
import { formatMinor } from '@shared'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import { Button, Chip, ErrorNote } from '@/components/ui'
import { useI18n } from '@/i18n'

export default function GroupCyclesPage() {
  return <GroupShell><CyclesContent /></GroupShell>
}

function CyclesContent() {
  const { t } = useI18n()
  const { groupId, group, members, cycles, reload, isReadOnly, isMemberView } = useGroupWorkspace()
  const currentRef = useRef<HTMLLIElement>(null)
  const [fallback, setFallback] = useState<Map<string, { paidCount: number; collected: number }>>(new Map())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    let cancelled = false
    void Promise.all(cycles.map(async ({ id, data }) => {
      if (typeof data.paidCount === 'number' && typeof data.collectedAmountMinor === 'number') return null
      const board = await fetchBoard(groupId, Number(id))
      return [id, {
        paidCount: board?.filter((entry) => entry.status === 'paid').length ?? 0,
        collected: (board?.filter((entry) => entry.status === 'paid').length ?? 0) * group.monthlyAmountMinor,
      }] as const
    })).then((results) => {
      if (cancelled) return
      setFallback(new Map(results.filter((result): result is readonly [string, { paidCount: number; collected: number }] => result !== null)))
    })
    return () => { cancelled = true }
  }, [cycles, groupId, group.monthlyAmountMinor])

  async function startCycle() {
    setBusy(true)
    setError(null)
    try {
      await callStartNextCycle(groupId)
      await reload()
    } catch {
      setError(t('workspace.startCycleError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {error && <ErrorNote>{error}</ErrorNote>}
      {cycles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="font-semibold">{t('workspace.noCycles')}</p>
          <p className="mt-1 text-sm text-muted">{t('dash.readyStartDesc')}</p>
          {!isReadOnly && group.currentCycleNumber === 0 && (
            <Button className="mx-auto mt-5 px-3 py-2 text-sm" onClick={startCycle} disabled={busy}>
              <Play size={16} weight="fill" />
              {busy ? t('dash.starting') : t('dash.startMonth', { month: 1 })}
            </Button>
          )}
        </div>
      ) : (
        <ol className="space-y-3">
          {cycles.map(({ id, data }) => {
            const stats = fallback.get(id)
            const paidCount = typeof data.paidCount === 'number' ? data.paidCount : stats?.paidCount ?? 0
            const collected = typeof data.collectedAmountMinor === 'number' ? data.collectedAmountMinor : stats?.collected ?? 0
            const expected = group.monthlyAmountMinor * group.memberCount
            const winner = members.find((member) => member.id === data.recipientMembershipId)?.data.displayName
            const current = Number(id) === group.currentCycleNumber
            return (
              <li key={id} ref={current ? currentRef : undefined}>
                <Link to={`/groups/${groupId}/cycles/${id}${isMemberView ? '?view=member' : ''}`} className={`block rounded-2xl border bg-surface p-4 transition-colors hover:bg-sunken ${current ? 'border-accent/60 ring-1 ring-accent/20' : 'border-line'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold">{t('workspace.month', { month: data.monthNumber })}</h2>
                      {current && <Chip tone="paid">{t('workspace.current')}</Chip>}
                    </div>
                    <ArrowRight size={18} className="text-faint" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted">{t('workspace.collected')}</span>
                    <span className="text-right font-semibold tabular-nums">{formatMinor(collected, group.currency)} / {formatMinor(expected, group.currency)}</span>
                    <span className="text-muted">{t('workspace.dueMembers')}</span>
                    <span className="text-right font-semibold tabular-nums">{Math.max(group.memberCount - paidCount, 0)}</span>
                    <span className="text-muted">{t('workspace.winner')}</span>
                    <span className="flex items-center justify-end gap-1 text-right font-semibold">{winner ? <><Trophy size={14} className="text-accent-strong dark:text-accent" />{winner}</> : t('workspace.notSelected')}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
