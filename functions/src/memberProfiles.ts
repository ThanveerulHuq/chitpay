import { onCall } from 'firebase-functions/v2/https'
import { FieldValue, type DocumentReference, type WriteBatch } from 'firebase-admin/firestore'
import {
  AppError,
  normalizePhone,
  resolveMessageLanguage,
  type BoardDoc,
  type GroupDoc,
  type GroupMemberDoc,
  type Lang,
  type MessageLogDoc,
  type UserDoc,
} from '@chitapp/shared'
import { auth, db } from './firebaseAdmin.js'
import { assertAdminAccess, groupAdminLanguage, sendLoginOtp, syntheticEmail } from './auth.js'
import { toHttpsError } from './httpsError.js'
import { writeUserMessage } from './messageLog.js'

interface ManagedGroupSummary {
  groupId: string
  name: string
  slotCount: number
  inactiveSlotCount: number
}

interface ManagedMemberSummary {
  uid: string
  name: string
  names: string[]
  phone: string
  isAdmin: boolean
  groupCount: number
  slotCount: number
  inactiveSlotCount: number
  groups: ManagedGroupSummary[]
}

interface MutableManagedMember {
  uid: string
  fallbackName: string
  names: Map<string, string>
  groups: Map<string, ManagedGroupSummary>
}

interface UpdateManagedMemberProfileInput {
  uid: string
  names: Array<{ currentName: string; name: string }>
  phone: string
}

interface UpdateOwnNameInput {
  name: string
}

interface ManagedAnchor {
  groupId: string
  membershipId: string
}

const WRITE_BATCH_LIMIT = 450

function normalizedPhone(value: unknown): string {
  try {
    return normalizePhone(String(value ?? ''))
  } catch {
    throw new AppError('invalid_argument', 'Enter a valid Indian mobile number.')
  }
}

function normalizedName(value: unknown): string {
  const name = String(value ?? '').trim()
  if (!name) throw new AppError('invalid_argument', 'Name is required.')
  if (name.length > 100) throw new AppError('invalid_argument', 'Name is too long.')
  return name
}

function isAuthUserNotFound(error: unknown): boolean {
  return (error as { code?: string })?.code === 'auth/user-not-found'
}

function isAuthEmailInUse(error: unknown): boolean {
  return (error as { code?: string })?.code === 'auth/email-already-exists'
}

async function ownedGroups(adminUid: string): Promise<Map<string, GroupDoc>> {
  const profile = (await db.doc(`users/${adminUid}`).get()).data() as UserDoc | undefined
  const snaps = profile?.providerId
    ? await Promise.all([
        db.collection('groups').where('providerId', '==', profile.providerId).get(),
        db.collection('groups').where('adminUid', '==', adminUid).get(),
      ])
    : [await db.collection('groups').where('adminUid', '==', adminUid).get()]
  const groups = new Map<string, GroupDoc>()
  for (const snap of snaps) {
    for (const doc of snap.docs) groups.set(doc.id, doc.data() as GroupDoc)
  }
  return groups
}

async function findManagedAnchor(adminUid: string, targetUid: string): Promise<ManagedAnchor> {
  const groups = await ownedGroups(adminUid)
  if (groups.size === 0) throw new AppError('permission_denied')
  const memberships = await db.collectionGroup('members').where('uid', '==', targetUid).get()
  const match = memberships.docs.find((doc) => {
    const groupId = doc.ref.parent.parent?.id
    return Boolean(groupId && groups.has(groupId))
  })
  const groupId = match?.ref.parent.parent?.id
  if (!match || !groupId) throw new AppError('permission_denied')
  return { groupId, membershipId: match.id }
}

async function assertPhoneAvailable(uid: string, phone: string): Promise<void> {
  try {
    const existingAuthUser = await auth.getUserByEmail(syntheticEmail(phone))
    if (existingAuthUser.uid !== uid) throw new AppError('already_exists', 'This mobile number is already in use.')
  } catch (error) {
    if (error instanceof AppError) throw error
    if (!isAuthUserNotFound(error)) throw error
  }

  const profiles = await db.collection('users').where('phone', '==', phone).limit(2).get()
  if (profiles.docs.some((doc) => doc.id !== uid)) {
    throw new AppError('already_exists', 'This mobile number is already in use.')
  }
}

