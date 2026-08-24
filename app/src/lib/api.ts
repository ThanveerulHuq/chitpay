import { httpsCallable } from 'firebase/functions'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { isoDateLocal } from '@shared'
import type {
  BoardDoc,
  CycleDoc,
  CycleFrequency,
  GroupDoc,
  GroupMemberDoc,
  MembershipMirrorDoc,
  PaymentDoc,
  PaymentEventDoc,
  PaymentMethod,
} from '@shared'
import { functions, db } from './firebase'
import { auth } from './firebase'

export async function callCreateGroup(input: {
  name: string
  contributionAmountMinor: number
  currency: string
  frequency: CycleFrequency
  cycleCount: number
  startDate: string
  description?: string
  requirePaidToWin: boolean
}): Promise<string> {
  const call = httpsCallable<typeof input, { groupId: string }>(functions, 'createGroup')
  const res = await call(input)
  return res.data.groupId
}

export async function callArchiveGroup(groupId: string): Promise<void> {
  const call = httpsCallable<{ groupId: string }, { ok: boolean }>(functions, 'archiveGroup')
  await call({ groupId })
}

export async function callUnarchiveGroup(groupId: string): Promise<void> {
  const call = httpsCallable<{ groupId: string }, { ok: boolean }>(functions, 'unarchiveGroup')
  await call({ groupId })
}

export interface AddMemberResult {
  membershipId: string
  slotNo: number
  membershipIds: string[]
  chitCount: number
  isNewUser: boolean
  notificationSent: boolean
}

export async function callAddMember(input: {
  groupId: string
  name: string
  phone: string
  chitCount?: number
}): Promise<AddMemberResult> {
  const call = httpsCallable<typeof input, AddMemberResult>(functions, 'addMember')
  const res = await call(input)
  return res.data
}

export async function callUpdateMemberChitCount(input: {
  groupId: string
  membershipId: string
  chitCount: number
}): Promise<{ chitCount: number }> {
  const call = httpsCallable<typeof input, { chitCount: number }>(functions, 'updateMemberChitCount')
  const res = await call(input)
  return res.data
}

export interface ManagedMemberGroup {
  groupId: string
  name: string
  slotCount: number
  inactiveSlotCount: number
}

export interface ManagedMember {
  uid: string
  name: string
  phone: string
  isAdmin: boolean
  groupCount: number
  slotCount: number
  inactiveSlotCount: number
  groups: ManagedMemberGroup[]
}

export async function callListManagedMembers(): Promise<ManagedMember[]> {
  const call = httpsCallable<Record<string, never>, { members: ManagedMember[] }>(
    functions,
    'listManagedMembers',
  )
  const res = await call({})
  return res.data.members
}

export async function callUpdateManagedMemberProfile(input: {
  uid: string
  name: string
  phone: string
}): Promise<{ phoneChanged: boolean; notificationSent: boolean }> {
  const call = httpsCallable<typeof input, {
    ok: boolean
    phoneChanged: boolean
    notificationSent: boolean
  }>(functions, 'updateManagedMemberProfile')
  const res = await call(input)
  return {
    phoneChanged: res.data.phoneChanged,
    notificationSent: res.data.notificationSent,
  }
}

export async function callUpdateOwnName(name: string): Promise<void> {
  const call = httpsCallable<{ name: string }, { ok: boolean }>(functions, 'updateOwnName')
  await call({ name })
}

export async function fetchMyGroups(): Promise<{ id: string; data: GroupDoc }[]> {
  const user = auth.currentUser
  if (!user) return []
  const q = query(collection(db, 'groups'), where('adminUid', '==', user.uid))

  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as GroupDoc }))
}

export async function fetchMyMemberships(): Promise<
  { id: string; data: MembershipMirrorDoc }[]
> {
  const uid = auth.currentUser?.uid
  if (!uid) return []
  const snap = await getDocs(collection(db, 'users', uid, 'memberships'))
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as MembershipMirrorDoc }))
}

export async function fetchGroup(
  groupId: string,
): Promise<{ id: string; data: GroupDoc } | null> {
  const snap = await getDoc(doc(db, 'groups', groupId))
  return snap.exists() ? { id: snap.id, data: snap.data() as GroupDoc } : null
}

export async function fetchGroupMembers(
  groupId: string,
): Promise<{ id: string; data: GroupMemberDoc }[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'members'))
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as GroupMemberDoc }))
}

export async function callStartCycle(groupId: string, cycleNumber: number): Promise<void> {
  const call = httpsCallable<{ groupId: string; cycleNumber: number }, { ok: boolean }>(functions, 'startCycle')
  await call({ groupId, cycleNumber })
}

export async function callMarkPaid(input: {
  groupId: string
  membershipId: string
  method: PaymentMethod
  cycleNumber: number
  referenceNo?: string
  note?: string
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'markPaid')
  await call(input)
}

