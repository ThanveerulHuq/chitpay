import { onCall } from 'firebase-functions/v2/https'
import { AppError, type Lang } from '@chitapp/shared'
import { db } from './firebaseAdmin.js'
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

    await db.doc(`users/${uid}`).set({ language }, { merge: true })
    return { ok: true }
  } catch (error) {
    throw toHttpsError(error, { fn: 'updateOwnLanguage', uid: req.auth?.uid, data: req.data })
  }
})
