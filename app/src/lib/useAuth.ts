import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Role, UserDoc } from '@shared'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserDoc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? (snap.data() as UserDoc) : null)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
  }, [])

  const logout = useCallback(() => signOut(auth), [])

  const roles: Role[] = profile?.roles ?? []
  return {
    user,
    profile,
    loading,
    logout,
    isAdmin: roles.includes('admin'),
    isMember: roles.includes('member'),
  }
}
