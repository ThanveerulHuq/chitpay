import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const PROJECT_ID = 'chitpay'
const DATABASE_ID = 'chitpay'
const PROVIDER_NAME = 'Azhagiya mun madhiri trust baithulmal'
const START_DATE = '2026-08-10'
const ROOT = path.resolve(import.meta.dirname, '../..')
const DATA_DIR = path.join(ROOT, 'data')
const BATCH_LIMIT = 450
const EXECUTE = process.argv.includes('--execute')

const GROUPS = [
  ['Team_A_Contact_List.xlsx', 'Team A Contact List', 100000, 'weekly', 20],
  ['Team_A_Contact_List_2.xlsx', 'Team A Contact List 2', 50000, 'weekly', 20],
  ['Team_B_Contact_List.xlsx', 'Team B Contact List', 100000, 'weekly', 20],
  ['Team_Contact_List_3.xlsx', 'Team Contact List 3', 25000, 'weekly', 20],
  ['Team_Contact_List_4.xlsx', 'Team Contact List 4', 100000, 'monthly', 10],
  ['Team_B_New_Contact_List.xlsx', 'Team B New Contact List', 100000, 'monthly', 10],
  ['Team_Contact_List_5.xlsx', 'Team Contact List 5', 500000, 'monthly', 10],
  ['Team_A_New_Contact_List.xlsx', 'Team A New Contact List', 500000, 'monthly', 20],
].map(([sourceFile, name, contributionAmountInPaise, frequency, cycleCount]) => ({
  sourceFile,
  name,
  contributionAmountInPaise,
  frequency,
  cycleCount,
}))

const PHONE_OVERRIDES = new Map([
  ['Team_A_Contact_List_2.xlsx:9', '9000000000'],
])

function xmlUnescape(value) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function xmlAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return match?.[1] ?? ''
}

function unzipText(file, member) {
  try {
    return execFileSync('unzip', ['-p', file, member], { encoding: 'utf8' })
  } catch {
    return ''
  }
}

function parseSharedStrings(xml) {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((text) => xmlUnescape(text[1]))
      .join(''),
  )
}

function parseSheet(file) {
  const sharedStrings = parseSharedStrings(unzipText(file, 'xl/sharedStrings.xml'))
  const xml = unzipText(file, 'xl/worksheets/sheet1.xml')
  if (!xml) throw new Error(`Could not read worksheet from ${path.basename(file)}.`)

  return [...xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const rowNumber = Number(xmlAttribute(rowMatch[1], 'r'))
    const values = {}
    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributes = cellMatch[1]
      const reference = xmlAttribute(attributes, 'r')
      const column = reference.match(/^[A-Z]+/)?.[0]
      if (!column) continue
      const type = xmlAttribute(attributes, 't')
      const content = cellMatch[2] ?? ''
      const valueMatch = content.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)
      let value = valueMatch ? xmlUnescape(valueMatch[1]) : ''
      if (type === 's' && value !== '') value = sharedStrings[Number(value)] ?? ''
      if (type === 'inlineStr') {
        value = [...content.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((text) => xmlUnescape(text[1]))
          .join('')
      }
      values[column] = value
    }
    return { rowNumber, values }
  })
}

function numericPhonePart(raw) {
  const trimmed = raw.trim()
  if (/e/i.test(trimmed)) {
    const number = Number(trimmed)
    if (!Number.isSafeInteger(number)) throw new Error(`Phone number is not safe to convert: ${raw}`)
    return String(number)
  }
  return trimmed
}

function normalizePhone(raw, sourceFile, rowNumber) {
  const first = raw.split('/')[0].trim()
  const override = PHONE_OVERRIDES.get(`${sourceFile}:${rowNumber}`)
  const value = override ?? first
  const digits = numericPhonePart(value).replace(/[^0-9]/g, '')
  if (digits.length !== 10) throw new Error(`${sourceFile} row ${rowNumber}: invalid phone ${raw}`)
  return `91${digits}`
}

