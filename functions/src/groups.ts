import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  assertGroupWritable,
  contributionInPaise,
  generateCycleSchedule,
  isStartDateEditable,
  isValidIsoDate,
  normalizePhone,
  resolveMessageLanguage,
  resolveUnarchiveStatus,
} from '@chitapp/shared'
import type { BoardDoc, BoardEntry, CycleDoc, CycleFrequency, GroupDoc, GroupMemberDoc, MessageLogDoc, PaymentDoc, UserDoc } from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { syntheticEmail, assertAdminAccess, groupAdminLanguage, sendLoginOtp } from './auth.js'
import { writeUserMessage } from './messageLog.js'


interface CreateGroupInput {
  name: string
  contributionAmountInPaise: number
  frequency: CycleFrequency
  cycleCount: number
  startDate: string
  description?: string
  showOtherMembers?: boolean
  showOtherMemberDues?: boolean
}

interface UpdateGroupSettingsInput {
  groupId: string
  name: string
  showOtherMembers: boolean
  showOtherMemberDues: boolean
  startDate?: string
}


async function assertAdminOf(authObj: any, groupId: string): Promise<GroupDoc> {
  const snap = await db.doc(`groups/${groupId}`).get()
  const data = snap.data() as GroupDoc | undefined
  if (!snap.exists || !data) throw new AppError('not_found')
  await assertAdminAccess(authObj, data)
  return data
}

export { assertAdminOf }

export const createGroup = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const adminProfile = await assertAdminAccess(req.auth)
    const input = req.data as CreateGroupInput

    const name = String(input.name ?? '').trim()
    const contributionAmountInPaise = Math.floor(Number(input.contributionAmountInPaise))
    const frequency = input.frequency as CycleFrequency
    const cycleCount = Math.floor(Number(input.cycleCount))
    const startDate = String(input.startDate ?? '')
    const description = input.description?.trim()
    const showOtherMembers = input.showOtherMembers !== false
    const showOtherMemberDues = showOtherMembers && input.showOtherMemberDues !== false

    if (!name) throw new AppError('invalid_argument', 'Group name is required.')
    if (!(contributionAmountInPaise > 0)) throw new AppError('invalid_argument', 'Invalid contribution.')
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
      providerId: adminProfile.providerId,
      name,
      contributionAmountInPaise,
      frequency,
      cycleCount,
      startDate,
      ...(description ? { description } : {}),
      showOtherMembers,
      showOtherMemberDues,
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

export const updateGroupSettings = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const input = req.data as UpdateGroupSettingsInput
    const groupId = String(input?.groupId ?? '')
    const name = String(input?.name ?? '').trim()
    if (!groupId) throw new AppError('invalid_argument', 'Group is required.')
    if (!name) throw new AppError('invalid_argument', 'Group name is required.')
    if (typeof input.showOtherMembers !== 'boolean' || typeof input.showOtherMemberDues !== 'boolean') {
      throw new AppError('invalid_argument', 'Invalid group visibility settings.')
    }

    const showOtherMembers = input.showOtherMembers
    const showOtherMemberDues = showOtherMembers && input.showOtherMemberDues
    const rawStartDate = input?.startDate === undefined ? undefined : String(input.startDate)
    if (rawStartDate !== undefined && !isValidIsoDate(rawStartDate)) {
      throw new AppError('invalid_argument', 'Invalid start date.')
    }

    let savedStartDate: string | undefined
    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group, tx)
      assertGroupWritable(group)

      const reschedule = rawStartDate !== undefined && rawStartDate !== group.startDate
      let schedule: string[] | null = null
      let cyclesSnap = null
      if (reschedule) {
        cyclesSnap = await tx.get(groupRef.collection('cycles'))
        const states = cyclesSnap.docs.map((cycleSnap) => {
          const cycle = cycleSnap.data() as CycleDoc
          const cycleNumber = Number.isInteger(cycle.cycleNumber)
            ? cycle.cycleNumber
            : Number(cycleSnap.id)
          return { cycleNumber, status: cycle.status }
        })
        if (!isStartDateEditable(states)) {
          throw new AppError('invalid_transition', 'Start date is locked after the first cycle starts.')
        }
        try {
          schedule = generateCycleSchedule(rawStartDate, group.frequency, group.cycleCount)
        } catch {
          throw new AppError('invalid_argument', 'Invalid start date.')
        }
      }

      const membersSnap = await tx.get(groupRef.collection('members'))
      tx.update(groupRef, {
        name,
        showOtherMembers,
        showOtherMemberDues,
        ...(reschedule ? { startDate: rawStartDate } : {}),
      })
      if (reschedule && cyclesSnap && schedule) {
        for (const cycleSnap of cyclesSnap.docs) {
          const cycle = cycleSnap.data() as CycleDoc
          if (cycle.status !== 'upcoming') continue
          const cycleNumber = Number.isInteger(cycle.cycleNumber)
            ? cycle.cycleNumber
            : Number(cycleSnap.id)
          const plannedStartDate = schedule[cycleNumber - 1]
          if (!plannedStartDate) continue
          tx.update(cycleSnap.ref, { plannedStartDate })
        }
      }
      for (const memberSnap of membersSnap.docs) {
        const member = memberSnap.data() as GroupMemberDoc
        if (member.status !== 'active') continue
        tx.set(
          db.doc(`users/${member.uid}/memberships/${memberSnap.id}`),
          { groupName: name },
          { merge: true },
        )
      }
      savedStartDate = reschedule ? rawStartDate : group.startDate
    })

    return { ok: true, name, showOtherMembers, showOtherMemberDues, startDate: savedStartDate }
  } catch (err) {
    throw toHttpsError(err, { fn: 'updateGroupSettings', uid: req.auth?.uid, data: req.data })
  }
})

