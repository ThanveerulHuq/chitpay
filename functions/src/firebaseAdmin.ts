import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Must run before any module touches Firestore/Auth. All entry modules import
// this file, so its module body is evaluated first.
initializeApp()

export const db = getFirestore('chitpay')
export const auth = getAuth()
