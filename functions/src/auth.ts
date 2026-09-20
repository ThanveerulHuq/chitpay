import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue, type Transaction } from 'firebase-admin/firestore'
import {
  AppError,
  type Lang,
  type MessageLogDoc,
  OTP_TTL_MS,
  normalizePhone,
} from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { messaging } from './messaging.js'
import { writeUserMessage } from './messageLog.js'
import { assertOtpSendable, generateOtpCode, hashOtpCode, verifyOtpDoc } from './otp.js'


import type { GroupDoc, ProviderDoc, UserDoc } from '@chitapp/shared'

const LOGIN_LINK_SEND_COOLDOWN_MS = 60 * 1000

/** Synthetic email used as the Firebase Auth identifier for phone-based users. */
export function syntheticEmail(phone: string): string {
  return `${phone}@phone.chitapp.app`
}

/** Generates and sends the passwordless WhatsApp access link used by members. */
export async function sendLoginAccessLink(
  phone: string,
  name: string,
  language: Lang = 'en',
): Promise<{ providerMessageId: string | null }> {
  const firebaseLink = await auth.generateSignInWithEmailLink(syntheticEmail(phone), {
    url: 'https://chitpay.web.app/login/link',
    handleCodeInApp: true,
  })
  const loginLinkId = Buffer.from(firebaseLink, 'utf8').toString('base64url')
  return messaging.sendTemplate(phone, 'login_access', { name, id: loginLinkId }, language)
}

/** Issues and sends a WhatsApp OTP for an existing or newly-created account. */
export async function sendLoginOtp(
  phone: string,
  language: Lang = 'en',
): Promise<{ providerMessageId: string | null }> {
  const now = Date.now()
  const code = generateOtpCode()
  const ref = db.doc(`otps/${phone}`)
  await ref.set({
    codeHash: hashOtpCode(code, phone),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  })

  try {
    const response = await messaging.sendTemplate(phone, 'login_code', { OTP_NUMBER: code }, language)
    await ref.set({
      message: {
        providerMessageId: response.providerMessageId,
        status: 'sent',
        error: null,
        sentAt: now,
      },
    }, { merge: true })
    return response
  } catch (error) {
    await ref.set({
      message: {
        providerMessageId: null,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        sentAt: now,
      },
    }, { merge: true })
    throw error
  }
}

async function adminProfile(
  requestAuth: { uid: string } | undefined,
  transaction?: Transaction,
): Promise<UserDoc> {
  if (!requestAuth) throw new AppError('unauthenticated')
  const profileRef = db.doc(`users/${requestAuth.uid}`)
  const profileSnap = transaction
    ? await transaction.get(profileRef)
    : await profileRef.get()
  const profile = profileSnap.data() as UserDoc | undefined
  const isAdminRole = profileSnap.exists
    && Array.isArray(profile?.roles)
    && profile.roles.includes('admin')
  if (!isAdminRole || !profile) throw new AppError('permission_denied')
  return profile
}

export async function assertProviderAdmin(
  requestAuth: { uid: string } | undefined,
  providerId: string,
  transaction?: Transaction,
): Promise<UserDoc> {
  const profile = await adminProfile(requestAuth, transaction)
  if (!requestAuth || profile.providerId !== providerId) throw new AppError('permission_denied')
  const membershipRef = db.doc(`providers/${providerId}/admins/${requestAuth.uid}`)
  const providerRef = db.doc(`providers/${providerId}`)
  const [membershipSnap, providerSnap] = transaction
    ? await Promise.all([transaction.get(membershipRef), transaction.get(providerRef)])
    : await Promise.all([membershipRef.get(), providerRef.get()])
  const provider = providerSnap.data() as ProviderDoc | undefined
  if (!membershipSnap.exists || !providerSnap.exists || provider?.status !== 'active') {
    throw new AppError('permission_denied')
  }
  return profile
}

/**
 * Provider-aware authorization with a temporary legacy owner fallback.
 * Remove the adminUid branch after the production migration is verified.
 */
export async function assertAdminAccess(
  requestAuth: { uid: string } | undefined,
  group?: GroupDoc,
  transaction?: Transaction,
): Promise<UserDoc> {
  if (group?.providerId) return assertProviderAdmin(requestAuth, group.providerId, transaction)
  const profile = await adminProfile(requestAuth, transaction)
  if (!group && profile.providerId) return assertProviderAdmin(requestAuth, profile.providerId, transaction)
  if (group && (!group.adminUid || group.adminUid !== requestAuth?.uid)) throw new AppError('permission_denied')
  return profile
}

export async function providerLanguage(providerId: string): Promise<Lang | undefined> {
  const provider = (await db.doc(`providers/${providerId}`).get()).data() as ProviderDoc | undefined
  return provider?.language
}

export async function groupAdminLanguage(group: GroupDoc, actingUid: string): Promise<Lang | undefined> {
  if (group.providerId) return providerLanguage(group.providerId)
  const profile = (await db.doc(`users/${actingUid}`).get()).data() as UserDoc | undefined
  return profile?.language
}

/** Finds or creates the auth user + users/{uid} doc for a phone. */
async function ensureUser(phone: string): Promise<{ uid: string; isNew: boolean }> {
  const email = syntheticEmail(phone)
  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    user = await auth.createUser({ email, emailVerified: true, displayName: phone })
  }
  const ref = db.doc(`users/${user.uid}`)
  const snap = await ref.get()
  if (!snap.exists) {
    await ref.set({ name: '', phone, roles: ['member'], createdAt: FieldValue.serverTimestamp() })
    return { uid: user.uid, isNew: true }
  }
  return { uid: user.uid, isNew: false }
}