interface GroupArchiveInput {
  groupId: string
}

export const archiveGroup = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const groupId = String((req.data as GroupArchiveInput)?.groupId ?? '')
    if (!groupId) throw new AppError('invalid_argument', 'Group is required.')

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group, tx)
      if (group.status === 'archived') {
        throw new AppError('invalid_transition', 'This group is already archived.')
      }
      tx.update(groupRef, {
        status: 'archived',
        statusBeforeArchive: group.status,
        archivedAt: FieldValue.serverTimestamp(),
        archivedBy: req.auth!.uid,
      })
    })

    return { ok: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'archiveGroup', uid: req.auth?.uid, data: req.data })
  }
})

export const unarchiveGroup = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const groupId = String((req.data as GroupArchiveInput)?.groupId ?? '')
    if (!groupId) throw new AppError('invalid_argument', 'Group is required.')

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group, tx)
      const restoredStatus = resolveUnarchiveStatus(group)
      tx.update(groupRef, {
        status: restoredStatus,
        statusBeforeArchive: FieldValue.delete(),
        archivedAt: FieldValue.delete(),
        archivedBy: FieldValue.delete(),
      })
    })

    return { ok: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'unarchiveGroup', uid: req.auth?.uid, data: req.data })
  }
})

interface AddMemberInput {
  groupId: string
  name: string
  phone: string
  chitCount?: number
  confirmExistingShares?: boolean
}

interface GroupPhoneInput {
  groupId: string
  phone: string
}

function uniqueNames(members: GroupMemberDoc[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const member of members.sort((a, b) => (a.slotNo ?? 0) - (b.slotNo ?? 0))) {
    const name = member.displayName.trim()
    const key = name.toLocaleLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

export const inspectGroupMemberPhone = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const input = req.data as GroupPhoneInput
    const groupId = String(input?.groupId ?? '')
    if (!groupId) throw new AppError('invalid_argument', 'Group is required.')
    const phone = normalizePhone(String(input?.phone ?? ''))
    await assertAdminOf(req.auth, groupId)
    const existingUser = await auth.getUserByEmail(syntheticEmail(phone)).catch(() => null)
    if (!existingUser) return { exists: false, names: [], shareCount: 0 }
    const slots = await db.collection(`groups/${groupId}/members`)
      .where('uid', '==', existingUser.uid)
      .where('status', '==', 'active')
      .get()
    const members = slots.docs.map((doc) => doc.data() as GroupMemberDoc)
    return { exists: members.length > 0, names: uniqueNames(members), shareCount: members.length }
  } catch (err) {
    throw toHttpsError(err, { fn: 'inspectGroupMemberPhone', uid: req.auth?.uid, data: req.data })
  }
})

export const listGroupMemberContacts = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const groupId = String((req.data as { groupId?: unknown })?.groupId ?? '')
    if (!groupId) throw new AppError('invalid_argument', 'Group is required.')
    await assertAdminOf(req.auth, groupId)
    const memberSnap = await db.collection(`groups/${groupId}/members`).where('status', '==', 'active').get()
    const uids = [...new Set(memberSnap.docs.map((doc) => (doc.data() as GroupMemberDoc).uid).filter(Boolean))]
    const profiles = uids.length ? await db.getAll(...uids.map((uid) => db.doc(`users/${uid}`))) : []
    return {
      contacts: profiles.map((profile) => ({
        uid: profile.id,
        phone: String((profile.data() as UserDoc | undefined)?.phone ?? ''),
      })),
    }
  } catch (err) {
    throw toHttpsError(err, { fn: 'listGroupMemberContacts', uid: req.auth?.uid, data: req.data })
  }
})

