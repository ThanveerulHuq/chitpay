import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import { AppError, assertGroupWritable, formatMinor } from '@chitapp/shared'
import type {
  CycleDoc,
  GroupDoc,
  GroupMemberDoc,
  MessageLogDoc,
  PaymentDoc,
  SelectionAuditDoc,
  UserDoc,
} from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { assertAdminAccess } from './auth.js'
import { messaging } from './messaging.js'


interface ConfirmSelectionInput {
  groupId: string
  cycleNumber: number
  membershipId: string
}

export const confirmSelection = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, cycleNumber, membershipId } = req.data as ConfirmSelectionInput

    let poolAmountMinor = 0
    let notifiedName = ''
    let notifiedUid = ''
    let groupName = ''
    let currency = 'INR'

    await db.runTransaction(async (tx) => {
      const groupRef = db.doc(`groups/${groupId}`)
      const groupSnap = await tx.get(groupRef)
      const group = groupSnap.data() as GroupDoc | undefined
      if (!groupSnap.exists || !group) throw new AppError('not_found')
      assertAdminAccess(req.auth, group)
      assertGroupWritable(group)

      const n = Math.floor(Number(cycleNumber))
      if (!n || n < 1) throw new AppError('invalid_transition')

      const cycleRef = groupRef.collection('cycles').doc(String(n))
      const cycleSnap = await tx.get(cycleRef)
      const cycle = cycleSnap.data() as CycleDoc | undefined
      if (!cycleSnap.exists || !cycle) throw new AppError('not_found')
      if (cycle.recipientMembershipId) {
        // Deterministic loser of a double-confirm race.
        throw new AppError('already_selected')
      }
      if (cycle.status !== 'active') {
        throw new AppError('invalid_transition')
      }

      const memberRef = groupRef.collection('members').doc(membershipId)
      const memberSnap = await tx.get(memberRef)
      const member = memberSnap.data() as GroupMemberDoc | undefined
      if (!memberSnap.exists || !member) throw new AppError('not_found')
      if (member.status !== 'active') throw new AppError('not_eligible')
      if (member.selectedInCycle != null) throw new AppError('not_eligible')

      if (group.requirePaidToWin) {
        const paymentSnap = await tx.get(
          cycleRef.collection('payments').doc(membershipId),
        )
        const payment = paymentSnap.data() as PaymentDoc | undefined
        if (!payment || payment.status !== 'paid') throw new AppError('not_eligible')
      }

      // Eligibility snapshot for the immutable audit record.
      const membersSnap = await tx.get(
        groupRef.collection('members').where('status', '==', 'active'),
      )
      const eligibleMembershipIds: string[] = []
      for (const m of membersSnap.docs) {
        const candidate = m.data() as GroupMemberDoc
        if (candidate.selectedInCycle != null) continue
        if (group.requirePaidToWin) {
          const p = await tx.get(cycleRef.collection('payments').doc(m.id))
          if ((p.data() as PaymentDoc | undefined)?.status !== 'paid') continue
        }
        eligibleMembershipIds.push(m.id)
      }
      if (!eligibleMembershipIds.includes(membershipId)) {
        throw new AppError('not_eligible')
      }

      poolAmountMinor = group.contributionAmountMinor * Math.max(cycle.expectedPaymentCount, 1)

      const now = FieldValue.serverTimestamp() as unknown as number

      tx.update(cycleRef, {
        recipientMembershipId: membershipId,
      })

      tx.update(memberRef, { selectedInCycle: n })

      tx.set(
        db.doc(`users/${member.uid}/memberships/${membershipId}`),
        { selectedInCycle: n },
        { merge: true },
      )

      const audit: SelectionAuditDoc = {
        groupId,
        cycleNumber: n,
        selectedMembershipId: membershipId,
        selectedMemberName: member.displayName,
        eligibleMembershipIds,
        eligibleCount: eligibleMembershipIds.length,
        performedBy: uid,
        poolAmountMinor,
        selectedAt: now,
      }
      tx.create(db.collection('selections').doc(), audit)

      notifiedName = member.displayName
      notifiedUid = member.uid
      groupName = group.name
      currency = group.currency
    })

    // Best-effort recipient notification after the transaction commits.
    try {
      const userSnap = await db.doc(`users/${notifiedUid}`).get()
      const user = userSnap.data() as UserDoc | undefined
      if (user?.phone) {
        let error: string | null = null
        let providerMessageId: string | null = null
        try {
          const language = user.language ?? 'en'
          const res = await messaging.sendTemplate(user.phone, 'recipient_notification', {
            member_name: notifiedName,
            group_name: groupName,
            payout_amount: formatMinor(poolAmountMinor, currency),
            group_id: groupId,
          }, language)
          providerMessageId = res.providerMessageId
        } catch (e) {
          error = e instanceof Error ? e.message : String(e)
        }
        const log: MessageLogDoc = {
          groupId,
          cycleNumber,
          template: 'recipient_notification',
          toPhone: user.phone,
          membershipId,
          providerMessageId,
          status: error ? 'failed' : 'sent',
          error,
          sentBy: uid,
          createdAt: FieldValue.serverTimestamp() as unknown as number,
          updatedAt: FieldValue.serverTimestamp() as unknown as number,
        }
        await db.doc(`groups/${groupId}`).collection('messages').add(log)
      }
    } catch (e) {
      console.error('recipient notification failed:', e)
    }

    return { ok: true, poolAmountMinor }
  } catch (err) {
    throw toHttpsError(err, { fn: 'confirmSelection', uid: req.auth?.uid, data: req.data })
  }
})