export async function callSendReminder(input: {
  groupId: string
  cycleNumber: number
  membershipId?: string
}): Promise<{ sent: number; total: number }> {
  const call = httpsCallable<typeof input, { sent: number; total: number }>(
    functions,
    'sendReminder',
  )
  const res = await call(input)
  return res.data
}

export async function callSendMemberReminder(input: {
  groupId: string
  membershipIds: string[]
}): Promise<{
  sent: number
  pendingCycleCount: number
  cycleNumbers: number[]
  totalDueMinor: number
}> {
  const call = httpsCallable<typeof input, {
    sent: number
    pendingCycleCount: number
    cycleNumbers: number[]
    totalDueMinor: number
  }>(functions, 'sendMemberReminder')
  const res = await call(input)
  return res.data
}

export async function callEditPayment(input: {
  groupId: string
  cycleNumber: number
  membershipId: string
  method: PaymentMethod
  referenceNo?: string
  note?: string
  reason: string
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'editPayment')
  await call(input)
}

export async function callReversePayment(input: {
  groupId: string
  cycleNumber: number
  membershipId: string
  reason: string
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'reversePayment')
  await call(input)
}

export async function callConfirmSelection(input: {
  groupId: string
  cycleNumber: number
  membershipId: string
  willingMembershipIds: string[]
}): Promise<{ ok: boolean; poolAmountMinor: number }> {
  const call = httpsCallable<typeof input, { ok: boolean; poolAmountMinor: number }>(
    functions,
    'confirmSelection',
  )
  const res = await call(input)
  return res.data
}

export async function callRecordPayout(input: {
  groupId: string
  cycleNumber: number
  amountMinor?: number
}): Promise<{ ok: boolean }> {
  const call = httpsCallable<typeof input, { ok: boolean }>(
    functions,
    'recordPayout',
  )
  const res = await call(input)
  return res.data
}

export async function callCompleteCycle(input: {
  groupId: string
  cycleNumber: number
}): Promise<{ ok: boolean; completedGroup: boolean }> {
  const call = httpsCallable<typeof input, { ok: boolean; completedGroup: boolean }>(
    functions,
    'completeCycle',
  )
  const res = await call(input)
  return res.data
}

export async function fetchCycles(groupId: string): Promise<{ id: string; data: CycleDoc }[]> {
  const snap = await getDocs(collection(db, 'groups', groupId, 'cycles'))
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as CycleDoc }))
}

export async function fetchBoard(
  groupId: string,
  cycleNumber: number,
): Promise<BoardDoc['entries'] | null> {
  const snap = await getDoc(doc(db, 'groups', groupId, 'cycles', String(cycleNumber), 'board', 'board'))
  return snap.exists() ? (snap.data() as BoardDoc).entries : null
}

export async function fetchCycle(
  groupId: string,
  cycleNumber: number,
): Promise<CycleDoc | null> {
  const snap = await getDoc(doc(db, 'groups', groupId, 'cycles', String(cycleNumber)))
  return snap.exists() ? (snap.data() as CycleDoc) : null
}

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

export interface PaymentLedgerRecord extends PaymentRecord {
  status: 'paid' | 'reversed'
  eventId?: string
  reason?: string | null
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

export async function fetchGroupPaymentLedger(
  groupId: string,
  membershipIds?: string[],
): Promise<PaymentLedgerRecord[]> {
  const wanted = membershipIds ? new Set(membershipIds) : null
  const cycles = await fetchCycles(groupId)
  const perCycle = await Promise.all(
    cycles.map(async ({ id }) => {
      const cycleNumber = Number(id)
      const cycleRef = doc(db, 'groups', groupId, 'cycles', id)
      const [paymentsSnap, eventsSnap] = await Promise.all([
        getDocs(collection(cycleRef, 'payments')),
        getDocs(collection(cycleRef, 'paymentEvents')),
      ])
      const records: PaymentLedgerRecord[] = []
      for (const paymentDoc of paymentsSnap.docs) {
        const payment = paymentDoc.data() as PaymentDoc
        if (payment.status !== 'paid' || (wanted && !wanted.has(paymentDoc.id))) continue
        records.push({
          cycleNumber,
          membershipId: paymentDoc.id,
          amountMinor: payment.amountMinor,
          method: payment.method,
          referenceNo: payment.referenceNo,
          note: payment.note,
          paidAtMs: toMillis(payment.paidAt),
          status: 'paid',
        })
      }
      for (const eventDoc of eventsSnap.docs) {
        const event = eventDoc.data() as PaymentEventDoc
        if (event.type !== 'reversed' || (wanted && !wanted.has(event.membershipId))) continue
        const before = event.before
        records.push({
          cycleNumber,
          membershipId: event.membershipId,
          amountMinor: before?.amountMinor ?? 0,
          method: before?.method ?? null,
          referenceNo: before?.referenceNo ?? null,
          note: before?.note ?? null,
          paidAtMs: toMillis(before?.paidAt),
          status: 'reversed',
          eventId: eventDoc.id,
          reason: event.reason,
        })
      }
      return records
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