function cleanName(raw) {
  return raw.trim().replace(/"\s*$/, '').trim()
}

function loadGroup(config) {
  const file = path.join(DATA_DIR, config.sourceFile)
  if (!existsSync(file)) throw new Error(`Missing data file: ${config.sourceFile}`)
  const rows = parseSheet(file).filter(({ values }) => values.B || values.C)
  const dataRows = rows.filter(({ values }) => !/^(S\.No|வ\.எண்)/.test(values.A ?? ''))
  if (dataRows.length !== config.cycleCount) {
    throw new Error(`${config.sourceFile}: expected ${config.cycleCount} rows, found ${dataRows.length}.`)
  }

  const warnings = []
  const slots = dataRows.map(({ rowNumber, values }, index) => {
    const dataRowNumber = index + 1
    const name = cleanName(values.B ?? '')
    if (!name) throw new Error(`${config.sourceFile} row ${rowNumber}: member name is missing.`)
    const rawPhone = (values.C ?? '').trim()
    if (rawPhone.includes('/')) warnings.push(`${config.sourceFile} contact ${dataRowNumber}: used first phone number.`)
    const usedOverride = PHONE_OVERRIDES.has(`${config.sourceFile}:${dataRowNumber}`)
    if (usedOverride) warnings.push(`${config.sourceFile} contact ${dataRowNumber}: used temporary phone 9000000000.`)
    const phone = normalizePhone(rawPhone, config.sourceFile, dataRowNumber)
    return { name, phone, rowNumber }
  })

  return { ...config, slots, warnings }
}

function cycleDates(startDate, frequency, count) {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + index * 7)
    else date.setUTCMonth(date.getUTCMonth() + index)
    return date.toISOString().slice(0, 10)
  })
}