export const requestOtp = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    if (!req.auth && !req.data?.phone) throw new AppError('unauthenticated')
    const phone = normalizePhone(String(req.data?.phone ?? ''))
    const language: Lang = req.data?.language === 'ta' ? 'ta' : 'en'
    const now = Date.now()

    const ref = db.doc(`otps/${phone}`)
    await ref.get().then((snap) => assertOtpSendable(snap, now))

    await sendLoginOtp(phone, language)
    return { sent: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'requestOtp', uid: req.auth?.uid, data: req.data })
  }
})

export const requestLoginLink = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const phone = normalizePhone(String(req.data?.phone ?? ''))
    const language: Lang = req.data?.language === 'ta' ? 'ta' : 'en'
    const now = Date.now()
    const { uid } = await ensureUser(phone)
    const userRef = db.doc(`users/${uid}`)
    const userSnap = await userRef.get()
    const profile = userSnap.data() as { name?: unknown } | undefined
    const fallbackName = language === 'ta' ? 'உறுப்பினரே' : 'there'
    const name = typeof profile?.name === 'string' && profile.name.trim()
      ? profile.name.trim()
      : fallbackName

    const sendRef = db.doc(`loginLinkRequests/${phone}`)
    await db.runTransaction(async (transaction) => {
      const sendSnap = await transaction.get(sendRef)
      const lastSentAt = Number(sendSnap.data()?.lastSentAt ?? 0)
      if (lastSentAt && now - lastSentAt < LOGIN_LINK_SEND_COOLDOWN_MS) {
        throw new AppError('rate_limited')
      }
      transaction.set(sendRef, { lastSentAt: now })
    })

    let providerMessageId: string | null = null
    let sendError: string | null = null
    try {
      const response = await sendLoginAccessLink(phone, name, language)
      providerMessageId = response.providerMessageId
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error)
    }
    const log: MessageLogDoc = {
      recipientUid: uid,
      groupId: null,
      template: 'login_access',
      toPhone: phone,
      membershipId: null,
      providerMessageId,
      status: sendError ? 'failed' : 'sent',
      error: sendError,
      sentBy: null,
      createdAt: FieldValue.serverTimestamp() as unknown as number,
      updatedAt: FieldValue.serverTimestamp() as unknown as number,
    }
    try {
      await writeUserMessage(log)
    } catch (error) {
      console.error('login access message log failed:', error)
    }
    if (sendError) throw new Error(sendError)
    return { sent: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'requestLoginLink', uid: req.auth?.uid, data: req.data })
  }
})

export const verifyOtp = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const phone = normalizePhone(String(req.data?.phone ?? ''))
    const code = String(req.data?.code ?? '').trim()
    if (!/^\d{6}$/.test(code)) throw new AppError('invalid_argument')
    const now = Date.now()

    const ref = db.doc(`otps/${phone}`)
    const snap = await ref.get()

    let ok = false
    try {
      ok = verifyOtpDoc(snap, code, phone, now)
    } catch (err) {
      // consume an attempt even when locked-out check fired? no — locked stays locked
      throw err
    }

    if (!ok) {
      if (!snap.exists) {
        throw new AppError('invalid_argument', 'No active code. Request a new one.')
      }
      const data = snap.data()
      await ref.update({
        attempts: FieldValue.increment(1),
        // wipe hash once locked so remaining attempts cannot be probed further
        ...(data && data.attempts + 1 >= 5 ? { codeHash: '' } : {}),
      })
      throw new AppError('invalid_argument', 'Incorrect or expired code.')
    }

    const { uid } = await ensureUser(phone)
    const otpData = snap.data() as {
      message?: { providerMessageId?: string | null; status?: 'sent' | 'failed'; error?: string | null; sentAt?: number }
    } | undefined
    if (otpData?.message) {
      const log: MessageLogDoc = {
        recipientUid: uid,
        groupId: null,
        template: 'login_code',
        toPhone: phone,
        membershipId: null,
        providerMessageId: otpData.message.providerMessageId ?? null,
        status: otpData.message.status ?? 'sent',
        error: otpData.message.error ?? null,
        sentBy: null,
        createdAt: otpData.message.sentAt ?? now,
        updatedAt: now,
      }
      try {
        await writeUserMessage(log)
      } catch (error) {
        console.error('OTP message log failed:', error)
      }
    }
    await Promise.all([
      ref.delete(),
      db.doc(`users/${uid}`).set({ lastLoginAt: FieldValue.serverTimestamp() }, { merge: true }),
    ])
    const token = await auth.createCustomToken(uid)
    return { token }
  } catch (err) {
    throw toHttpsError(err, { fn: 'verifyOtp', uid: req.auth?.uid, data: req.data })
  }
})

export const recordLogin = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const userRef = db.doc(`users/${uid}`)
    const userSnap = await userRef.get()
    if (!userSnap.exists) throw new AppError('not_found')
    await userRef.set({ lastLoginAt: FieldValue.serverTimestamp() }, { merge: true })
    return { ok: true }
  } catch (error) {
    throw toHttpsError(error, { fn: 'recordLogin', uid: req.auth?.uid })
  }
})
