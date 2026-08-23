import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { normalizePhone } from '@chitapp/shared'

const PROJECT_ID = 'chitpay'
const DATABASE_ID = 'chitpay'

function usage() {
  console.error('Usage: npm run admin:create --prefix functions -- <phone> <name>')
  console.error('Example: npm run admin:create --prefix functions -- +919003711581 "Imthiyaz"')
}

async function main() {
  const [rawPhone, ...nameParts] = process.argv.slice(2)
  const name = nameParts.join(' ').trim()
  if (!rawPhone || !name) {
    usage()
    process.exitCode = 1
    return
  }

  let phone
  try {
    phone = normalizePhone(rawPhone)
  } catch {
    throw new Error('Enter a valid phone number including its country code.')
  }

  const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  const auth = getAuth(app)
  const db = getFirestore(app, DATABASE_ID)
  const email = `${phone}@phone.chitapp.app`

  let user
  let authCreated = false
  try {
    user = await auth.getUserByEmail(email)
    if (user.displayName !== name) {
      user = await auth.updateUser(user.uid, { displayName: name })
    }
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    user = await auth.createUser({ email, emailVerified: true, displayName: name })
    authCreated = true
  }

  const profileRef = db.doc(`users/${user.uid}`)
  const profileSnap = await profileRef.get()
  const existingRoles = profileSnap.exists && Array.isArray(profileSnap.data()?.roles)
    ? profileSnap.data().roles.filter((role) => role === 'admin' || role === 'member')
    : []
  const roles = [...new Set([...existingRoles, 'admin', 'member'])]

  await profileRef.set({
    name,
    phone,
    roles,
    ...(profileSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true })

  console.log(JSON.stringify({
    uid: user.uid,
    phone,
    name,
    roles,
    auth: authCreated ? 'created' : 'updated',
    profile: profileSnap.exists ? 'updated' : 'created',
  }, null, 2))
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exitCode = 1
})
