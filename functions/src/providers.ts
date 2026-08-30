import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  assertProviderAdminRemovable,
  normalizePhone,
  rolesWithProviderAdmin,
  rolesWithoutProviderAdmin,
  type MessageLogDoc,
  type ProviderDoc,
  type UserDoc,
} from '@chitapp/shared'
import { auth, db } from './firebaseAdmin.js'
import { assertProviderAdmin, providerLanguage, sendLoginAccessLink, syntheticEmail } from './auth.js'
import { toHttpsError } from './httpsError.js'
import { writeUserMessage } from './messageLog.js'

interface AddProviderAdminInput {
  name: string
  phone: string
}

function normalizedName(value: unknown): string {
  const name = String(value ?? '').trim()
  if (!name) throw new AppError('invalid_argument', 'Name is required.')
  if (name.length > 100) throw new AppError('invalid_argument', 'Name is too long.')
  return name
}

function normalizedPhone(value: unknown): string {
  try {
    return normalizePhone(String(value ?? ''))
  } catch {
    throw new AppError('invalid_argument', 'Enter a valid Indian mobile number.')
  }
}

async function callerProvider(uid: string): Promise<string> {
  const snap = await db.doc(`users/${uid}`).get()
  const profile = snap.data() as UserDoc | undefined
  if (!profile?.providerId) throw new AppError('permission_denied')
  await assertProviderAdmin({ uid }, profile.providerId)
  return profile.providerId
}

export const getMyProvider = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const providerId = await callerProvider(uid)
    const [providerSnap, adminsSnap] = await Promise.all([
      db.doc(`providers/${providerId}`).get(),
      db.collection(`providers/${providerId}/admins`).get(),
    ])
    const provider = providerSnap.data() as ProviderDoc | undefined
    if (!providerSnap.exists || !provider) throw new AppError('not_found')
    const userSnaps = adminsSnap.empty
      ? []
      : await db.getAll(...adminsSnap.docs.map((admin) => db.doc(`users/${admin.id}`)))
    const admins = userSnaps.map((snap) => {
      const profile = snap.data() as UserDoc | undefined
      return { uid: snap.id, name: profile?.name ?? '', phone: profile?.phone ?? '', isCurrentUser: snap.id === uid }
    }).sort((a, b) => a.name.localeCompare(b.name))
    return { providerId, provider, admins }
  } catch (error) {
    throw toHttpsError(error, { fn: 'getMyProvider', uid: req.auth?.uid })
  }
})

export const updateProviderName = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const providerId = await callerProvider(uid)
    const name = normalizedName(req.data?.name)
    await db.runTransaction(async (transaction) => {
      await assertProviderAdmin({ uid }, providerId, transaction)
      const providerRef = db.doc(`providers/${providerId}`)
      transaction.update(providerRef, { name, updatedAt: FieldValue.serverTimestamp() })
    })
    return { ok: true }
  } catch (error) {
    throw toHttpsError(error, { fn: 'updateProviderName', uid: req.auth?.uid, data: req.data })
  }
})

