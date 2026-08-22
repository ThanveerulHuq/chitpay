import { formatMinor } from './currency.js'
import type { Lang } from './types.js'

export interface TemplateVars {
  memberName: string
  groupName: string
  amountMinor: number
  currency: string
  dueDate?: string
  poolAmountMinor?: number
  loginCode?: string
  appUrl?: string
}

export type TemplateId =
  | 'login_code'
  | 'member_invite'
  | 'payment_reminder'
  | 'overdue_reminder'
  | 'recipient_notification'
  | 'payout_confirmation'

/**
 * Renders message bodies used both as WhatsApp template payloads and as
 * fallbacks. BSP-specific template IDs map 1:1 to TemplateId.
 */
export function renderMessage(
  template: TemplateId,
  v: TemplateVars,
  lang: Lang = 'en',
): string {
  const amount = formatMinor(v.amountMinor, v.currency)
  if (lang === 'ta') {
    switch (template) {
      case 'login_code':
        return `உங்கள் ChitApp சரிபார்ப்புக் குறியீடு ${v.loginCode}. இது 5 நிமிடங்களில் காலாவதியாகிவிடும்.`
      case 'member_invite':
        return (
          `வணக்கம் ${v.memberName}! நீங்கள் ChitApp-ல் *${v.groupName}* குழுவில் சேர்க்கப்பட்டுள்ளீர்கள். ` +
          `உங்கள் எண் மற்றும் கடவுச்சொல்லுடன் (${v.loginCode}) ${v.appUrl ?? 'https://chitapp.app'} தளத்தில் உள்நுழையவும்.`
        )
      case 'payment_reminder':
        return (
          `வணக்கம் ${v.memberName}, ${v.groupName} குழுவிற்கான உங்கள் மாத சந்தா தொகை ${amount}` +
          `${v.dueDate ? ` ${v.dueDate} அன்று` : ' இன்று'} செலுத்தப்பட வேண்டும். ` +
          `தயவுசெய்து பணம் செலுத்தி உறுதிப்படுத்தவும்.`
        )
      case 'overdue_reminder':
        return (
          `வணக்கம் ${v.memberName}, ${v.groupName} குழுவிற்கான உங்கள் மாத சந்தா தொகை ${amount} ` +
          `செலுத்த வேண்டிய காலக்கெடு முடிந்துவிட்டது (காலக்கெடு: ${v.dueDate}). தயவுசெய்து விரைவில் செலுத்தவும்.`
        )
      case 'recipient_notification': {
        const pool = formatMinor(v.poolAmountMinor ?? v.amountMinor, v.currency)
        return (
          `வாழ்த்துகள் ${v.memberName}! ${v.groupName} குழுவில் இந்த மாதத்திற்கான ` +
          `${pool} சீட்டு பெறுநராக நீங்கள் தேர்ந்தெடுக்கப்பட்டுள்ளீர்கள்.`
        )
      }
      case 'payout_confirmation':
        return (
          `வணக்கம் ${v.memberName}, ${v.groupName} குழுவிற்கான உங்கள் தொகை ${amount} வழங்கப்பட்டது பதிவு செய்யப்பட்டுள்ளது.`
        )
    }
  }

  switch (template) {
    case 'login_code':
      return `Your ChitApp verification code is ${v.loginCode}. It expires in 5 minutes.`
    case 'member_invite':
      return (
        `Hi ${v.memberName}! You've been added to *${v.groupName}* on ChitApp. ` +
        `Login at ${v.appUrl ?? 'https://chitapp.app'} with your number and password: ${v.loginCode}`
      )
    case 'payment_reminder':
      return (
        `Hi ${v.memberName}, your monthly contribution of ${amount} for ` +
        `${v.groupName} is due${v.dueDate ? ` on ${v.dueDate}` : ' today'}. ` +
        `Please make the payment and share confirmation.`
      )
    case 'overdue_reminder':
      return (
        `Hi ${v.memberName}, your monthly contribution of ${amount} for ` +
        `${v.groupName} is overdue (was due ${v.dueDate}). Please pay at the earliest.`
      )
    case 'recipient_notification': {
      const pool = formatMinor(v.poolAmountMinor ?? v.amountMinor, v.currency)
      return (
        `Congratulations ${v.memberName}! You have been selected as this month's ` +
        `recipient for ${pool} in ${v.groupName}.`
      )
    }
    case 'payout_confirmation':
      return (
        `Hi ${v.memberName}, your payout of ${amount} for ${v.groupName} has been recorded.`
      )
  }
}
