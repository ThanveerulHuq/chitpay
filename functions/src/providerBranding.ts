import { onRequest } from 'firebase-functions/v2/https'
import type { ProviderDoc } from '@chitapp/shared'
import { db } from './firebaseAdmin.js'

const PROVIDER_ROUTE = /^\/provider-branding\/([^/]+)\/(manifest\.webmanifest|icon-(192|512)\.webp)$/
const PROVIDER_COOKIE = 'chitapp_provider_id'

function providerIdFromCookie(cookieHeader: string | undefined): string | null {
  const value = cookieHeader
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === PROVIDER_COOKIE)?.slice(1).join('=')
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

function validProviderId(providerId: string | null): providerId is string {
  return Boolean(providerId && providerId.length <= 128 && !providerId.includes('/'))
}

function manifest(providerId?: string, version?: string) {
  const icons = providerId && version
    ? [
        { src: `/provider-branding/${encodeURIComponent(providerId)}/icon-192.webp?v=${encodeURIComponent(version)}`, sizes: '192x192', type: 'image/webp' },
        { src: `/provider-branding/${encodeURIComponent(providerId)}/icon-512.webp?v=${encodeURIComponent(version)}`, sizes: '512x512', type: 'image/webp' },
        { src: `/provider-branding/${encodeURIComponent(providerId)}/icon-512.webp?v=${encodeURIComponent(version)}`, sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
      ]
    : [
        { src: '/chitpay-pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/chitpay-pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/chitpay-pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]

  return {
    id: '/',
    name: 'ChitPay',
    short_name: 'ChitPay',
    description: 'Collect. Select. Manage.',
    theme_color: '#059669',
    background_color: '#fafaf9',
    display: 'standalone',
    scope: '/',
    start_url: '/',
    icons,
  }
}

export const providerBranding = onRequest(
  { region: 'asia-south1', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.set('Allow', 'GET, HEAD').status(405).send('Method not allowed')
      return
    }

    const pathname = new URL(req.url, 'https://chitpay.invalid').pathname
    const match = pathname.match(PROVIDER_ROUTE)
    const isRootManifest = pathname === '/manifest.webmanifest'
    if (!match && !isRootManifest) {
      res.status(404).send('Not found')
      return
    }

    let providerId: string | null = null
    if (isRootManifest) {
      providerId = providerIdFromCookie(req.get('cookie'))
    } else {
      try {
        providerId = decodeURIComponent(match![1])
      } catch {
        res.status(404).send('Not found')
        return
      }
    }
    if (providerId && !validProviderId(providerId)) {
      res.status(404).send('Not found')
      return
    }

    const provider = providerId
      ? (await db.doc(`providers/${providerId}`).get()).data() as ProviderDoc | undefined
      : undefined
    const appIcon = provider?.status === 'active' ? provider.appIcon : undefined

    if (isRootManifest) {
      res
        .set('Cache-Control', 'private, no-cache')
        .set('Vary', 'Cookie')
        .set('X-Content-Type-Options', 'nosniff')
        .type('application/manifest+json')
        .send(JSON.stringify(appIcon ? manifest(providerId!, appIcon.version) : manifest()))
      return
    }

    if (!match || !appIcon) {
      res.status(404).send('Not found')
      return
    }

    res.set('X-Content-Type-Options', 'nosniff')
    if (match[2] === 'manifest.webmanifest') {
      res
        .set('Cache-Control', 'no-cache')
        .type('application/manifest+json')
        .send(JSON.stringify(manifest(providerId!, appIcon.version)))
      return
    }

    const image = match[3] === '192' ? appIcon.image192 : appIcon.image512
    res
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .type(appIcon.contentType)
      .send(Buffer.from(image, 'base64'))
  },
)