export const addMember = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const actorUid = req.auth?.uid
    if (!actorUid) throw new AppError('unauthenticated')
    const input = req.data as AddMemberInput

    const group = await assertAdminOf(req.auth, String(input.groupId ?? ''))
    assertGroupWritable(group)
    if ((group.completedCycleCount ?? 0) > 0) {
      throw new AppError('invalid_transition', 'Members are locked after the first completed cycle.')
    }
    const name = String(input.name ?? '').trim()
    const phone = normalizePhone(String(input.phone ?? ''))
    const chitCount = Number(input.chitCount ?? 1)
    if (!name) throw new AppError('invalid_argument', 'Member name is required.')
    if (!Number.isInteger(chitCount) || chitCount < 1 || chitCount > 100) {
      throw new AppError('invalid_argument', 'Number of shares must be between 1 and 100.')
    }

    const existingUser = await auth
      .getUserByEmail(syntheticEmail(phone))
      .catch(() => null)

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
      const currentGroup = snap.data() as GroupDoc
      assertGroupWritable(currentGroup)
      const memberCount = currentGroup.memberCount ?? 0
      const allMembersSnap = await tx.get(groupRef.collection('members'))
      const existingActiveSlots = allMembersSnap.docs.filter((memberDoc) => {
        const member = memberDoc.data() as GroupMemberDoc
        return member.uid === uid && member.status === 'active'
      })
      if (existingActiveSlots.length > 0 && input.confirmExistingShares !== true) {
        throw new AppError('invalid_transition', 'Confirm that you want to add shares to this existing mobile number.')
      }
      if (existingActiveSlots.length + chitCount > 100) {
        throw new AppError('invalid_argument', 'A member cannot have more than 100 shares in a group.')
      }
      const highestSlotNo = allMembersSnap.docs.reduce((highest, memberDoc) => {
        const member = memberDoc.data() as GroupMemberDoc
        return Math.max(highest, member.slotNo ?? 0)
      }, 0)
      const slots = Array.from({ length: chitCount }, (_, index) => ({
        memberRef: groupRef.collection('members').doc(),
        slotNo: highestSlotNo + index + 1,
      }))
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

      for (const { memberRef, slotNo } of slots) {
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
      }
      tx.update(groupRef, { memberCount: FieldValue.increment(chitCount) })

      // Before the first completion, a new member joins every active cycle.
      for (const { cycleSnap, board } of activeBoards) {
        const cycleRef = cycleSnap.ref
        const boardRef = cycleRef.collection('board').doc('board')
        for (const { memberRef } of slots) {
          tx.set(cycleRef.collection('payments').doc(memberRef.id), {
            amountMinor: contributionInPaise(currentGroup),
            status: 'pending',
            method: null,
            referenceNo: null,
            note: null,
            paidAt: null,
            recordedBy: null,
            updatedAt: null,
          } satisfies PaymentDoc)
        }
        if (board) {
          const entries: BoardEntry[] = slots.map(({ memberRef }) => ({
            membershipId: memberRef.id,
            name,
            status: 'pending',
            method: null,
          }))
          tx.set(boardRef, { entries: [...board.entries, ...entries] } satisfies BoardDoc)
        }
        tx.update(cycleRef, { expectedPaymentCount: FieldValue.increment(chitCount) })
      }

      // member-side mirrors
      for (const { memberRef } of slots) {
        tx.set(db.doc(`users/${uid}/memberships/${memberRef.id}`), {
          groupId: input.groupId,
          providerId: currentGroup.providerId,
          groupName: group.name,
          membershipId: memberRef.id,
          contributionAmountInPaise: contributionInPaise(currentGroup),
          status: 'active',
          selectedInCycle: null,
          joinedAt: FieldValue.serverTimestamp(),
        })
      }
      const membershipIds = slots.map(({ memberRef }) => memberRef.id)
      tx.set(db.doc(`users/${uid}/groupAccess/${input.groupId}`), {
        membershipIds: FieldValue.arrayUnion(...membershipIds),
      })

      return { membershipIds, slotNos: slots.map(({ slotNo }) => slotNo) }
    })

    // Membership creation is complete before this best-effort external send. A
    // provider outage must not make the app retry and create a duplicate slot.
    let notificationSent = false
    let providerMessageId: string | null = null
    let notificationError: string | null = null
    try {
      const userSnap = await db.doc(`users/${uid}`).get()
      const user = userSnap.data() as UserDoc | undefined
      const language = resolveMessageLanguage(user?.language, await groupAdminLanguage(group))
      const response = await sendLoginOtp(phone, language)
      providerMessageId = response.providerMessageId
      notificationSent = true
    } catch (sendError) {
      notificationError = sendError instanceof Error ? sendError.message : String(sendError)
      console.error('member OTP notification failed:', sendError)
    }

    const messageLog: MessageLogDoc = {
      recipientUid: uid,
      groupId: input.groupId,
      template: 'login_code',
      toPhone: phone,
      membershipId: result.membershipIds[0]!,
      providerMessageId,
      status: notificationSent ? 'sent' : 'failed',
      error: notificationError,
      sentBy: actorUid,
      createdAt: FieldValue.serverTimestamp() as unknown as number,
      updatedAt: FieldValue.serverTimestamp() as unknown as number,
    }
    try {
      await writeUserMessage(messageLog)
    } catch (logError) {
      console.error('member OTP message log failed:', logError)
    }

    return {
      membershipId: result.membershipIds[0]!,
      slotNo: result.slotNos[0]!,
      membershipIds: result.membershipIds,
      chitCount,
      uid,
      isNewUser,
      notificationSent,
    }
  } catch (err) {
    throw toHttpsError(err, { fn: 'addMember', uid: req.auth?.uid, data: req.data })
  }
})