async function commitWrites(
  writes: Array<(batch: WriteBatch) => void>,
): Promise<void> {
  for (let index = 0; index < writes.length; index += WRITE_BATCH_LIMIT) {
    const batch = db.batch()
    for (const write of writes.slice(index, index + WRITE_BATCH_LIMIT)) write(batch)
    await batch.commit()
  }
}

async function updateManagedAliases(
  adminUid: string,
  uid: string,
  edits: Array<{ currentName: string; name: string }>,
): Promise<void> {
  const groups = await ownedGroups(adminUid)
  const editMap = new Map(edits.map((edit) => [edit.currentName.trim().toLocaleLowerCase(), edit.name]))
  const membershipSnap = await db.collectionGroup('members').where('uid', '==', uid).get()
  const renamedIdsByGroup = new Map<string, Map<string, string>>()
  const writes: Array<(batch: WriteBatch) => void> = []

  for (const memberDoc of membershipSnap.docs) {
    const groupId = memberDoc.ref.parent.parent?.id
    if (!groupId || !groups.has(groupId)) continue
    const member = memberDoc.data() as GroupMemberDoc
    const nextName = editMap.get(member.displayName.trim().toLocaleLowerCase())
    if (!nextName || nextName === member.displayName) continue
    writes.push((batch) => batch.update(memberDoc.ref, { displayName: nextName }))
    const ids = renamedIdsByGroup.get(groupId) ?? new Map<string, string>()
    ids.set(memberDoc.id, nextName)
    renamedIdsByGroup.set(groupId, ids)
  }

  for (const [groupId, renamedIds] of renamedIdsByGroup) {
    const cycles = await db.collection(`groups/${groupId}/cycles`).get()
    const boardRefs = cycles.docs.map((cycle) => cycle.ref.collection('board').doc('board'))
    const boards = boardRefs.length ? await db.getAll(...boardRefs) : []
    for (const boardSnap of boards) {
      if (!boardSnap.exists) continue
      const board = boardSnap.data() as BoardDoc
      const entries = board.entries.map((entry) => {
        const nextName = renamedIds.get(entry.membershipId)
        return nextName ? { ...entry, name: nextName } : entry
      })
      if (entries.some((entry, index) => entry.name !== board.entries[index]?.name)) {
        writes.push((batch) => batch.update(boardSnap.ref, { entries }))
      }
    }
  }

  await commitWrites(writes)
}

