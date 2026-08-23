import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  formatMinor,
} from '@chitapp/shared'
import type {
  BoardDoc,
  BoardEntry,
  CycleDoc,
  GroupDoc,
  GroupMemberDoc,
  MessageLogDoc,
  PaymentDoc,
  PaymentEventDoc,
  PaymentEventSnapshot,
  PaymentMethod,
  UserDoc,
} from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { assertAdminAccess } from './auth.js'
import { messaging } from './messaging.js'


const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'bank_transfer', 'other']

function paymentSnapshot(payment: PaymentDoc): PaymentEventSnapshot {
  return {
    status: payment.status,
    amountMinor: payment.amountMinor,
    method: payment.method,
    referenceNo: payment.referenceNo,
    note: payment.note,
    paidAt: payment.paidAt,
  }
}

interface StartCycleInput {
  groupId: string
  cycleNumber: number
}

export const startCycle = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, cycleNumber } = req.data as StartCycleInput

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      assertAdminAccess(req.auth, group)
      if (group.status !== 'active') {
        throw new AppError('invalid_transition', 'This group is not active.')
      }

      const n = Math.floor(Number(cycleNumber))
      if (!(n >= 1 && n <= group.cycleCount)) throw new AppError('invalid_argument')
      const cycleRef = groupRef.collection('cycles').doc(String(n))
      const cycleSnap = await tx.get(cycleRef)
      const existing = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !existing) throw new AppError('not_found')
      if (existing.status !== 'upcoming') {
        throw new AppError('already_exists', 'This cycle has already been started.')
      }

      const membersSnap = await tx.get(
        groupRef.collection('members').where('status', '==', 'active'),
      )
      if (membersSnap.empty) {
        throw new AppError('invalid_transition', 'Add members before starting a cycle.')
      }

      const entries = membersSnap.docs.map((m) => {
        const member = m.data() as GroupMemberDoc
        tx.set(cycleRef.collection('payments').doc(m.id), {
          amountMinor: group.contributionAmountMinor,
          status: 'pending',
          method: null,
          referenceNo: null,
          note: null,
          paidAt: null,
          recordedBy: null,
          updatedAt: null,
        } satisfies PaymentDoc)
        return {
          membershipId: m.id,
          name: member.displayName,
          status: 'pending',
          method: null,
        } satisfies BoardEntry
      })
      tx.set(cycleRef.collection('board').doc('board'), {
        entries,
      } satisfies BoardDoc)

      tx.update(cycleRef, {
        status: 'active',
        startedAt: FieldValue.serverTimestamp(),
        expectedPaymentCount: entries.length,
      })
      tx.update(groupRef, { activeCycleCount: FieldValue.increment(1) })

    })

    return { ok: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'startCycle', uid: req.auth?.uid, data: req.data })
  }
})

interface MarkPaidInput {
  groupId: string
  membershipId: string
  method: PaymentMethod
  cycleNumber: number
  referenceNo?: string
  note?: string
}

export const markPaid = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const input = req.data as MarkPaidInput

    const method = input.method as PaymentMethod
    if (!PAYMENT_METHODS.includes(method)) {
      throw new AppError('invalid_argument', 'Invalid payment method.')
    }

    let alreadyPaid = false

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${input.groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      assertAdminAccess(req.auth, group)

      const n = Math.floor(Number(input.cycleNumber))
      if (!n || n < 1) {
        throw new AppError('invalid_argument', 'A cycle number is required.')
      }

      const cycleRef = groupRef.collection('cycles').doc(String(n))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (cycle.status !== 'active') {
        throw new AppError('invalid_transition', 'Payments require an active cycle.')
      }

      const memberRef = groupRef.collection('members').doc(input.membershipId)
      const memberSnap = await tx.get(memberRef)
      const member = memberSnap.data() as GroupMemberDoc | undefined
      if (!memberSnap.exists || !member) throw new AppError('not_found')

      const paymentRef = cycleRef.collection('payments').doc(input.membershipId)
      const paymentSnap = await tx.get(paymentRef)
      const payment = paymentSnap.data() as PaymentDoc | undefined
      if (!paymentSnap.exists || !payment) throw new AppError('not_found')
      if (payment?.status === 'paid') {
        // Idempotent: marking an already-paid slot succeeds without changes.
        alreadyPaid = true
        return
      }

      const boardRef = cycleRef.collection('board').doc('board')
      const boardSnap = await tx.get(boardRef)
      const board = boardSnap.data() as BoardDoc | undefined

      const now = FieldValue.serverTimestamp() as unknown as number
      const nextPayment: PaymentDoc = {
        amountMinor: group.contributionAmountMinor,
        status: 'paid',
        method,
        referenceNo: input.referenceNo?.trim() || null,
        note: input.note?.trim() || null,
        paidAt: now,
        recordedBy: uid,
        updatedAt: now,
      }
      tx.set(paymentRef, nextPayment)

      if (board) {
        const entries = board.entries.map((e) =>
          e.membershipId === input.membershipId
            ? { ...e, status: 'paid' as const, method }
            : e,
        )
        tx.set(boardRef, { entries })
      }

      tx.update(memberRef, {
        totalContributedMinor: FieldValue.increment(group.contributionAmountMinor),
        paidCycleCount: FieldValue.increment(1),
      })
      tx.update(cycleRef, {
        paidCount: FieldValue.increment(1),
        collectedAmountMinor: FieldValue.increment(group.contributionAmountMinor),
      })
      const event: PaymentEventDoc = {
        groupId: input.groupId,
        cycleNumber: n,
        membershipId: input.membershipId,
        type: 'recorded',
        before: payment ? paymentSnapshot(payment) : null,
        after: paymentSnapshot(nextPayment),
        reason: null,
        performedBy: uid,
        createdAt: now,
      }
      tx.set(cycleRef.collection('paymentEvents').doc(), event)

    })

    return { ok: true, alreadyPaid }
  } catch (err) {
    throw toHttpsError(err, { fn: 'markPaid', uid: req.auth?.uid, data: req.data })
  }
})

