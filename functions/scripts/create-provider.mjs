import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { normalizePhone } from '@chitapp/shared'

const PROJECT_ID = 'chitpay'
const DATABASE_ID = 'chitpay'
const [rawPhone, adminName, ...providerNameParts] = process.argv.slice(2)
const providerName = providerNameParts.join(' ').trim()

if (!rawPhone || !adminName?.trim() || !providerName) {
  console.error('Usage: pnpm --filter chitapp-functions provider:create -- <phone> <admin-name> <provider-name>')
  process.exit(1)
}

async function main() {
  const phone = normalizePhone(rawPhone)
  const name = adminName.trim()
  const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  const auth = getAuth(app)
  const db = getFirestore(app, DATABASE_ID)
  const email = `${phone}@phone.chitapp.app`
  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    user = await auth.createUser({ email, emailVerified: true, displayName: name })
  }

  const userRef = db.doc(`users/${user.uid}`)
  const providerRef = db.collection('providers').doc()
  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef)
    const profile = userSnap.data()
    if (profile?.providerId) throw new Error('This admin already belongs to a provider.')
    transaction.create(providerRef, {
      name: providerName,
      language: profile?.language === 'ta' ? 'ta' : 'en',
      status: 'active',
      createdBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    transaction.create(providerRef.collection('admins').doc(user.uid), {
      uid: user.uid,
      addedBy: user.uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    transaction.set(userRef, {
      name: profile?.name?.trim() || name,
      phone,
      roles: [...new Set([...(profile?.roles ?? []), 'admin', 'member'])],
      providerId: providerRef.id,
      ...(userSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true })
  })
  console.log(JSON.stringify({ providerId: providerRef.id, providerName, adminUid: user.uid, phone, name }, null, 2))
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exitCode = 1
})
