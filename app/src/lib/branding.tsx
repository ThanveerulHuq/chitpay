import { useEffect, useState, type ReactNode } from 'react'
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore'
import type { MembershipMirrorDoc, ProviderAppIcon, ProviderDoc } from '@shared'
import { useAuth } from './useAuth'
import { db } from './firebase'
import { BrandingContext } from './brandingContext'

const FALLBACK_ICON = '/brand/chitpay-app-icon-hands.png'
const STORAGE_KEY = 'chitapp_provider_branding'
const PROVIDER_COOKIE = 'chitapp_provider_id'

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

function rememberProvider(providerId: string) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${PROVIDER_COOKIE}=${encodeURIComponent(providerId)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
}

function forgetProvider() {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${PROVIDER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
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
    void getDocs(collection(db, 'users', user.uid, 'memberships')).then((snapshot) => {
      const providerIds = new Set<string>()
      for (const membershipSnapshot of snapshot.docs) {
        const membership = membershipSnapshot.data() as MembershipMirrorDoc
        providerIds.add(membership.providerId)
      }
      if (!cancelled) setMemberProvider({ uid, providerId: providerIds.size === 1 ? [...providerIds][0] : null })
    }).catch(() => {
      if (!cancelled) setMemberProvider({ uid, providerId: null })
    })
    return () => { cancelled = true }
  }, [adminProviderId, loading, user])

  const providerId = adminProviderId ?? memberProviderId

  useEffect(() => {
    if (providerId) rememberProvider(providerId)
    else if (!loading && user && memberProviderId !== undefined) forgetProvider()
  }, [loading, memberProviderId, providerId, user])

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
  }, [activeBranding])

  return (
    <BrandingContext.Provider value={{
      iconSrc: activeBranding ? iconSrc(activeBranding.appIcon) : FALLBACK_ICON,
    }}>
      {children}
    </BrandingContext.Provider>
  )
}