interface SendReminderInput {
  groupId: string
  cycleNumber: number
  membershipId?: string // omit to remind all unpaid members
}

export const sendReminder = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, cycleNumber, membershipId } = req.data as SendReminderInput

    const groupRef = db.doc(`groups/${groupId}`)
    const groupSnap = await groupRef.get()
    const group = groupSnap.data() as GroupDoc | undefined
    if (!groupSnap.exists || !group) throw new AppError('not_found')
    assertAdminAccess(req.auth, group)

    const n = Math.floor(Number(cycleNumber))
    if (!n || n < 1) {
      throw new AppError('invalid_argument', 'A cycle number is required.')
    }

    const cycleRef = groupRef.collection('cycles').doc(String(n))
    const cycleSnap = await cycleRef.get()
    const cycle = cycleSnap.data() as CycleDoc | undefined
    if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
    if (cycle.status !== 'active') {
      throw new AppError('invalid_transition', 'Reminders require an active cycle.')
    }

    const boardSnap = await cycleRef.collection('board').doc('board').get()
    const board = boardSnap.data() as BoardDoc | undefined
    if (!board) throw new AppError('not_found')

    const template = 'payment_reminder'

    let targets = board.entries.filter((e) => e.status === 'pending')
    if (membershipId) targets = targets.filter((e) => e.membershipId === membershipId)

    let sent = 0
    for (const entry of targets) {
      const memberSnap = await groupRef.collection('members').doc(entry.membershipId).get()
      const member = memberSnap.data() as GroupMemberDoc | undefined
      if (!member) continue

      const userSnap = await db.doc(`users/${member.uid}`).get()
      const user = userSnap.data() as UserDoc | undefined
      if (!user?.phone) continue

      let error: string | null = null
      let providerMessageId: string | null = null
      try {
        const language = user.language ?? 'en'
        const res = await messaging.sendTemplate(user.phone, template, {
          member_name: member.displayName,
          group_name: group.name,
          contribution_amount: formatMinor(group.contributionAmountMinor, group.currency),
          group_id: groupId,
        }, language)
        providerMessageId = res.providerMessageId
        sent++
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      const log: MessageLogDoc = {
        groupId,
        cycleNumber: n,
        template,
        toPhone: user.phone,
        membershipId: entry.membershipId,
        providerMessageId,
        status: error ? 'failed' : 'sent',
        error,
        sentBy: uid,
        createdAt: FieldValue.serverTimestamp() as unknown as number,
        updatedAt: FieldValue.serverTimestamp() as unknown as number,
      }
      await groupRef.collection('messages').add(log)
    }

    return { sent, total: targets.length }
  } catch (err) {
    throw toHttpsError(err, { fn: 'sendReminder', uid: req.auth?.uid, data: req.data })
  }
})

interface EditPaymentInput {
  groupId: string
  cycleNumber: number
  membershipId: string
  method: PaymentMethod
  referenceNo?: string
  note?: string
  reason: string
}

