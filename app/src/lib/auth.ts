import {
  isSignInWithEmailLink,
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithEmailLink,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { normalizePhone } from '@shared'
import { auth, functions } from './firebase'

const LOGIN_EMAIL_STORAGE_KEY = 'chitapp_login_email'

async function recordLoginBestEffort(): Promise<void> {
  const call = httpsCallable<Record<string, never>, { ok: boolean }>(functions, 'recordLogin')
  try {
    await call({})
  } catch (error) {
    console.error('Could not record last login:', error)
  }
}

/** Synthetic email used as the Firebase Auth identifier for phone-based users. */
export function syntheticEmail(phone: string): string {
  return `${normalizePhone(phone)}@phone.chitapp.app`
}

export async function requestOtp(phone: string, language: 'en' | 'ta' = 'en'): Promise<void> {
  const call = httpsCallable(functions, 'requestOtp')
  await call({ phone: normalizePhone(phone), language })
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
  await signInWithEmailLink(auth, email, firebaseLink)
  await recordLoginBestEffort()
  try {
    localStorage.removeItem(LOGIN_EMAIL_STORAGE_KEY)
  } catch {
    // non-fatal
  }
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
  await signInWithCustomToken(auth, res.data.token)
  // OTP verification already records the login server-side.
}

export async function signInWithPassword(
  phone: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(auth, syntheticEmail(phone), password)
  await recordLoginBestEffort()
}

/**
 * Dev-only anonymous sign-in for the e2e harness. Never called from
 * production builds (the login page gates it behind import.meta.env.DEV).
 * The anonymous user has no users/{uid} doc and no roles, so the app runs
 * in member view with read-only access.
 */
export async function devSignIn(): Promise<void> {
  await signInAnonymously(auth)
}
