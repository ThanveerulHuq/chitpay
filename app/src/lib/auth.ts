import {
  isSignInWithEmailLink,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithEmailLink,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { normalizePhone } from '@shared'
import { auth, functions } from './firebase'
import { resetSessionViewMode } from './viewMode'

const LOGIN_EMAIL_STORAGE_KEY = 'chitapp_login_email'

/** Synthetic email used as the Firebase Auth identifier for phone-based users. */
export function syntheticEmail(phone: string): string {
  return `${normalizePhone(phone)}@phone.chitapp.app`
}

export async function requestOtp(phone: string): Promise<void> {
  const call = httpsCallable(functions, 'requestOtp')
  await call({ phone: normalizePhone(phone) })
}

export async function requestLoginLink(phone: string, language: 'en' | 'ta'): Promise<void> {
  const call = httpsCallable(functions, 'requestLoginLink')
  await call({ phone: normalizePhone(phone), language })
  try {
    localStorage.setItem(LOGIN_EMAIL_STORAGE_KEY, syntheticEmail(phone))
  } catch {
    // The completion screen asks for the phone again when storage is unavailable.
  }
}

export function hasStoredLoginEmail(): boolean {
  try {
    return Boolean(localStorage.getItem(LOGIN_EMAIL_STORAGE_KEY))
  } catch {
    return false
  }
}

export async function verifyLoginLink(payload: string, phone?: string): Promise<void> {
  const firebaseLink = decodeFirebaseLink(payload)
  if (!isSignInWithEmailLink(auth, firebaseLink)) throw new Error('invalid_login_link')
  let email = phone ? syntheticEmail(phone) : null
  if (!email) {
    try {
      email = localStorage.getItem(LOGIN_EMAIL_STORAGE_KEY)
    } catch {
      // handled below
    }
  }
  if (!email) throw new Error('login_phone_required')
  resetSessionViewMode()
  await signInWithEmailLink(auth, email, firebaseLink)
  try {
    localStorage.removeItem(LOGIN_EMAIL_STORAGE_KEY)
  } catch {
    // non-fatal
  }
  await syncRoles()
}

function decodeFirebaseLink(payload: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error('invalid_login_link')
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const call = httpsCallable<{ phone: string; code: string }, { token: string }>(
    functions,
    'verifyOtp',
  )
  const res = await call({ phone: normalizePhone(phone), code })
  resetSessionViewMode()
  await signInWithCustomToken(auth, res.data.token)
  await syncRoles()
}

async function syncRoles(): Promise<void> {
  try {
    await httpsCallable(functions, 'syncClaims')()
    await auth.currentUser?.getIdToken(true)
  } catch {
    // non-fatal — role stays whatever it was
  }
}

export async function signInWithPassword(
  phone: string,
  password: string,
): Promise<void> {
  resetSessionViewMode()
  await signInWithEmailAndPassword(auth, syntheticEmail(phone), password)
  await syncRoles()
}
