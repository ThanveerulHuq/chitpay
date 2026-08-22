import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getAnalytics, isSupported } from 'firebase/analytics'

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-chitapp.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-chitapp',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-chitapp.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID ?? '0',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const app = getApps().length ? getApps()[0] : initializeApp(config)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'asia-south1')

// Initialize Analytics only if it is supported (e.g. browser environment)
export const analyticsPromise = isSupported().then(supported => 
  supported ? getAnalytics(app) : null
)
