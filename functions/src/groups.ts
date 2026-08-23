import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  generateMemberPassword,
  generateCycleSchedule,
  normalizePhone,
} from '@chitapp/shared'
import type { BoardDoc, BoardEntry, CycleDoc, CycleFrequency, GroupDoc, PaymentDoc } from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { syntheticEmail, assertAdminAccess } from './auth.js'


interface CreateGroupInput {
  name: string
  contributionAmountMinor: number
  currency: string
  frequency: CycleFrequency
  cycleCount: number
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
    const contributionAmountMinor = Math.floor(Number(input.contributionAmountMinor))
    const frequency = input.frequency as CycleFrequency
    const cycleCount = Math.floor(Number(input.cycleCount))
    const startDate = String(input.startDate ?? '')

    if (!name) throw new AppError('invalid_argument', 'Group name is required.')
    if (!(contributionAmountMinor > 0)) throw new AppError('invalid_argument', 'Invalid contribution.')
    if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
      throw new AppError('invalid_argument', 'Invalid cycle frequency.')
    }
    if (!(cycleCount >= 1 && cycleCount <= 100)) {
      throw new AppError('invalid_argument', 'Cycle count must be between 1 and 100.')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new AppError('invalid_argument', 'Invalid start date.')
    let schedule: string[]
    try {
      schedule = generateCycleSchedule(startDate, frequency, cycleCount)
    } catch {
      throw new AppError('invalid_argument', 'Invalid cycle schedule.')
    }

    const group: GroupDoc = {
      adminUid: uid,
      name,
      contributionAmountMinor,
      currency: String(input.currency ?? 'INR'),
      frequency,
      cycleCount,
      startDate,
      description: input.description?.trim() || undefined,
      requirePaidToWin: Boolean(input.requirePaidToWin),
      status: 'active',
      memberCount: 0,
      activeCycleCount: 0,
      completedCycleCount: 0,
      createdAt: FieldValue.serverTimestamp() as unknown as number,
    }

    const ref = db.collection('groups').doc()
    const batch = db.batch()
    batch.set(ref, group)
    schedule.forEach((plannedStartDate, index) => {
      const cycle: CycleDoc = {
        cycleNumber: index + 1,
        plannedStartDate,
        startedAt: null,
        completedAt: null,
        status: 'upcoming',
        expectedPaymentCount: 0,
        recipientMembershipId: null,
        payout: { amountMinor: 0, status: 'pending', paidAt: null, recordedBy: null },
        paidCount: 0,
        collectedAmountMinor: 0,
        createdAt: FieldValue.serverTimestamp() as unknown as number,
      }
      batch.set(ref.collection('cycles').doc(String(index + 1)), cycle)
    })
    // Admin gets the same groupAccess marker members get, so security rules
    // (which rely on marker exists() checks) authorize admin reads too.
    batch.set(db.doc(`users/${uid}/groupAccess/${ref.id}`), { membershipIds: [] })
    await batch.commit()
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
    if ((group.completedCycleCount ?? 0) > 0) {
      throw new AppError('invalid_transition', 'Members are locked after the first completed cycle.')
    }
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
      const currentGroup = snap.data() as GroupDoc
      if ((currentGroup.completedCycleCount ?? 0) > 0) {
        throw new AppError('invalid_transition', 'Members are locked after the first completed cycle.')
      }
      const activeCyclesSnap = await tx.get(
        groupRef.collection('cycles').where('status', '==', 'active'),
      )
      const activeBoards = await Promise.all(activeCyclesSnap.docs.map(async (cycleSnap) => {
        const boardSnap = await tx.get(cycleSnap.ref.collection('board').doc('board'))
        return { cycleSnap, board: boardSnap.data() as BoardDoc | undefined }
      }))

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

      // Before the first completion, a new member joins every active cycle.
      for (const { cycleSnap, board } of activeBoards) {
        const cycleRef = cycleSnap.ref
        const boardRef = cycleRef.collection('board').doc('board')
        tx.set(cycleRef.collection('payments').doc(membershipId), {
          amountMinor: currentGroup.contributionAmountMinor,
          status: 'pending',
          method: null,
          referenceNo: null,
          note: null,
          paidAt: null,
          recordedBy: null,
          updatedAt: null,
        } satisfies PaymentDoc)
        if (board) {
          const entry: BoardEntry = { membershipId, name, status: 'pending', method: null }
          tx.set(boardRef, { entries: [...board.entries, entry] } satisfies BoardDoc)
        }
        tx.update(cycleRef, { expectedPaymentCount: FieldValue.increment(1) })
      }

      // member-side mirrors
      tx.set(db.doc(`users/${uid}/memberships/${membershipId}`), {
        groupId: input.groupId,
        groupName: group.name,
        membershipId,
        contributionAmountMinor: currentGroup.contributionAmountMinor,
        currency: group.currency,
        status: 'active',
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