async function updateAccountProfile(
  uid: string,
  name: string,
  requestedPhone?: string,
  syncMembershipNames = true,
): Promise<{ phoneChanged: boolean; phone: string; language?: Lang }> {
  const profileRef = db.doc(`users/${uid}`)
  const profileSnap = await profileRef.get()
  const profile = profileSnap.data() as UserDoc | undefined
  if (!profileSnap.exists || !profile) throw new AppError('not_found', 'Member account not found.')

  const oldPhone = normalizedPhone(profile.phone)
  const phone = requestedPhone ?? oldPhone
  const phoneChanged = phone !== oldPhone
  if (phoneChanged) await assertPhoneAvailable(uid, phone)

  try {
    await auth.updateUser(uid, {
      displayName: name,
      ...(phoneChanged ? { email: syntheticEmail(phone), emailVerified: true } : {}),
    })
  } catch (error) {
    if (isAuthEmailInUse(error)) {
      throw new AppError('already_exists', 'This mobile number is already in use.')
    }
    if (isAuthUserNotFound(error)) throw new AppError('not_found', 'Member login account not found.')
    throw error
  }

  const membershipSnap = syncMembershipNames
    ? await db.collectionGroup('members').where('uid', '==', uid).get()
    : null
  const membershipIdsByGroup = new Map<string, Set<string>>()
  for (const memberDoc of membershipSnap?.docs ?? []) {
    const groupId = memberDoc.ref.parent.parent?.id
    if (!groupId) continue
    const ids = membershipIdsByGroup.get(groupId) ?? new Set<string>()
    ids.add(memberDoc.id)
    membershipIdsByGroup.set(groupId, ids)
  }

  const boardSnapshots = await Promise.all(
    [...membershipIdsByGroup.keys()].map(async (groupId) => {
      const cycles = await db.collection(`groups/${groupId}/cycles`).get()
      const refs = cycles.docs.map((cycle) => cycle.ref.collection('board').doc('board'))
      if (refs.length === 0) return []
      return db.getAll(...refs)
    }),
  )

  const writes: Array<(batch: WriteBatch) => void> = []

  for (const memberDoc of membershipSnap?.docs ?? []) {
    writes.push((batch) => batch.update(memberDoc.ref, { displayName: name }))
  }

  for (const boardSnap of boardSnapshots.flat()) {
    if (!boardSnap.exists) continue
    const groupId = boardSnap.ref.parent.parent?.parent.parent?.id
    const membershipIds = groupId ? membershipIdsByGroup.get(groupId) : undefined
    if (!membershipIds) continue
    const board = boardSnap.data() as BoardDoc
    const entries = board.entries.map((entry) => (
      membershipIds.has(entry.membershipId) ? { ...entry, name } : entry
    ))
    if (entries.some((entry, index) => entry.name !== board.entries[index]?.name)) {
      writes.push((batch) => batch.update(boardSnap.ref, { entries }))
    }
  }

  if (phoneChanged) {
    const staleRefs: DocumentReference[] = [
      db.doc(`otps/${oldPhone}`),
      db.doc(`loginLinkRequests/${oldPhone}`),
    ]
    for (const ref of staleRefs) writes.push((batch) => batch.delete(ref))
  }

  // Commit the canonical profile last. If an earlier fan-out batch fails, a
  // retry still sees the old phone and safely repeats the idempotent writes.
  writes.push((batch) => batch.set(profileRef, {
    name,
    phone,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true }))

  await commitWrites(writes)
  if (phoneChanged) await auth.revokeRefreshTokens(uid)

  return { phoneChanged, phone, language: profile.language }
}

export const listManagedMembers = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const adminUid = req.auth?.uid
    if (!adminUid) throw new AppError('unauthenticated')
    await assertAdminAccess(req.auth)
    const groups = await ownedGroups(adminUid)
    const memberSnaps = await Promise.all(
      [...groups.keys()].map((groupId) => db.collection(`groups/${groupId}/members`).get()),
    )

    const members = new Map<string, MutableManagedMember>()
    memberSnaps.forEach((snap, index) => {
      const groupId = [...groups.keys()][index]!
      const group = groups.get(groupId)!
      for (const memberDoc of snap.docs) {
        const member = memberDoc.data() as GroupMemberDoc
        if (!member.uid) continue
        const current = members.get(member.uid) ?? {
          uid: member.uid,
          fallbackName: member.displayName,
          names: new Map<string, string>(),
          groups: new Map<string, ManagedGroupSummary>(),
        }
        const displayName = member.displayName.trim()
        if (displayName) current.names.set(displayName.toLocaleLowerCase(), displayName)
        const groupSummary = current.groups.get(groupId) ?? {
          groupId,
          name: group.name,
          slotCount: 0,
          inactiveSlotCount: 0,
        }
        groupSummary.slotCount += 1
        if (member.status === 'inactive') groupSummary.inactiveSlotCount += 1
        current.groups.set(groupId, groupSummary)
        members.set(member.uid, current)
      }
    })

    const profileRefs = [...members.keys()].map((uid) => db.doc(`users/${uid}`))
    const profileSnaps = profileRefs.length ? await db.getAll(...profileRefs) : []
    const profiles = new Map(profileSnaps.map((snap) => [snap.id, snap.data() as UserDoc | undefined]))
    const result: ManagedMemberSummary[] = [...members.values()].map((member) => {
      const profile = profiles.get(member.uid)
      const memberGroups = [...member.groups.values()].sort((a, b) => a.name.localeCompare(b.name))
      const names = [...member.names.values()]
      const name = names.join(' / ') || profile?.name?.trim() || member.fallbackName
      return {
        uid: member.uid,
        name,
        names: names.length ? names : [name],
        phone: profile?.phone ?? '',
        isAdmin: profile?.roles?.includes('admin') ?? false,
        groupCount: memberGroups.length,
        slotCount: memberGroups.reduce((sum, group) => sum + group.slotCount, 0),
        inactiveSlotCount: memberGroups.reduce((sum, group) => sum + group.inactiveSlotCount, 0),
        groups: memberGroups,
      }
    })

    result.sort((a, b) => a.name.localeCompare(b.name))
    return { members: result }
  } catch (error) {
    throw toHttpsError(error, { fn: 'listManagedMembers', uid: req.auth?.uid })
  }
})