export const editPayment = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const input = req.data as EditPaymentInput
    if (!PAYMENT_METHODS.includes(input.method) || !input.reason?.trim()) {
      throw new AppError('invalid_argument', 'A payment method and correction reason are required.')
    }

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${input.groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      assertAdminAccess(req.auth, group)

      const cycleRef = groupRef.collection('cycles').doc(String(input.cycleNumber))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (cycle.status !== 'active') throw new AppError('invalid_transition', 'Payments require an active cycle.')
      const paymentRef = cycleRef.collection('payments').doc(input.membershipId)
      const paymentSnap = await tx.get(paymentRef)
      const payment = paymentSnap.data() as PaymentDoc | undefined
      if (!paymentSnap.exists || !payment || payment.status !== 'paid') {
        throw new AppError('invalid_transition', 'Only recorded payments can be edited.')
      }

      const boardRef = cycleRef.collection('board').doc('board')
      const boardSnap = await tx.get(boardRef)
      const board = boardSnap.data() as BoardDoc | undefined

      const now = FieldValue.serverTimestamp() as unknown as number
      const nextPayment: PaymentDoc = {
        ...payment,
        method: input.method,
        referenceNo: input.referenceNo?.trim() || null,
        note: input.note?.trim() || null,
        updatedAt: now,
      }
      tx.set(paymentRef, nextPayment)

      if (board) {
        tx.set(boardRef, {
          entries: board.entries.map((entry) =>
            entry.membershipId === input.membershipId
              ? { ...entry, method: input.method }
              : entry,
          ),
        })
      }

      const event: PaymentEventDoc = {
        groupId: input.groupId,
        cycleNumber: input.cycleNumber,
        membershipId: input.membershipId,
        type: 'edited',
        before: paymentSnapshot(payment),
        after: paymentSnapshot(nextPayment),
        reason: input.reason.trim(),
        performedBy: uid,
        createdAt: now,
      }
      tx.set(cycleRef.collection('paymentEvents').doc(), event)
    })
    return { ok: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'editPayment', uid: req.auth?.uid, data: req.data })
  }
})

interface ReversePaymentInput {
  groupId: string
  cycleNumber: number
  membershipId: string
  reason: string
}

export const reversePayment = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const input = req.data as ReversePaymentInput
    if (!input.reason?.trim()) throw new AppError('invalid_argument', 'A reversal reason is required.')

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${input.groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      assertAdminAccess(req.auth, group)

      const cycleRef = groupRef.collection('cycles').doc(String(input.cycleNumber))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (cycle.status !== 'active') throw new AppError('invalid_transition', 'Payments require an active cycle.')
      const memberRef = groupRef.collection('members').doc(input.membershipId)
      const memberSnap = await tx.get(memberRef)
      const member = memberSnap.data() as GroupMemberDoc | undefined
      if (!memberSnap.exists || !member) throw new AppError('not_found')

      const paymentRef = cycleRef.collection('payments').doc(input.membershipId)
      const paymentSnap = await tx.get(paymentRef)
      const payment = paymentSnap.data() as PaymentDoc | undefined
      if (!paymentSnap.exists || !payment || payment.status !== 'paid') {
        throw new AppError('invalid_transition', 'This payment is not currently recorded.')
      }

      const boardRef = cycleRef.collection('board').doc('board')
      const boardSnap = await tx.get(boardRef)
      const board = boardSnap.data() as BoardDoc | undefined

      const now = FieldValue.serverTimestamp() as unknown as number
      const nextPayment: PaymentDoc = {
        amountMinor: payment.amountMinor,
        status: 'pending',
        method: null,
        referenceNo: null,
        note: null,
        paidAt: null,
        recordedBy: null,
        updatedAt: now,
      }
      tx.set(paymentRef, nextPayment)

      if (board) {
        tx.set(boardRef, {
          entries: board.entries.map((entry) =>
            entry.membershipId === input.membershipId
              ? { ...entry, status: 'pending' as const, method: null }
              : entry,
          ),
        })
      }

      tx.update(memberRef, {
        totalContributedMinor: FieldValue.increment(-payment.amountMinor),
        paidCycleCount: FieldValue.increment(-1),
      })
      tx.update(cycleRef, {
        paidCount: FieldValue.increment(-1),
        collectedAmountMinor: FieldValue.increment(-payment.amountMinor),
      })

      const event: PaymentEventDoc = {
        groupId: input.groupId,
        cycleNumber: input.cycleNumber,
        membershipId: input.membershipId,
        type: 'reversed',
        before: paymentSnapshot(payment),
        after: paymentSnapshot(nextPayment),
        reason: input.reason.trim(),
        performedBy: uid,
        createdAt: now,
      }
      tx.set(cycleRef.collection('paymentEvents').doc(), event)
    })
    return { ok: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'reversePayment', uid: req.auth?.uid, data: req.data })
  }
})
