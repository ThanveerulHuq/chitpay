import { useEffect, useMemo, useState } from 'react'
import { Bell, MagnifyingGlass, Minus, Money, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { callListGroupMemberContacts, callSendMemberReminder, callUpdateMemberChitCount, fetchBoard, fetchGroupPaymentRecords } from '@/lib/api'
import { contributionInPaise, formatMinor } from '@shared'
import type { GroupMemberDoc } from '@shared'
import { AddMemberSection } from '@/pages/admin/GroupDashboardPage'
import GroupShell, { useGroupWorkspace } from './GroupShell'
import PaymentSheet from '@/components/PaymentSheet'
import { Button, Chip, ErrorNote, Input } from '@/components/ui'
import { useI18n } from '@/i18n'
import { useBodyLock } from '@/lib/useBodyLock'

interface MemberPerson {
  uid: string
  name: string
  names: string[]
  slots: { id: string; data: GroupMemberDoc }[]
}

export default function GroupMembersPage() {
  return (
    <GroupShell>
      <MembersContent />
    </GroupShell>
  )
}

function MembersContent() {
  const { t } = useI18n()
  const { groupId, group, members, cycles, reload, isReadOnly, isMemberView, ownMembershipIds, showOtherMembers, showOtherMemberDues } = useGroupWorkspace()
  const [search, setSearch] = useState('')
  const [fallbackTotals, setFallbackTotals] = useState<Map<string, { total: number; paidCycles: number }>>(new Map())
  const [pendingByMember, setPendingByMember] = useState<Map<string, number[]>>(new Map())
  const [paymentMember, setPaymentMember] = useState<{ ids: string[]; cycles: number[] } | null>(null)
  const [editMember, setEditMember] = useState<MemberPerson | null>(null)
  const [busyMember, setBusyMember] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRefresh, setPendingRefresh] = useState(0)
  const [phonesByUid, setPhonesByUid] = useState<Map<string, string>>(new Map())
  const activeCycleNumbers = useMemo(
    () => cycles
      .filter(({ data }) => data.status === 'active')
      .map(({ data }) => data.cycleNumber)
      .sort((a, b) => a - b),
    [cycles],
  )

  useEffect(() => {
    if (isMemberView) {
      return
    }
    let cancelled = false
    void callListGroupMemberContacts(groupId).then((contacts) => {
      if (!cancelled) setPhonesByUid(new Map(contacts.map((contact) => [contact.uid, contact.phone])))
    }).catch(() => {
      if (!cancelled) setPhonesByUid(new Map())
    })
    return () => {
      cancelled = true
    }
  }, [groupId, isMemberView, members])

  useEffect(() => {
    let cancelled = false
    const needsFallback = members.some(({ data }) => typeof data.totalContributedMinor !== 'number' || typeof data.paidCycleCount !== 'number')
    if (needsFallback) {
      const visibleMembershipIds = isMemberView && !showOtherMemberDues ? [...ownMembershipIds] : undefined
      void fetchGroupPaymentRecords(groupId, visibleMembershipIds).then((records) => {
        if (cancelled) return
        const totals = new Map<string, { total: number; paidCycles: number }>()
        for (const record of records) {
          const current = totals.get(record.membershipId) ?? { total: 0, paidCycles: 0 }
          current.total += record.amountMinor
          current.paidCycles += 1
          totals.set(record.membershipId, current)
        }
        setFallbackTotals(totals)
      })
    }
    return () => {
      cancelled = true
    }
  }, [groupId, isMemberView, members, ownMembershipIds, showOtherMemberDues])

  useEffect(() => {
    let cancelled = false
    void Promise.all(activeCycleNumbers.map(async (cycleNumber) => ({
      cycleNumber,
      board: await fetchBoard(groupId, cycleNumber),
    }))).then((boards) => {
      if (cancelled) return
      const next = new Map<string, number[]>()
      for (const { cycleNumber, board } of boards) {
        for (const entry of board ?? []) {
          if (entry.status !== 'pending') continue
          if (isMemberView && !showOtherMemberDues && !ownMembershipIds.has(entry.membershipId)) continue
          const pendingCycles = next.get(entry.membershipId) ?? []
          pendingCycles.push(cycleNumber)
          next.set(entry.membershipId, pendingCycles)
        }
      }
      setPendingByMember(next)
    }).catch(() => {
      if (!cancelled) setError(t('workspace.pendingLoadError'))
    })
    return () => {
      cancelled = true
    }
  }, [activeCycleNumbers, groupId, isMemberView, ownMembershipIds, pendingRefresh, showOtherMemberDues, t])

  async function remindMember(person: MemberPerson) {
    setBusyMember(person.uid)
    setError(null)
    try {
      const result = await callSendMemberReminder({ groupId, membershipIds: person.slots.map((slot) => slot.id) })
      if (result.pendingCycleCount > 0 && result.sent === 0) {
        throw new Error('Reminder delivery failed')
      }
      if (result.pendingCycleCount === 0) setPendingRefresh((value) => value + 1)
    } catch {
      setError(t('workspace.reminderError'))
    } finally {
      setBusyMember(null)
    }
  }

  const people = useMemo(() => {
    const grouped = new Map<string, MemberPerson>()
    for (const slot of members) {
      if (slot.data.status !== 'active') continue
      if (isMemberView && !showOtherMembers && !ownMembershipIds.has(slot.id)) continue
      const person = grouped.get(slot.data.uid) ?? { uid: slot.data.uid, name: '', names: [], slots: [] }
      if (!person.names.some((name) => name.localeCompare(slot.data.displayName, undefined, { sensitivity: 'accent' }) === 0)) {
        person.names.push(slot.data.displayName)
        person.name = person.names.join(' / ')
      }
      person.slots.push(slot)
      grouped.set(slot.data.uid, person)
    }
    return [...grouped.values()]
  }, [isMemberView, members, ownMembershipIds, showOtherMembers])
  const normalizedSearch = search.trim().toLowerCase()
  const phoneSearch = search.replace(/\D/g, '')
  const visible = people.filter((person) => (
    person.name.toLowerCase().includes(normalizedSearch)
    || (!isMemberView && phoneSearch.length > 0 && (phonesByUid.get(person.uid) ?? '').includes(phoneSearch))
  ))

  return (
    <>
      <div className="relative">
        <MagnifyingGlass size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('workspace.searchMembers')} className="mt-0 pl-9" />
      </div>
      {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

      {visible.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-sm text-muted">{people.length ? t('workspace.noMatchingMembers') : t('dash.rosterEmpty')}</p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-surface px-4">
          {visible.map((person) => {
            const ids = person.slots.map((slot) => slot.id)
            const isOwnMembership = ids.some((id) => ownMembershipIds.has(id))
            const canSeeDues = !isMemberView || showOtherMemberDues || isOwnMembership
            const total = person.slots.reduce((sum, slot) => {
              const fallback = fallbackTotals.get(slot.id)
              return sum + (typeof slot.data.totalContributedMinor === 'number' ? slot.data.totalContributedMinor : fallback?.total ?? 0)
            }, 0)
            const paidPayments = person.slots.reduce((sum, slot) => {
              const fallback = fallbackTotals.get(slot.id)
              return sum + (typeof slot.data.paidCycleCount === 'number' ? slot.data.paidCycleCount : fallback?.paidCycles ?? 0)
            }, 0)
            const pendingCycles = [...new Set(person.slots.flatMap((slot) => pendingByMember.get(slot.id) ?? []))].sort((a, b) => a - b)
            const pendingPaymentCount = person.slots.reduce((sum, slot) => sum + (pendingByMember.get(slot.id)?.length ?? 0), 0)
            const totalPending = pendingPaymentCount * contributionInPaise(group)
            return (
              <li key={person.uid} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="min-w-0 truncate text-sm font-semibold">{person.name}</p>
                    <Chip tone="neutral">{t('workspace.memberChitCount', { count: person.slots.length })}</Chip>
                    {person.slots.some((slot) => slot.data.selectedInCycle != null) && <Chip tone="paid">{t('workspace.selected')}</Chip>}
                  </div>
                  {canSeeDues && <p className="mt-1 text-xs text-muted">
                    {formatMinor(total)} · {t('workspace.paidChitPayments', { paid: paidPayments, total: group.cycleCount * person.slots.length })}
                  </p>}
                  {canSeeDues && pendingPaymentCount > 0 && (
                    <p className="mt-1 text-xs font-medium text-ink">
                      {t('workspace.totalPending', { amount: formatMinor(totalPending) })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {!isReadOnly && group.completedCycleCount === 0 && <button type="button" onClick={() => setEditMember(person)} aria-label={t('workspace.editChitCountFor', { name: person.name })} title={t('workspace.editChitCountFor', { name: person.name })} className="rounded-full border border-line p-2 text-muted hover:bg-sunken hover:text-ink"><PencilSimple size={17} weight="bold" /></button>}
                  {!isReadOnly && pendingPaymentCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPaymentMember({ ids, cycles: pendingCycles })}
                        aria-label={t('workspace.recordFor', { name: person.name })}
                        title={t('workspace.recordFor', { name: person.name })}
                        className="rounded-full border border-line p-2 text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent"
                      >
                        <Money size={17} weight="bold" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remindMember(person)}
                        disabled={busyMember !== null}
                        aria-label={t('workspace.remindFor', { name: person.name })}
                        title={t('workspace.remindFor', { name: person.name })}
                        className="rounded-full border border-line p-2 text-accent-strong hover:bg-accent-soft disabled:opacity-40 dark:text-accent"
                      >
                        <Bell size={17} weight={busyMember === person.uid ? 'fill' : 'bold'} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!isReadOnly && group.completedCycleCount === 0 && (
        <section className="mt-7">
          <AddMemberSection groupId={groupId} onAdded={reload} />
        </section>
      )}
      {!isReadOnly && group.completedCycleCount > 0 && <p className="mt-7 rounded-2xl bg-sunken p-4 text-sm text-muted">{t('workspace.membersLocked')}</p>}
      {!isReadOnly && paymentMember && (
        <PaymentSheet
          groupId={groupId}
          group={group}
          pendingCycleNumbers={paymentMember.cycles}
          membershipIds={paymentMember.ids}
          onClose={() => setPaymentMember(null)}
          onDone={() => {
            setPaymentMember(null)
            void reload().finally(() => setPendingRefresh((value) => value + 1))
          }}
        />
      )}
      {!isReadOnly && editMember && <EditChitCountSheet groupId={groupId} person={editMember} onClose={() => setEditMember(null)} onDone={() => { setEditMember(null); void reload().finally(() => setPendingRefresh((value) => value + 1)) }} />}
    </>
  )
}

function EditChitCountSheet({ groupId, person, onClose, onDone }: { groupId: string; person: MemberPerson; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const [count, setCount] = useState(person.slots.length)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useBodyLock(true)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await callUpdateMemberChitCount({ groupId, membershipId: person.slots[0]!.id, chitCount: count })
      onDone()
    } catch (nextError) {
      const details = (nextError as { details?: { code?: string } }).details
      setError(details?.code === 'invalid_transition' ? t('workspace.chitCountActivityError') : (nextError as Error).message)
      setBusy(false)
    }
  }

  return <div role="dialog" aria-modal="true" aria-labelledby="edit-chit-count-title" className="fixed inset-0 z-[60] flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={(event) => event.target === event.currentTarget && onClose()}><div className="w-full max-w-lg rounded-t-3xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:pb-5"><div className="flex items-start justify-between gap-3"><div><h2 id="edit-chit-count-title" className="text-lg font-bold">{t('workspace.editChitCount')}</h2><p className="text-sm text-muted">{person.name}</p></div><button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded-full p-1.5 text-muted hover:bg-sunken hover:text-ink"><X size={20} weight="bold" /></button></div>{error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}<div className="mt-5"><p className="text-sm font-medium text-ink">{t('dash.chitCount')}</p><div className="mt-2 grid w-36 grid-cols-[2.5rem_1fr_2.5rem] overflow-hidden rounded-xl border border-line bg-surface"><button type="button" onClick={() => setCount((value) => Math.max(1, value - 1))} disabled={count === 1 || busy} aria-label={t('dash.decreaseChitCount')} className="grid h-10 place-items-center border-r border-line text-ink hover:bg-sunken disabled:pointer-events-none disabled:text-faint"><Minus size={16} weight="bold" /></button><output aria-live="polite" className="grid h-10 place-items-center font-bold tabular-nums">{count}</output><button type="button" onClick={() => setCount((value) => Math.min(100, value + 1))} disabled={count === 100 || busy} aria-label={t('dash.increaseChitCount')} className="grid h-10 place-items-center border-l border-line text-ink hover:bg-sunken disabled:pointer-events-none disabled:text-faint"><Plus size={16} weight="bold" /></button></div><p className="mt-2 text-xs text-muted">{t('workspace.editChitCountHint')}</p></div><div className="mt-6 flex gap-3"><Button variant="secondary" onClick={onClose} disabled={busy} className="flex-1">{t('common.cancel')}</Button><Button onClick={() => void save()} disabled={busy || count === person.slots.length} className="flex-1">{busy ? t('common.saving') : t('common.save')}</Button></div></div></div>
}
