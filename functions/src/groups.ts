import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  generateMemberPassword,
  normalizePhone,
} from '@chitapp/shared'
import type { BoardDoc, BoardEntry, GroupDoc, PaymentDoc } from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { syntheticEmail, assertAdminAccess } from './auth.js'


interface CreateGroupInput {
  name: string
  monthlyAmountMinor: number
  currency: string
  dueDay: number
  durationMonths: number
  startDate: string
  description?: string
  requirePaidToWin: boolean
}


function assertAdminOf(authObj: any, groupId: string): Promise<GroupDoc> {
  return db
    .doc(`groups/${groupId}`)
    .get()
    .then((snap) => {
      const data = snap.data() as GroupDoc | undefined
      if (!snap.exists || !data) throw new AppError('not_found')
      assertAdminAccess(authObj, data)
      return data
    })
}

export { assertAdminOf }

export const createGroup = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const isAdminRole = Array.isArray(req.auth?.token?.roles) && req.auth?.token?.roles.includes('admin')
    if (!isAdminRole) throw new AppError('permission_denied')
    const input = req.data as CreateGroupInput

    const name = String(input.name ?? '').trim()
    const monthlyAmountMinor = Math.floor(Number(input.monthlyAmountMinor))
    const dueDay = Math.floor(Number(input.dueDay))
    const durationMonths = Math.floor(Number(input.durationMonths))
    const startDate = String(input.startDate ?? '')

    if (!name) throw new AppError('invalid_argument', 'Group name is required.')
    if (!(monthlyAmountMinor > 0)) throw new AppError('invalid_argument', 'Invalid contribution.')
    if (!(dueDay >= 1 && dueDay <= 28)) throw new AppError('invalid_argument', 'Due day must be 1–28.')
    if (!(durationMonths >= 1)) throw new AppError('invalid_argument', 'Invalid duration.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new AppError('invalid_argument', 'Invalid start date.')

    const group: GroupDoc = {
      adminUid: uid,
      name,
      monthlyAmountMinor,
      currency: String(input.currency ?? 'INR'),
      dueDay,
      durationMonths,
      startDate,
      description: input.description?.trim() || undefined,
      requirePaidToWin: Boolean(input.requirePaidToWin),
      status: 'active',
      currentCycleNumber: 0,
      memberCount: 0,
      paidCount: 0,
      collectedAmountMinor: 0,
      financialSummaryVersion: 1,
      createdAt: FieldValue.serverTimestamp() as unknown as number,
    }

    const ref = await db.collection('groups').add(group)
    // Admin gets the same groupAccess marker members get, so security rules
    // (which rely on marker exists() checks) authorize admin reads too.
    await db.doc(`users/${uid}/groupAccess/${ref.id}`).set({ membershipIds: [] })
    return { groupId: ref.id }
  } catch (err) {
    throw toHttpsError(err, { fn: 'createGroup', uid: req.auth?.uid, data: req.data })
  }
})

interface AddMemberInput {
  groupId: string
  name: string
  phone: string
  allowDuplicateSlot?: boolean
}

export const addMember = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const adminUid = req.auth?.uid
    if (!adminUid) throw new AppError('unauthenticated')
    const input = req.data as AddMemberInput

    const group = await assertAdminOf(req.auth, String(input.groupId ?? ''))
    const name = String(input.name ?? '').trim()
    const phone = normalizePhone(String(input.phone ?? ''))
    if (!name) throw new AppError('invalid_argument', 'Member name is required.')

    // Duplicate-slot guard: same person already has an active slot in this group.
    const existingUser = await auth
      .getUserByEmail(syntheticEmail(phone))
      .catch(() => null)
    if (existingUser && !input.allowDuplicateSlot) {
      const dup = await db
        .collection(`groups/${input.groupId}/members`)
        .where('uid', '==', existingUser.uid)
        .where('status', '==', 'active')
        .limit(1)
        .get()
      if (!dup.empty) {
        throw new AppError(
          'already_exists',
          'This number is already a member of this group. Add again with confirmation to create a second slot.',
        )
      }
    }

    const password = generateMemberPassword()
    let uid: string
    let isNewUser: boolean
    if (existingUser) {
      uid = existingUser.uid
      isNewUser = false
    } else {
      const user = await auth.createUser({
        email: syntheticEmail(phone),
        emailVerified: true,
        displayName: name,
        password,
      })
      uid = user.uid
      isNewUser = true
      await db.doc(`users/${uid}`).set({
        name,
        phone,
        roles: ['member'],
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    const result = await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${input.groupId}`)
      const snap = await tx.get(groupRef)
      if (!snap.exists) throw new AppError('not_found')
      const memberCount = (snap.data() as GroupDoc).memberCount ?? 0
      const slotNo = memberCount + 1
      const memberRef = groupRef.collection('members').doc()
      const membershipId = memberRef.id
      let currentBoard: BoardDoc | undefined
      if (group.currentCycleNumber > 0) {
        const boardSnap = await tx.get(
          groupRef.collection('cycles').doc(String(group.currentCycleNumber)).collection('board').doc('board'),
        )
        currentBoard = boardSnap.data() as BoardDoc | undefined
      }

      tx.set(memberRef, {
        uid,
        slotNo,
        displayName: name,
        status: 'active',
        selectedInCycle: null,
        totalContributedMinor: 0,
        paidCycleCount: 0,
        joinedAt: FieldValue.serverTimestamp(),
      })
      tx.update(groupRef, { memberCount: FieldValue.increment(1) })

      // A member added after a cycle starts joins that cycle as a pending slot.
      if (group.currentCycleNumber > 0) {
        const cycleRef = groupRef.collection('cycles').doc(String(group.currentCycleNumber))
        const boardRef = cycleRef.collection('board').doc('board')
        tx.set(cycleRef.collection('payments').doc(membershipId), {
          amountMinor: group.monthlyAmountMinor,
          status: 'pending',
          method: null,
          referenceNo: null,
          note: null,
          paidAt: null,
          recordedBy: null,
          updatedAt: null,
        } satisfies PaymentDoc)
        if (currentBoard) {
          const entry: BoardEntry = { membershipId, name, status: 'pending', method: null }
          tx.set(boardRef, { entries: [...currentBoard.entries, entry] } satisfies BoardDoc)
        }
      }

      // member-side mirrors
      tx.set(db.doc(`users/${uid}/memberships/${membershipId}`), {
        groupId: input.groupId,
        groupName: group.name,
        membershipId,
        monthlyAmountMinor: group.monthlyAmountMinor,
        currency: group.currency,
        status: 'active',
        myPaymentStatus: null,
        selectedInCycle: null,
        joinedAt: FieldValue.serverTimestamp(),
      })
      tx.set(db.doc(`users/${uid}/groupAccess/${input.groupId}`), {
        membershipIds: FieldValue.arrayUnion(membershipId),
      })

      return { membershipId, slotNo }
    })

    return {
      membershipId: result.membershipId,
      slotNo: result.slotNo,
      uid,
      password,
      isNewUser,
    }
  } catch (err) {
    throw toHttpsError(err, { fn: 'addMember', uid: req.auth?.uid, data: req.data })
  }
})
