import { useEffect, useState, type ReactNode } from 'react'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import type { MembershipMirrorDoc, ProviderAppIcon, ProviderDoc } from '@shared'
import { useAuth } from './useAuth'
import { db } from './firebase'
import { BrandingContext } from './brandingContext'

const FALLBACK_ICON = '/brand/chitpay-app-icon-hands.png'
const FALLBACK_MANIFEST = '/manifest.webmanifest'
const STORAGE_KEY = 'chitapp_provider_branding'

interface CachedBranding {
  providerId: string
  appIcon: ProviderAppIcon
}

function iconSrc(icon: ProviderAppIcon): string {
  return `data:${icon.contentType};base64,${icon.image192}`
}

function readCachedBranding(): CachedBranding | null {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CachedBranding | null
    return cached?.providerId && cached.appIcon?.image192 ? cached : null
  } catch {
    return null
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const [branding, setBranding] = useState<CachedBranding | null>(() => readCachedBranding())
  const adminProviderId = profile?.roles.includes('admin') ? profile.providerId : undefined
  const [memberProvider, setMemberProvider] = useState<{ uid: string; providerId: string | null } | null>(null)
  const memberProviderId = !adminProviderId && memberProvider && memberProvider.uid === user?.uid
    ? memberProvider.providerId
    : undefined

  useEffect(() => {
    if (loading || !user || adminProviderId) return
    let cancelled = false
    const uid = user.uid
    void getDocs(collection(db, 'users', user.uid, 'memberships')).then(async (snapshot) => {
      const providerIds = new Set<string>()
      const unresolvedGroupIds: string[] = []
      for (const membershipSnapshot of snapshot.docs) {
        const membership = membershipSnapshot.data() as MembershipMirrorDoc
        if (membership.providerId) providerIds.add(membership.providerId)
        else if (membership.groupId) unresolvedGroupIds.push(membership.groupId)
      }
      const groups = await Promise.all(unresolvedGroupIds.map((groupId) => getDoc(doc(db, 'groups', groupId))))
      for (const group of groups) {
        const providerId = group.data()?.providerId
        if (typeof providerId === 'string') providerIds.add(providerId)
      }
      if (!cancelled) setMemberProvider({ uid, providerId: providerIds.size === 1 ? [...providerIds][0] : null })
    }).catch(() => {
      if (!cancelled) setMemberProvider({ uid, providerId: null })
    })
    return () => { cancelled = true }
  }, [adminProviderId, loading, user])

  const providerId = adminProviderId ?? memberProviderId

  useEffect(() => {
    if (loading || (user && !adminProviderId && memberProviderId === undefined)) return
    if (!user) {
      // oxlint-disable-next-line react/set-state-in-effect -- auth is an external subscription
      setBranding(readCachedBranding())
      return
    }
    if (!providerId) {
      // oxlint-disable-next-line react/set-state-in-effect -- auth is an external subscription
      setBranding(null)
      return
    }
    return onSnapshot(doc(db, 'providers', providerId), (snapshot) => {
      const provider = snapshot.data() as ProviderDoc | undefined
      const next = provider?.status === 'active' && provider.appIcon
        ? { providerId, appIcon: provider.appIcon }
        : null
      setBranding(next)
      try {
        if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        else localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Restricted storage should not prevent branding in the current session.
      }
    }, () => setBranding(null))
  }, [adminProviderId, loading, memberProviderId, providerId, user])

  const activeBranding = !user
    ? branding
    : providerId && branding?.providerId === providerId ? branding : null

  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (favicon) favicon.href = activeBranding ? iconSrc(activeBranding.appIcon) : FALLBACK_ICON

    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!manifest) {
      manifest = document.createElement('link')
      manifest.rel = 'manifest'
      document.head.append(manifest)
    }
    manifest.href = activeBranding
      ? `/provider-branding/${encodeURIComponent(activeBranding.providerId)}/manifest.webmanifest?v=${encodeURIComponent(activeBranding.appIcon.version)}`
      : FALLBACK_MANIFEST
  }, [activeBranding])

  return (
    <BrandingContext.Provider value={{
      iconSrc: activeBranding ? iconSrc(activeBranding.appIcon) : FALLBACK_ICON,
    }}>
      {children}
    </BrandingContext.Provider>
  )
}
