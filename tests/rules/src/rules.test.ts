import { afterAll, beforeAll, beforeEach, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

const PROJECT_ID = 'rules-test'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('../../firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await env.clearFirestore()
})

afterAll(async () => {
  await env.cleanup()
})

// Seed helper: writes with admin bypass
const admin = () => env.authenticatedContext('admin-1')
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', 'admin-1'), {
      name: 'Admin', phone: '+911111111111', roles: ['admin'], createdAt: 1,
    })
    await setDoc(doc(db, 'users', 'member-1'), {
      name: 'Member', phone: '+912222222222', roles: ['member'], createdAt: 1,
    })
    await setDoc(doc(db, 'groups', 'g1'), {
      adminUid: 'admin-1', name: 'G', monthlyAmountMinor: 1000000,
      currency: 'INR', dueDay: 21, durationMonths: 20, startDate: '2026-08-01',
      status: 'active', currentCycleNumber: 1, memberCount: 2, paidCount: 0,
      collectedAmountMinor: 0, requirePaidToWin: false, createdAt: 1,
    })
    // member-1 has an active membership in g1 → groupAccess marker exists
    await setDoc(doc(db, 'users/member-1/groupAccess/g1'), {})
  })
}

describe('firestore rules', () => {
  it('admin reads own group; outsider cannot', async () => {
    await seed()
    const asAdmin = admin().firestore()
    await assertSucceeds(getDoc(doc(asAdmin, 'groups/g1')))

    const asOutsider = env.authenticatedContext('random').firestore()
    await assertFails(getDoc(doc(asOutsider, 'groups/g1')))
  })

  it('member with active membership reads group but not other users', async () => {
    await seed()
    const asMember = env.authenticatedContext('member-1').firestore()
    await assertSucceeds(getDoc(doc(asMember, 'groups/g1')))
    await assertSucceeds(getDoc(doc(asMember, 'users/member-1')))
    await assertFails(getDoc(doc(asMember, 'users/admin-1')))
  })

  it('nobody writes payments or cycles directly', async () => {
    await seed()
    const asAdmin = admin().firestore()
    await assertFails(
      setDoc(doc(asAdmin, 'groups/g1/cycles/1/payments/m1'), { amountMinor: 1 }),
    )
    const asMember = env.authenticatedContext('member-1').firestore()
    await assertFails(
      setDoc(doc(asMember, 'groups/g1/cycles/1'), { status: 'complete' }),
    )
  })

  it('otps are server-only; selections are read-only', async () => {
    await seed()
    const any = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(any, 'otps/+911111111111')))
    await assertFails(setDoc(doc(any, 'selections/s1'), {}))
  })

  it('user can only edit own name, not roles or phone', async () => {
    await seed()
    const me = env.authenticatedContext('member-1').firestore()
    await assertFails(
      setDoc(doc(me, 'users/member-1'), { name: 'X', phone: '+919999999999', roles: ['admin'] }),
    )
  })
})
