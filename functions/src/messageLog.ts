import type { MessageLogDoc } from '@chitapp/shared'
import { db } from './firebaseAdmin.js'

export async function writeUserMessage(log: MessageLogDoc): Promise<void> {
  await db.collection(`users/${log.recipientUid}/messages`).add(log)
}
