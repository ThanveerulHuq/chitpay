import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { AppError, assertTransition } from '@chitapp/shared'
import type { CycleDoc, GroupDoc } from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'


interface RecordPayoutInput {
  groupId: string
  amountMinor?: number // defaults to the full pool
}

export const recordPayout = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, amountMinor } = req.data as RecordPayoutInput

    let completedGroup = false

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      if (group.adminUid !== uid) throw new AppError('permission_denied')

      const n = group.currentCycleNumber
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
      // Enforce each step of the machine even though we chain them.
      assertTransition(cycle.status, 'payout_recorded')
      assertTransition('payout_recorded', 'complete')

      const poolAmountMinor = group.monthlyAmountMinor * Math.max(group.memberCount, 1)
      const payoutAmountMinor =
        amountMinor != null ? Math.floor(Number(amountMinor)) : poolAmountMinor
      if (!(payoutAmountMinor > 0)) {
        throw new AppError('invalid_argument', 'Invalid payout amount.')
      }

      tx.update(cycleRef, {
        status: 'complete',
        payout: {
          amountMinor: payoutAmountMinor,
          status: 'paid',
          paidAt: FieldValue.serverTimestamp() as unknown as number,
          recordedBy: uid,
        },
      })

      // Final month closes the whole group.
      if (n >= group.durationMonths) {
        completedGroup = true
        tx.update(groupRef, { status: 'completed' })
      }
    })

    return { ok: true, completedGroup }
  } catch (err) {
    throw toHttpsError(err)
  }
})
