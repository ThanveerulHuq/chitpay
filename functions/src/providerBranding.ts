import { onRequest } from 'firebase-functions/v2/https'
import type { ProviderDoc } from '@chitapp/shared'
import { db } from './firebaseAdmin.js'

const ROUTE = /^\/provider-branding\/([^/]+)\/(manifest\.webmanifest|icon-(192|512)\.webp)$/

export const providerBranding = onRequest(
  { region: 'asia-south1', invoker: 'public' },
  async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.set('Allow', 'GET, HEAD').status(405).send('Method not allowed')
      return
    }

    const match = new URL(req.url, 'https://chitpay.invalid').pathname.match(ROUTE)
    if (!match) {
      res.status(404).send('Not found')
      return
    }

    let providerId: string
    try {
      providerId = decodeURIComponent(match[1])
    } catch {
      res.status(404).send('Not found')
      return
    }
    if (!providerId || providerId.length > 128 || providerId.includes('/')) {
      res.status(404).send('Not found')
      return
    }
    const provider = (await db.doc(`providers/${providerId}`).get()).data() as ProviderDoc | undefined
    if (provider?.status !== 'active' || !provider.appIcon) {
      res.status(404).send('Not found')
      return
    }

    res.set('X-Content-Type-Options', 'nosniff')
    if (match[2] === 'manifest.webmanifest') {
      const version = encodeURIComponent(provider.appIcon.version)
      const base = `/provider-branding/${encodeURIComponent(providerId)}`
      res
        .set('Cache-Control', 'no-cache')
        .type('application/manifest+json')
        .send(JSON.stringify({
          id: '/',
          name: 'ChitPay',
          short_name: 'ChitPay',
          description: 'Collect. Select. Manage.',
          theme_color: '#059669',
          background_color: '#fafaf9',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          icons: [
            { src: `${base}/icon-192.webp?v=${version}`, sizes: '192x192', type: 'image/webp' },
            { src: `${base}/icon-512.webp?v=${version}`, sizes: '512x512', type: 'image/webp' },
            { src: `${base}/icon-512.webp?v=${version}`, sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
          ],
        }))
      return
    }

    const image = match[3] === '192' ? provider.appIcon.image192 : provider.appIcon.image512
    res
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .type(provider.appIcon.contentType)
      .send(Buffer.from(image, 'base64'))
  },
)