export const updateManagedMemberProfile = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const adminUid = req.auth?.uid
    if (!adminUid) throw new AppError('unauthenticated')
    await assertAdminAccess(req.auth)
    const input = req.data as UpdateManagedMemberProfileInput
    const uid = String(input?.uid ?? '').trim()
    if (!uid) throw new AppError('invalid_argument', 'Member is required.')
    const edits = Array.isArray(input?.names)
      ? input.names.map((edit) => ({
          currentName: normalizedName(edit?.currentName),
          name: normalizedName(edit?.name),
        }))
      : []
    if (edits.length === 0) throw new AppError('invalid_argument', 'At least one member name is required.')
    const name = edits[0]!.name
    const phone = normalizedPhone(input?.phone)
    const anchor = await findManagedAnchor(adminUid, uid)
    const targetProfile = (await db.doc(`users/${uid}`).get()).data() as UserDoc | undefined
    if (targetProfile?.roles?.includes('admin')) {
      throw new AppError('permission_denied', 'Admin accounts cannot be edited from member management.')
    }
    const update = await updateAccountProfile(uid, name, phone, false)
    await updateManagedAliases(adminUid, uid, edits)

    let notificationSent = false
    let providerMessageId: string | null = null
    let notificationError: string | null = null
    if (update.phoneChanged) {
      try {
        const group = (await db.doc(`groups/${anchor.groupId}`).get()).data() as GroupDoc | undefined
        const language = resolveMessageLanguage(
          update.language,
          group ? await groupAdminLanguage(group, adminUid) : undefined,
        )
        const response = await sendLoginOtp(update.phone, language)
        providerMessageId = response.providerMessageId
        notificationSent = true
      } catch (error) {
        notificationError = error instanceof Error ? error.message : String(error)
        console.error('updated member OTP notification failed:', error)
      }

      const log: MessageLogDoc = {
        recipientUid: uid,
        groupId: anchor.groupId,
        template: 'login_code',
        toPhone: update.phone,
        membershipId: anchor.membershipId,
        providerMessageId,
        status: notificationSent ? 'sent' : 'failed',
        error: notificationError,
        sentBy: adminUid,
        createdAt: FieldValue.serverTimestamp() as unknown as number,
        updatedAt: FieldValue.serverTimestamp() as unknown as number,
      }
      try {
        await writeUserMessage(log)
      } catch (error) {
        console.error('updated member OTP message log failed:', error)
      }
    }

    return { ok: true, names: edits.map((edit) => edit.name), phoneChanged: update.phoneChanged, notificationSent }
  } catch (error) {
    throw toHttpsError(error, { fn: 'updateManagedMemberProfile', uid: req.auth?.uid, data: req.data })
  }
})

export const updateOwnName = onCall({ region: 'asia-south1', invoker: 'public' }, async (req) => {
  try {
    const uid = req.auth?.uid
    if (!uid) throw new AppError('unauthenticated')
    await assertAdminAccess(req.auth)
    const name = normalizedName((req.data as UpdateOwnNameInput)?.name)
    await updateAccountProfile(uid, name)
    return { ok: true }
  } catch (error) {
    throw toHttpsError(error, { fn: 'updateOwnName', uid: req.auth?.uid, data: req.data })
  }
})
