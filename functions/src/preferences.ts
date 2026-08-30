import { onCall } from 'firebase-functions/v2/https'
import { AppError, type Lang, type UserDoc } from '@chitapp/shared'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from './firebaseAdmin.js'
import { assertProviderAdmin } from './auth.js'
import { toHttpsError } from './httpsError.js'

interface UpdateOwnLanguageInput {
  language: Lang
}

export const updateOwnLanguage = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    const language = (req.data as UpdateOwnLanguageInput | undefined)?.language
    if (language !== 'en' && language !== 'ta') {
      throw new AppError('invalid_argument', 'Choose English or Tamil.')
    }

    const userRef = db.doc(`users/${uid}`)
    const userSnap = await userRef.get()
    const profile = userSnap.data() as UserDoc | undefined
    if (!userSnap.exists || !profile) throw new AppError('not_found')

    if (profile.providerId && profile.roles.includes('admin')) {
      await assertProviderAdmin(req.auth, profile.providerId)
      await db.doc(`providers/${profile.providerId}`).update({
        language,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      await userRef.set({ language }, { merge: true })
    }
    return { ok: true }
  } catch (error) {
    throw toHttpsError(error, { fn: 'updateOwnLanguage', uid: req.auth?.uid, data: req.data })
  }
})
