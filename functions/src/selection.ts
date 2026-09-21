import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  assertGroupWritable,
  contributionInPaise,
  formatMinor,
  resolveMessageLanguage,
  validateSelectionParticipants,
} from '@chitapp/shared'
import type {
  CycleDoc,
  GroupDoc,
  GroupMemberDoc,
  MessageLogDoc,
  SelectionAuditDoc,
  UserDoc,
} from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { assertAdminAccess, groupAdminLanguage } from './auth.js'
import { messaging } from './messaging.js'
import { writeUserMessage } from './messageLog.js'


interface ConfirmSelectionInput {
  groupId: string
  cycleNumber: number
  membershipId: string
  willingMembershipIds: string[]
}

export const confirmSelection = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const { groupId, cycleNumber, membershipId, willingMembershipIds } = req.data as ConfirmSelectionInput
    if (
      !Array.isArray(willingMembershipIds)
      || willingMembershipIds.some((id) => typeof id !== 'string' || !id)
    ) {
      throw new AppError('invalid_argument')
    }

    let poolAmountMinor = 0
    let notifiedName = ''
    let notifiedUid = ''
    let groupName = ''

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

      // Eligibility snapshot for the immutable audit record.
      const membersSnap = await tx.get(
        groupRef.collection('members').where('status', '==', 'active'),
      )
      const eligibleMembershipIds: string[] = []
      for (const m of membersSnap.docs) {
        const candidate = m.data() as GroupMemberDoc
        if (candidate.selectedInCycle != null) continue
        eligibleMembershipIds.push(m.id)
      }
      const participantError = validateSelectionParticipants(
        membershipId,
        willingMembershipIds,
        eligibleMembershipIds,
      )
      if (participantError === 'ineligible_participant') {
        throw new AppError('not_eligible')
      }
      if (participantError) {
        throw new AppError('invalid_argument')
      }

      poolAmountMinor = contributionInPaise(group) * Math.max(cycle.expectedPaymentCount, 1)

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
        eligibleMembershipIds: willingMembershipIds,
        eligibleCount: willingMembershipIds.length,
        performedBy: uid,
        poolAmountMinor,
        selectedAt: now,
      }
      tx.create(groupRef.collection('selections').doc(), audit)

      notifiedName = member.displayName
      notifiedUid = member.uid
      groupName = group.name
    })

    // Best-effort recipient notification after the transaction commits.
    try {
      const userSnap = await db.doc(`users/${notifiedUid}`).get()
      const user = userSnap.data() as UserDoc | undefined
      if (user?.phone) {
        let error: string | null = null
        let providerMessageId: string | null = null
        try {
          const group = (await db.doc(`groups/${groupId}`).get()).data() as GroupDoc | undefined
          const language = resolveMessageLanguage(
            user.language,
            group ? await groupAdminLanguage(group) : undefined,
          )
          const res = await messaging.sendTemplate(user.phone, 'recipient_notification', {
            member_name: notifiedName,
            group_name: groupName,
            payout_amount: formatMinor(poolAmountMinor),
            group_id: groupId,
          }, language)
          providerMessageId = res.providerMessageId
        } catch (e) {
          error = e instanceof Error ? e.message : String(e)
        }
        const log: MessageLogDoc = {
          recipientUid: notifiedUid,
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
        await writeUserMessage(log)
      }
    } catch (e) {
      console.error('recipient notification failed:', e)
    }

    return { ok: true, poolAmountMinor }
  } catch (err) {
    throw toHttpsError(err, { fn: 'confirmSelection', uid: req.auth?.uid, data: req.data })
  }
})
