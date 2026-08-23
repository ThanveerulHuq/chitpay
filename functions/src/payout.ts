import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { AppError, assertGroupWritable, assertTransition } from '@chitapp/shared'
import type { CycleDoc, GroupDoc, PaymentDoc } from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { assertAdminAccess } from './auth.js'


interface RecordPayoutInput {
  groupId: string
  cycleNumber: number
  amountMinor?: number // defaults to the full pool
}

export const recordPayout = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, cycleNumber, amountMinor } = req.data as RecordPayoutInput

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group, tx)
      assertGroupWritable(group)

      const n = Math.floor(Number(cycleNumber))
      if (!n || n < 1) throw new AppError('invalid_transition')

      const cycleRef = groupRef.collection('cycles').doc(String(n))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (!cycle.recipientMembershipId) {
        throw new AppError(
          'invalid_transition',
          'Select a recipient before recording the payout.',
        )
      }
      if (cycle.status !== 'active') throw new AppError('invalid_transition')
      if (cycle.payout.status === 'paid') throw new AppError('already_exists')

      const poolAmountMinor = group.contributionAmountMinor * Math.max(cycle.expectedPaymentCount, 1)
      const payoutAmountMinor =
        amountMinor != null ? Math.floor(Number(amountMinor)) : poolAmountMinor
      if (!(payoutAmountMinor > 0)) {
        throw new AppError('invalid_argument', 'Invalid payout amount.')
      }

      tx.update(cycleRef, {
        payout: {
          amountMinor: payoutAmountMinor,
          status: 'paid',
          paidAt: FieldValue.serverTimestamp() as unknown as number,
          recordedBy: uid,
        },
      })

    })

    return { ok: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'recordPayout', uid: req.auth?.uid, data: req.data })
  }
})

interface CompleteCycleInput {
  groupId: string
  cycleNumber: number
}

export const completeCycle = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, cycleNumber } = req.data as CompleteCycleInput
    let completedGroup = false

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group, tx)
      assertGroupWritable(group)

      const n = Math.floor(Number(cycleNumber))
      if (!n || n < 1) throw new AppError('invalid_argument')
      const cycleRef = groupRef.collection('cycles').doc(String(n))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (cycle.status !== 'active') throw new AppError('invalid_transition')

      const paymentsSnap = await tx.get(cycleRef.collection('payments'))
      const paidCount = paymentsSnap.docs.filter(
        (payment) => (payment.data() as PaymentDoc).status === 'paid',
      ).length
      if (
        paymentsSnap.size !== cycle.expectedPaymentCount ||
        paidCount !== cycle.expectedPaymentCount
      ) {
        throw new AppError('invalid_transition', 'Record every payment before completing the cycle.')
      }
      if (!cycle.recipientMembershipId) {
        throw new AppError('invalid_transition', 'Select a recipient before completing the cycle.')
      }
      if (cycle.payout.status !== 'paid') {
        throw new AppError('invalid_transition', 'Record the payout before completing the cycle.')
      }
      assertTransition(cycle.status, 'complete')

      const nextCompletedCount = group.completedCycleCount + 1
      completedGroup = nextCompletedCount === group.cycleCount
      tx.update(cycleRef, {
        status: 'complete',
        completedAt: FieldValue.serverTimestamp(),
      })
      tx.update(groupRef, {
        activeCycleCount: FieldValue.increment(-1),
        completedCycleCount: FieldValue.increment(1),
        ...(completedGroup ? { status: 'completed' } : {}),
      })
    })

    return { ok: true, completedGroup }
  } catch (err) {
    throw toHttpsError(err, { fn: 'completeCycle', uid: req.auth?.uid, data: req.data })
  }
})