interface UpdateMemberChitCountInput {
  groupId: string
  membershipId: string
  chitCount: number
}

export const updateMemberChitCount = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const input = req.data as UpdateMemberChitCountInput
    const groupId = String(input.groupId ?? '')
    const membershipId = String(input.membershipId ?? '')
    const targetCount = Number(input.chitCount)
    if (!groupId || !membershipId || !Number.isInteger(targetCount) || targetCount < 1 || targetCount > 100) {
      throw new AppError('invalid_argument', 'Number of shares must be between 1 and 100.')
    }

    return await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const memberRef = groupRef.collection('members').doc(membershipId)
      const [groupSnap, memberSnap] = await Promise.all([tx.get(groupRef), tx.get(memberRef)])
      const group = groupSnap.data() as GroupDoc | undefined
      const member = memberSnap.data() as GroupMemberDoc | undefined
      if (!groupSnap.exists || !group || !memberSnap.exists || !member) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group, tx)
      assertGroupWritable(group)
      if ((group.completedCycleCount ?? 0) > 0) {
        throw new AppError('invalid_transition', 'Share counts are locked after the first completed cycle.')
      }
      if (member.status !== 'active') throw new AppError('invalid_argument', 'This membership is inactive.')

      const [personSlotsSnap, allMembersSnap, activeCyclesSnap] = await Promise.all([
        tx.get(groupRef.collection('members').where('uid', '==', member.uid).where('status', '==', 'active')),
        tx.get(groupRef.collection('members')),
        tx.get(groupRef.collection('cycles').where('status', '==', 'active')),
      ])
      const personSlots = personSlotsSnap.docs
        .map((slotDoc) => ({ ref: slotDoc.ref, id: slotDoc.id, data: slotDoc.data() as GroupMemberDoc }))
        .sort((a, b) => b.data.slotNo - a.data.slotNo)
      const currentCount = personSlots.length
      if (targetCount === currentCount) return { chitCount: currentCount }

      const activeCycles = await Promise.all(activeCyclesSnap.docs.map(async (cycleSnap) => {
        const boardSnap = await tx.get(cycleSnap.ref.collection('board').doc('board'))
        return { cycleSnap, board: boardSnap.data() as BoardDoc | undefined }
      }))

      if (targetCount > currentCount) {
        const addCount = targetCount - currentCount
        const highestSlotNo = allMembersSnap.docs.reduce((highest, slotDoc) => {
          const slot = slotDoc.data() as GroupMemberDoc
          return Math.max(highest, slot.slotNo ?? 0)
        }, 0)
        const newSlots = Array.from({ length: addCount }, (_, index) => ({
          ref: groupRef.collection('members').doc(),
          slotNo: highestSlotNo + index + 1,
        }))

        for (const slot of newSlots) {
          tx.set(slot.ref, {
            uid: member.uid,
            slotNo: slot.slotNo,
            displayName: member.displayName,
            status: 'active',
            selectedInCycle: null,
            totalContributedMinor: 0,
            paidCycleCount: 0,
            joinedAt: FieldValue.serverTimestamp(),
          })
          tx.set(db.doc(`users/${member.uid}/memberships/${slot.ref.id}`), {
            groupId,
            providerId: group.providerId,
            groupName: group.name,
            membershipId: slot.ref.id,
            contributionAmountInPaise: contributionInPaise(group),
            status: 'active',
            selectedInCycle: null,
            joinedAt: FieldValue.serverTimestamp(),
          })
        }

        for (const { cycleSnap, board } of activeCycles) {
          for (const slot of newSlots) {
            tx.set(cycleSnap.ref.collection('payments').doc(slot.ref.id), {
              amountMinor: contributionInPaise(group),
              status: 'pending',
              method: null,
              referenceNo: null,
              note: null,
              paidAt: null,
              recordedBy: null,
              updatedAt: null,
            } satisfies PaymentDoc)
          }
          if (board) {
            const entries: BoardEntry[] = newSlots.map((slot) => ({
              membershipId: slot.ref.id,
              name: member.displayName,
              status: 'pending',
              method: null,
            }))
            tx.set(cycleSnap.ref.collection('board').doc('board'), { entries: [...board.entries, ...entries] } satisfies BoardDoc)
          }
          tx.update(cycleSnap.ref, { expectedPaymentCount: FieldValue.increment(addCount) })
        }

        const newIds = newSlots.map((slot) => slot.ref.id)
        tx.set(db.doc(`users/${member.uid}/groupAccess/${groupId}`), {
          membershipIds: FieldValue.arrayUnion(...newIds),
        }, { merge: true })
        tx.update(groupRef, { memberCount: FieldValue.increment(addCount) })
        return { chitCount: targetCount }
      }

      const removeCount = currentCount - targetCount
      const unusedCandidates = personSlots.filter(({ data }) =>
        data.selectedInCycle == null
        && (data.totalContributedMinor ?? 0) === 0
        && (data.paidCycleCount ?? 0) === 0,
      )
      const candidateActivity = await Promise.all(unusedCandidates.map(async (candidate) => {
        const activity = await Promise.all(activeCycles.map(async ({ cycleSnap }) => {
          const [paymentSnap, eventsSnap] = await Promise.all([
            tx.get(cycleSnap.ref.collection('payments').doc(candidate.id)),
            tx.get(groupRef.collection('paymentEvents').where('membershipId', '==', candidate.id).limit(1)),
          ])
          const payment = paymentSnap.data() as PaymentDoc | undefined
          return Boolean((payment && payment.status === 'paid') || !eventsSnap.empty)
        }))
        return { candidate, hasActivity: activity.some(Boolean) }
      }))
      const removable = candidateActivity.filter(({ hasActivity }) => !hasActivity).slice(0, removeCount)
      if (removable.length < removeCount) {
        throw new AppError(
          'invalid_transition',
          `Cannot reduce below ${currentCount - removable.length}; some shares already have payment or selection activity.`,
        )
      }

      const removeIds = removable.map(({ candidate }) => candidate.id)
      const removeIdSet = new Set(removeIds)
      for (const { candidate } of removable) {
        tx.delete(candidate.ref)
        tx.delete(db.doc(`users/${member.uid}/memberships/${candidate.id}`))
      }
      for (const { cycleSnap, board } of activeCycles) {
        for (const id of removeIds) tx.delete(cycleSnap.ref.collection('payments').doc(id))
        if (board) {
          tx.set(cycleSnap.ref.collection('board').doc('board'), {
            entries: board.entries.filter((entry) => !removeIdSet.has(entry.membershipId)),
          } satisfies BoardDoc)
        }
        tx.update(cycleSnap.ref, { expectedPaymentCount: FieldValue.increment(-removeCount) })
      }
      tx.set(db.doc(`users/${member.uid}/groupAccess/${groupId}`), {
        membershipIds: FieldValue.arrayRemove(...removeIds),
      }, { merge: true })
      tx.update(groupRef, { memberCount: FieldValue.increment(-removeCount) })
      return { chitCount: targetCount }
    })
  } catch (err) {
    throw toHttpsError(err, { fn: 'updateMemberChitCount', uid: req.auth?.uid, data: req.data })
  }
})