function groupIdFor(sourceFile) {
  return `import_${sourceFile.replace(/\.xlsx$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
}

function printDryRun(groups) {
  console.log(`Provider: ${PROVIDER_NAME}`)
  console.log(`Start date: ${START_DATE}`)
  console.log('')
  for (const group of groups) {
    const uniquePhones = new Set(group.slots.map((slot) => slot.phone)).size
    console.log(`${group.sourceFile}: ${group.name}`)
    console.log(`  id=${groupIdFor(group.sourceFile)} rows=${group.slots.length} uniquePhones=${uniquePhones} amountPaise=${group.contributionAmountInPaise} frequency=${group.frequency} cycles=${group.cycleCount}`)
    console.log(`  schedule=${cycleDates(START_DATE, group.frequency, group.cycleCount).join(', ')}`)
    for (const warning of group.warnings) console.log(`  warning=${warning}`)
  }
  console.log('')
  console.log('Dry run only. Use --execute to write to Firebase.')
}

async function commitOperations(db, operations) {
  for (let index = 0; index < operations.length; index += BATCH_LIMIT) {
    const batch = db.batch()
    for (const operation of operations.slice(index, index + BATCH_LIMIT)) operation(batch)
    await batch.commit()
  }
}

async function executeImport(groups) {
  const [{ applicationDefault, initializeApp }, { getAuth }, { FieldValue, getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore'),
  ])
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  const db = getFirestore(undefined, DATABASE_ID)
  const auth = getAuth()

  const providers = (await db.collection('providers').get()).docs
    .filter((doc) => String(doc.data()?.name ?? '').trim().toLocaleLowerCase() === PROVIDER_NAME.toLocaleLowerCase())
  if (providers.length !== 1) throw new Error(`Expected exactly one provider named "${PROVIDER_NAME}", found ${providers.length}.`)
  const provider = providers[0]
  if (provider.data()?.status !== 'active') throw new Error(`Provider "${PROVIDER_NAME}" is not active.`)

  const groupRefs = groups.map((group) => db.doc(`groups/${groupIdFor(group.sourceFile)}`))
  const existingGroups = await db.getAll(...groupRefs)
  const existing = existingGroups.filter((doc) => doc.exists)
  if (existing.length) throw new Error(`Import already exists or partially exists: ${existing.map((doc) => doc.id).join(', ')}`)

  const phones = [...new Set(groups.flatMap((group) => group.slots.map((slot) => slot.phone)))]
  const users = new Map()
  const newProfiles = []
  for (const phone of phones) {
    const email = `${phone}@phone.chitapp.app`
    let user
    try {
      user = await auth.getUserByEmail(email)
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error
      const firstSlot = groups.flatMap((group) => group.slots).find((slot) => slot.phone === phone)
      user = await auth.createUser({ email, emailVerified: true, displayName: firstSlot?.name ?? phone })
    }
    users.set(phone, user)
    const profileRef = db.doc(`users/${user.uid}`)
    const profileSnap = await profileRef.get()
    if (!profileSnap.exists) {
      const firstSlot = groups.flatMap((group) => group.slots).find((slot) => slot.phone === phone)
      newProfiles.push((batch) => batch.create(profileRef, {
        name: firstSlot?.name ?? phone,
        phone,
        roles: ['member'],
        createdAt: FieldValue.serverTimestamp(),
      }))
    }
  }
  await commitOperations(db, newProfiles)

  const operations = []
  for (const group of groups) {
    const groupId = groupIdFor(group.sourceFile)
    const groupRef = db.doc(`groups/${groupId}`)
    const memberRefs = group.slots.map(() => groupRef.collection('members').doc())
    const cycleRefs = cycleDates(START_DATE, group.frequency, group.cycleCount)
      .map((_, index) => groupRef.collection('cycles').doc(String(index + 1)))

    operations.push((batch) => batch.create(groupRef, {
      providerId: provider.id,
      name: group.name,
      contributionAmountInPaise: group.contributionAmountInPaise,
      frequency: group.frequency,
      cycleCount: group.cycleCount,
      startDate: START_DATE,
      status: 'active',
      memberCount: group.slots.length,
      activeCycleCount: 0,
      completedCycleCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      importSourceFile: group.sourceFile,
    }))

    cycleRefs.forEach((cycleRef, index) => operations.push((batch) => batch.create(cycleRef, {
      cycleNumber: index + 1,
      plannedStartDate: cycleDates(START_DATE, group.frequency, group.cycleCount)[index],
      startedAt: null,
      completedAt: null,
      status: 'upcoming',
      expectedPaymentCount: 0,
      recipientMembershipId: null,
      payout: { amountMinor: 0, status: 'pending', paidAt: null, recordedBy: null },
      paidCount: 0,
      collectedAmountMinor: 0,
      createdAt: FieldValue.serverTimestamp(),
    })))

    const membershipIdsByPhone = new Map()
    group.slots.forEach((slot, index) => {
      const membershipRef = memberRefs[index]
      const user = users.get(slot.phone)
      operations.push((batch) => batch.create(membershipRef, {
        uid: user.uid,
        slotNo: index + 1,
        displayName: slot.name,
        status: 'active',
        selectedInCycle: null,
        totalContributedMinor: 0,
        paidCycleCount: 0,
        joinedAt: FieldValue.serverTimestamp(),
      }))
      operations.push((batch) => batch.create(db.doc(`users/${user.uid}/memberships/${membershipRef.id}`), {
        groupId,
        providerId: provider.id,
        groupName: group.name,
        membershipId: membershipRef.id,
        contributionAmountInPaise: group.contributionAmountInPaise,
        status: 'active',
        selectedInCycle: null,
        joinedAt: FieldValue.serverTimestamp(),
      }))
      const ids = membershipIdsByPhone.get(user.uid) ?? []
      ids.push(membershipRef.id)
      membershipIdsByPhone.set(user.uid, ids)
    })
    for (const [uid, membershipIds] of membershipIdsByPhone) {
      operations.push((batch) => batch.create(db.doc(`users/${uid}/groupAccess/${groupId}`), { membershipIds }))
    }
  }
  await commitOperations(db, operations)
  console.log(`Imported ${groups.length} groups for provider ${provider.id}.`)
  for (const group of groups) console.log(`  ${group.name}: ${group.slots.length} memberships, ${group.cycleCount} cycles, id=${groupIdFor(group.sourceFile)}`)
}

async function main() {
  const groups = GROUPS.map(loadGroup)
  if (!EXECUTE) {
    printDryRun(groups)
    return
  }
  await executeImport(groups)
}

main().catch((error) => {
  console.error(error?.message ?? error)
  process.exitCode = 1
})