export const addProviderAdmin = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  let createdAuthUid: string | null = null
  try {
    const actorUid = req.auth?.uid
    if (!actorUid) throw new AppError('unauthenticated')
    const providerId = await callerProvider(actorUid)
    const input = req.data as AddProviderAdminInput
    const name = normalizedName(input?.name)
    const phone = normalizedPhone(input?.phone)
    const email = syntheticEmail(phone)

    let authUser
    try {
      authUser = await auth.getUserByEmail(email)
    } catch (error) {
      if ((error as { code?: string })?.code !== 'auth/user-not-found') throw error
      authUser = await auth.createUser({ email, emailVerified: true, displayName: name })
      createdAuthUid = authUser.uid
    }
    const targetUid = authUser.uid

    await db.runTransaction(async (transaction) => {
      await assertProviderAdmin({ uid: actorUid }, providerId, transaction)
      const targetRef = db.doc(`users/${targetUid}`)
      const membershipRef = db.doc(`providers/${providerId}/admins/${targetUid}`)
      const [targetSnap, membershipSnap] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(membershipRef),
      ])
      if (membershipSnap.exists) throw new AppError('already_exists', 'This person is already an admin.')
      const current = targetSnap.data() as UserDoc | undefined
      if (current?.providerId && current.providerId !== providerId) {
        throw new AppError('already_exists', 'This admin already belongs to another provider.')
      }
      const roles = rolesWithProviderAdmin(current?.roles ?? [])
      transaction.set(targetRef, {
        name: current?.name?.trim() || name,
        phone,
        roles,
        providerId,
        ...(targetSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true })
      transaction.set(membershipRef, {
        uid: targetUid,
        addedBy: actorUid,
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    let notificationSent = false
    let providerMessageId: string | null = null
    let notificationError: string | null = null
    try {
      const targetSnap = await db.doc(`users/${targetUid}`).get()
      const target = targetSnap.data() as UserDoc | undefined
      const response = await sendLoginAccessLink(
        phone,
        target?.name?.trim() || name,
        await providerLanguage(providerId) ?? 'en',
      )
      providerMessageId = response.providerMessageId
      notificationSent = true
    } catch (error) {
      notificationError = error instanceof Error ? error.message : String(error)
      console.error('provider admin login-link notification failed:', error)
    }
    const message: MessageLogDoc = {
      recipientUid: targetUid,
      groupId: null,
      template: 'login_access',
      toPhone: phone,
      membershipId: null,
      providerMessageId,
      status: notificationSent ? 'sent' : 'failed',
      error: notificationError,
      sentBy: actorUid,
      createdAt: FieldValue.serverTimestamp() as unknown as number,
      updatedAt: FieldValue.serverTimestamp() as unknown as number,
    }
    try {
      await writeUserMessage(message)
    } catch (error) {
      console.error('provider admin login-link message log failed:', error)
    }
    return { uid: targetUid, notificationSent }
  } catch (error) {
    if (createdAuthUid) {
      try {
        await auth.deleteUser(createdAuthUid)
      } catch (cleanupError) {
        console.error('provider admin auth cleanup failed:', cleanupError)
      }
    }
    throw toHttpsError(error, { fn: 'addProviderAdmin', uid: req.auth?.uid, data: req.data })
  }
})

export const removeProviderAdmin = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const actorUid = req.auth?.uid
    if (!actorUid) throw new AppError('unauthenticated')
    const providerId = await callerProvider(actorUid)
    const targetUid = String(req.data?.uid ?? '').trim()
    if (!targetUid) throw new AppError('invalid_argument')

    await db.runTransaction(async (transaction) => {
      await assertProviderAdmin({ uid: actorUid }, providerId, transaction)
      const adminsQuery = db.collection(`providers/${providerId}/admins`).limit(2)
      const targetMembershipRef = db.doc(`providers/${providerId}/admins/${targetUid}`)
      const targetUserRef = db.doc(`users/${targetUid}`)
      const [adminsSnap, membershipSnap, userSnap] = await Promise.all([
        transaction.get(adminsQuery),
        transaction.get(targetMembershipRef),
        transaction.get(targetUserRef),
      ])
      if (!membershipSnap.exists || !userSnap.exists) throw new AppError('not_found')
      assertProviderAdminRemovable(adminsSnap.size)
      const user = userSnap.data() as UserDoc
      transaction.delete(targetMembershipRef)
      transaction.update(targetUserRef, {
        providerId: FieldValue.delete(),
        roles: rolesWithoutProviderAdmin(user.roles),
      })
    })
    return { ok: true, removedSelf: targetUid === actorUid }
  } catch (error) {
    throw toHttpsError(error, { fn: 'removeProviderAdmin', uid: req.auth?.uid, data: req.data })
  }
})
