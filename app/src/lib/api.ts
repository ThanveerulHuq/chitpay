import { httpsCallable } from 'firebase/functions'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import type {
  BoardDoc,
  CycleDoc,
  GroupDoc,
  GroupMemberDoc,
  MembershipMirrorDoc,
  PaymentMethod,
} from '@shared'
import { functions, db } from './firebase'
import { auth } from './firebase'

export async function callCreateGroup(input: {
  name: string
  monthlyAmountMinor: number
  currency: string
  dueDay: number
  durationMonths: number
  startDate: string
  description?: string
  requirePaidToWin: boolean
}): Promise<string> {
  const call = httpsCallable<typeof input, { groupId: string }>(functions, 'createGroup')
  const res = await call(input)
  return res.data.groupId
}

export interface AddMemberResult {
  membershipId: string
  slotNo: number
  password: string
  isNewUser: boolean
}

export async function callAddMember(input: {
  groupId: string
  name: string
  phone: string
  allowDuplicateSlot?: boolean
}): Promise<AddMemberResult> {
  const call = httpsCallable<typeof input, AddMemberResult>(functions, 'addMember')
  const res = await call(input)
  return res.data
}

export async function fetchMyGroups(): Promise<{ id: string; data: GroupDoc }[]> {
  const user = auth.currentUser
  if (!user) return []
  const token = await user.getIdTokenResult()
  const roles = token.claims.roles as string[] | undefined
  const isAdmin = roles?.includes('admin')
  
  const q = isAdmin 
    ? query(collection(db, 'groups')) 
    : query(collection(db, 'groups'), where('adminUid', '==', user.uid))
    
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

export async function callStartNextCycle(groupId: string): Promise<void> {
  const call = httpsCallable<{ groupId: string }, { ok: boolean }>(functions, 'startNextCycle')
  await call({ groupId })
}

export async function callMarkPaid(input: {
  groupId: string
  membershipId: string
  method: PaymentMethod
  referenceNo?: string
  note?: string
}): Promise<void> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'markPaid')
  await call(input)
}

export async function callSendReminder(input: {
  groupId: string
  membershipId?: string
}): Promise<{ sent: number; total: number; overdue: boolean }> {
  const call = httpsCallable<typeof input, { sent: number; total: number; overdue: boolean }>(
    functions,
    'sendReminder',
  )
  const res = await call(input)
  return res.data
}

export async function callConfirmSelection(input: {
  groupId: string
  membershipId: string
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
  amountMinor?: number
}): Promise<{ ok: boolean; completedGroup: boolean }> {
  const call = httpsCallable<typeof input, { ok: boolean; completedGroup: boolean }>(
    functions,
    'recordPayout',
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
