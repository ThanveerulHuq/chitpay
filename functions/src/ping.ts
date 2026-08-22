import { onCall } from 'firebase-functions/v2/https'

export const ping = onCall({ region: 'asia-south1', invoker: 'public' }, async () => ({ ok: true, ts: Date.now() }))
