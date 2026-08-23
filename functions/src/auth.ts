import { db, auth } from './firebaseAdmin.js'
import { onCall } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'
import {
  AppError,
  type Lang,
  OTP_TTL_MS,
  normalizePhone,
} from '@chitapp/shared'
import { toHttpsError } from './httpsError.js'
import { messaging } from './messaging.js'
import { assertOtpSendable, generateOtpCode, hashOtpCode, verifyOtpDoc } from './otp.js'


import type { GroupDoc } from '@chitapp/shared'

const LOGIN_LINK_SEND_COOLDOWN_MS = 60 * 1000

/** Synthetic email used as the Firebase Auth identifier for phone-based users. */
export function syntheticEmail(phone: string): string {
  return `${phone}@phone.chitapp.app`
}

export function assertAdminAccess(auth: any, group: GroupDoc | { adminUid: string }) {
  if (!auth) throw new AppError('unauthenticated')
  const isAdminRole = Array.isArray(auth.token?.roles) && auth.token.roles.includes('admin')
  if (group.adminUid !== auth.uid || !isAdminRole) {
    throw new AppError('permission_denied')
  }
}

/** Admin phones (comma-separated env var) get the admin role at first login. */
function rolesForPhone(phone: string): string[] {
  const adminPhones = (process.env.ADMIN_PHONES ?? '')
    .split(',')
    .map((p) => p.replace(/[^0-9]/g, ''))
  return adminPhones.includes(phone) ? ['admin', 'member'] : ['member']
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
    const roles = rolesForPhone(phone)
    await auth.setCustomUserClaims(user.uid, { roles })
    await ref.set({ name: '', phone, roles, createdAt: FieldValue.serverTimestamp() })
    return { uid: user.uid, isNew: true }
  }
  // Keep claims/roles in sync (e.g. ADMIN_PHONES updated after first login).
  const desired = rolesForPhone(phone)
  const current = (user.customClaims as { roles?: string[] } | undefined)?.roles
  if (JSON.stringify(current) !== JSON.stringify(desired)) {
    await auth.setCustomUserClaims(user.uid, { roles: desired })
    await ref.set({ roles: desired }, { merge: true })
  }
  return { uid: user.uid, isNew: false }
}

export const requestOtp = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    if (!req.auth && !req.data?.phone) throw new AppError('unauthenticated')
    const phone = normalizePhone(String(req.data?.phone ?? ''))
    const now = Date.now()

    const ref = db.doc(`otps/${phone}`)
    await ref.get().then((snap) => assertOtpSendable(snap, now))

    const code = generateOtpCode()
    const salt = phone
    await ref.set({
      codeHash: hashOtpCode(code, salt),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
    })

    await messaging.sendTemplate(phone, 'login_code', { OTP_NUMBER: code }, 'en')
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

    const firebaseLink = await auth.generateSignInWithEmailLink(syntheticEmail(phone), {
      url: 'https://chitpay.web.app/login/link',
      handleCodeInApp: true,
    })
    const loginLinkId = Buffer.from(firebaseLink, 'utf8').toString('base64url')
    await messaging.sendTemplate(
      phone,
      'login_access',
      { name, id: loginLinkId },
      language,
    )
    return { sent: true }
  } catch (err) {
    throw toHttpsError(err, { fn: 'requestLoginLink', uid: req.auth?.uid, data: req.data })
  }
})

/**
 * Re-syncs the caller's role claims from ADMIN_PHONES. Called by the client
 * after any successful login so password logins pick up admin role too.
 */
export const syncClaims = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    if (!req.auth) throw new AppError('unauthenticated')
    const user = await auth.getUser(req.auth.uid)
    const email = user.email ?? ''
    if (!email.endsWith('@phone.chitapp.app')) throw new AppError('permission_denied')
    const phone = email.slice(0, -'@phone.chitapp.app'.length)
    const desired = rolesForPhone(phone)
    await auth.setCustomUserClaims(req.auth.uid, { roles: desired })
    // also keep the Firestore profile in sync
    await db.doc(`users/${req.auth.uid}`).set(
      { phone, roles: desired },
      { merge: true },
    )
    return { roles: desired }
  } catch (err) {
    throw toHttpsError(err, { fn: 'syncClaims', uid: req.auth?.uid })
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

    await ref.delete()
    const { uid } = await ensureUser(phone)
    const token = await auth.createCustomToken(uid)
    return { token }
  } catch (err) {
    throw toHttpsError(err, { fn: 'verifyOtp', uid: req.auth?.uid, data: req.data })
  }
})
