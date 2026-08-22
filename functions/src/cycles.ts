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
  PaymentMethod,
  UserDoc,
} from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { assertAdminAccess } from './auth.js'
import { messaging } from './messaging.js'


const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'bank_transfer', 'other']

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Adds months to a YYYY-MM-DD string, clamping the day to the target month. */
export function addMonthsClamped(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const anchor = new Date(Date.UTC(y, m - 1 + months, 1))
  const daysInMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate()
  anchor.setUTCDate(Math.min(d, daysInMonth))
  return anchor.toISOString().slice(0, 10)
}

interface StartNextCycleInput {
  groupId: string
}

export const startNextCycle = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId } = req.data as StartNextCycleInput

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      assertAdminAccess(req.auth, group)
      if (group.status !== 'active') {
        throw new AppError('invalid_transition', 'This group is not active.')
      }

      const next = (group.currentCycleNumber ?? 0) + 1
      if (next > group.durationMonths) {
        throw new AppError(
          'invalid_transition',
          'All months of this group are complete.',
        )
      }

      const cycleRef = groupRef.collection('cycles').doc(String(next))
      const existing = await tx.get(cycleRef)
      if (existing.exists) {
        throw new AppError('already_exists', 'This month has already been started.')
      }

      // Previous month must be closed (payout recorded) before a new one opens.
      if (group.currentCycleNumber >= 1) {
        const prevSnap = await tx.get(
          groupRef.collection('cycles').doc(String(group.currentCycleNumber)),
        )
        const prev = prevSnap.data() as CycleDoc | undefined
        if (!prevSnap.exists || !prev) throw new AppError('not_found')
        if (prev.status !== 'complete') throw new AppError('payout_pending')
      }

      const membersSnap = await tx.get(
        groupRef.collection('members').where('status', '==', 'active'),
      )
      if (membersSnap.empty) {
        throw new AppError('invalid_transition', 'Add members before starting a month.')
      }

      const periodStart = addMonthsClamped(group.startDate, next - 1)
      const [py, pm] = periodStart.split('-')
      const dueDate = `${py}-${pm}-${pad2(group.dueDay)}`

      const cycle: CycleDoc = {
        monthNumber: next,
        periodStart,
        dueDate,
        status: 'payment_open',
        recipientMembershipId: null,
        payout: { amountMinor: 0, status: 'pending', paidAt: null, recordedBy: null },
        createdAt: FieldValue.serverTimestamp() as unknown as number,
      }
      tx.set(cycleRef, cycle)

      const entries = membersSnap.docs.map((m) => {
        const member = m.data() as GroupMemberDoc
        tx.set(cycleRef.collection('payments').doc(m.id), {
          amountMinor: group.monthlyAmountMinor,
          status: 'pending',
          method: null,
          referenceNo: null,
          note: null,
          paidAt: null,
          recordedBy: null,
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

      tx.update(groupRef, {
        currentCycleNumber: next,
        paidCount: 0,
        collectedAmountMinor: 0,
      })

      // Reset member mirrors for the new month.
      for (const m of membersSnap.docs) {
        const member = m.data() as GroupMemberDoc
        tx.set(
          db.doc(`users/${member.uid}/memberships/${m.id}`),
          { myPaymentStatus: 'pending', selectedInCycle: null },
          { merge: true },
        )
      }
    })

    return { ok: true }
  } catch (err) {
    throw toHttpsError(err)
  }
})

interface MarkPaidInput {
  groupId: string
  membershipId: string
  method: PaymentMethod
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

      const n = group.currentCycleNumber
      if (!n || n < 1) {
        throw new AppError('invalid_transition', 'No month is open yet.')
      }

      const cycleRef = groupRef.collection('cycles').doc(String(n))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (cycle.status !== 'payment_open') {
        throw new AppError(
          'invalid_transition',
          'Payments can only be recorded while the month is open.',
        )
      }

      const memberRef = groupRef.collection('members').doc(input.membershipId)
      const memberSnap = await tx.get(memberRef)
      const member = memberSnap.data() as GroupMemberDoc | undefined
      if (!memberSnap.exists || !member) throw new AppError('not_found')

      const paymentRef = cycleRef.collection('payments').doc(input.membershipId)
      const paymentSnap = await tx.get(paymentRef)
      const payment = paymentSnap.data() as PaymentDoc | undefined
      if (payment?.status === 'paid') {
        // Idempotent: marking an already-paid slot succeeds without changes.
        alreadyPaid = true
        return
      }

      const now = FieldValue.serverTimestamp() as unknown as number
      tx.set(paymentRef, {
        amountMinor: group.monthlyAmountMinor,
        status: 'paid',
        method,
        referenceNo: input.referenceNo?.trim() || null,
        note: input.note?.trim() || null,
        paidAt: now,
        recordedBy: uid,
      } satisfies PaymentDoc)

      const boardRef = cycleRef.collection('board').doc('board')
      const boardSnap = await tx.get(boardRef)
      const board = boardSnap.data() as BoardDoc | undefined
      if (board) {
        const entries = board.entries.map((e) =>
          e.membershipId === input.membershipId
            ? { ...e, status: 'paid' as const, method }
            : e,
        )
        tx.set(boardRef, { entries })
      }

      tx.update(groupRef, {
        paidCount: FieldValue.increment(1),
        collectedAmountMinor: FieldValue.increment(group.monthlyAmountMinor),
      })

      tx.set(
        db.doc(`users/${member.uid}/memberships/${input.membershipId}`),
        { myPaymentStatus: 'paid' },
        { merge: true },
      )
    })

    return { ok: true, alreadyPaid }
  } catch (err) {
    throw toHttpsError(err)
  }
})

interface SendReminderInput {
  groupId: string
  membershipId?: string // omit to remind all unpaid members
}

export const sendReminder = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, membershipId } = req.data as SendReminderInput

    const groupRef = db.doc(`groups/${groupId}`)
    const groupSnap = await groupRef.get()
    const group = groupSnap.data() as GroupDoc | undefined
    if (!groupSnap.exists || !group) throw new AppError('not_found')
    assertAdminAccess(req.auth, group)

    const n = group.currentCycleNumber
    if (!n || n < 1) {
      throw new AppError('invalid_transition', 'No month is open yet.')
    }

    const cycleRef = groupRef.collection('cycles').doc(String(n))
    const cycleSnap = await cycleRef.get()
    const cycle = cycleSnap.data() as CycleDoc | undefined
    if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
    if (cycle.status !== 'payment_open') {
      throw new AppError('invalid_transition', 'Reminders can only be sent for an open month.')
    }

    const boardSnap = await cycleRef.collection('board').doc('board').get()
    const board = boardSnap.data() as BoardDoc | undefined
    if (!board) throw new AppError('not_found')

    const today = new Date().toISOString().slice(0, 10)
    const overdue = today > cycle.dueDate
    const template = overdue ? 'overdue_reminder' : 'payment_reminder'

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
          contribution_amount: formatMinor(group.monthlyAmountMinor, group.currency),
          due_date: cycle.dueDate,
          group_id: groupId,
        }, language)
        providerMessageId = res.providerMessageId
        sent++
      } catch (e) {
        error = e instanceof Error ? e.message : String(e)
      }

      const log: MessageLogDoc = {
        groupId,
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

    return { sent, total: targets.length, overdue }
  } catch (err) {
    throw toHttpsError(err)
  }
})
