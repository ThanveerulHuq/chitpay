import { onCall } from 'firebase-functions/v2/https'
import { AppError, assertGroupWritable, summarizePayments, type GroupDoc, type PaymentDoc } from '@chitapp/shared'
import { db } from './firebaseAdmin.js'
import { assertAdminAccess } from './auth.js'
import { toHttpsError } from './httpsError.js'

interface BackfillInput {
  groupId: string
  dryRun?: boolean
}

/** Recomputes denormalized contribution/cycle counters from source payments. */
export const backfillFinancialSummaries = onCall(
  { region: 'asia-south1', invoker: 'public' },
  async (req) => {
    try {
      const uid = req.auth?.uid
      if (!uid) throw new AppError('unauthenticated')
      const input = req.data as BackfillInput
      const groupRef = db.doc(`groups/${input.groupId}`)
      const groupSnap = await groupRef.get()
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      await assertAdminAccess(req.auth, group)
      assertGroupWritable(group)

      const [membersSnap, cyclesSnap] = await Promise.all([
        groupRef.collection('members').get(),
        groupRef.collection('cycles').get(),
      ])
      const memberTotals = new Map<string, { totalContributedMinor: number; paidCycleCount: number }>()
      for (const member of membersSnap.docs) {
        memberTotals.set(member.id, { totalContributedMinor: 0, paidCycleCount: 0 })
      }
      const cycleTotals = new Map<string, { paidCount: number; collectedAmountMinor: number }>()

      for (const cycleDoc of cyclesSnap.docs) {
        const payments = await cycleDoc.ref.collection('payments').get()
        const paymentDocs = payments.docs.map((paymentDoc) => paymentDoc.data() as PaymentDoc)
        const total = summarizePayments(paymentDocs)
        for (const paymentDoc of payments.docs) {
          const payment = paymentDoc.data() as PaymentDoc
          if (payment.status !== 'paid') continue
          const memberTotal = memberTotals.get(paymentDoc.id)
          if (memberTotal) {
            memberTotal.totalContributedMinor += payment.amountMinor
            memberTotal.paidCycleCount += 1
          }
        }
        cycleTotals.set(cycleDoc.id, total)
      }

      if (!input.dryRun) {
        let batch = db.batch()
        let writes = 0
        const commit = async () => {
          if (writes > 0) await batch.commit()
          batch = db.batch()
          writes = 0
        }
        for (const member of membersSnap.docs) {
          batch.update(member.ref, memberTotals.get(member.id) ?? {
            totalContributedMinor: 0,
            paidCycleCount: 0,
          })
          writes += 1
          if (writes === 450) await commit()
        }
        for (const cycle of cyclesSnap.docs) {
          batch.update(cycle.ref, cycleTotals.get(cycle.id) ?? {
            paidCount: 0,
            collectedAmountMinor: 0,
          })
          writes += 1
          if (writes === 450) await commit()
        }
        await commit()
      }

      return {
        ok: true,
        dryRun: Boolean(input.dryRun),
        members: memberTotals.size,
        cycles: cycleTotals.size,
      }
    } catch (err) {
      throw toHttpsError(err, {
        fn: 'backfillFinancialSummaries',
        uid: req.auth?.uid,
        data: req.data,
      })
    }
  },
)
