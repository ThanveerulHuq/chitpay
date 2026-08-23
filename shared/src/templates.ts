import { formatMinor } from './currency.js'
import type { Lang } from './types.js'

export interface TemplateVars {
  memberName: string
  groupName: string
  amountMinor: number
  currency: string
  poolAmountMinor?: number
  loginCode?: string
  loginLinkId?: string
  appUrl?: string
}

export type TemplateId =
  | 'login_code'
  | 'login_link'
  | 'member_invite'
  | 'payment_reminder'
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
        return `உங்கள் ChitPay உள்நுழைவு OTP: ${v.loginCode}. இது 5 நிமிடங்களில் காலாவதியாகிவிடும்.`
      case 'login_link':
        return `வணக்கம் ${v.memberName},\n\nஇதோ ChitPay-க்கான உங்கள் உள்நுழைவு இணைப்பு.\n\nஉங்கள் குழுவைப் பார்க்க கீழே உள்ள லிங்க்கை கிளிக் செய்யவும்.`
      case 'member_invite':
        return (
          `வணக்கம் ${v.memberName}! நீங்கள் ChitPay-ல் *${v.groupName}* குழுவில் சேர்க்கப்பட்டுள்ளீர்கள். ` +
          `உங்கள் எண் மற்றும் கடவுச்சொல்லுடன் (${v.loginCode}) ${v.appUrl ?? 'https://chitpay.web.app'} தளத்தில் உள்நுழையவும்.`
        )
      case 'payment_reminder':
        return (
          `வணக்கம் ${v.memberName}, ${v.groupName} குழுவிற்கான உங்கள் சுற்று சந்தா தொகை ${amount}. ` +
          `தயவுசெய்து செலுத்தி உறுதிப்படுத்தவும்.`
        )
      case 'recipient_notification': {
        const pool = formatMinor(v.poolAmountMinor ?? v.amountMinor, v.currency)
        return (
          `வாழ்த்துகள் ${v.memberName}! ${v.groupName} குழுவில் இந்த சுற்றுக்கான ` +
          `${pool} சீட்டுத் தொகை உங்களுக்குக் கிடைத்துள்ளது.`
        )
      }
      case 'payout_confirmation':
        return (
          `வணக்கம் ${v.memberName}, ${v.groupName} குழுவிற்கான உங்கள் சீட்டுத் தொகை ${amount} வழங்கப்பட்டது பதிவு செய்யப்பட்டுள்ளது.`
        )
    }
  }

  switch (template) {
    case 'login_code':
      return `Your ChitPay verification code is ${v.loginCode}. It expires in 5 minutes.`
    case 'login_link':
      return `Hi ${v.memberName}, here's your access link for ChitPay.\n\nTap the button below to see your group.`
    case 'member_invite':
      return (
        `Hi ${v.memberName}! You've been added to *${v.groupName}* on ChitPay. ` +
        `Login at ${v.appUrl ?? 'https://chitpay.web.app'} with your number and password: ${v.loginCode}`
      )
    case 'payment_reminder':
      return (
        `Hi ${v.memberName}, your cycle contribution of ${amount} for ` +
        `${v.groupName} is pending. ` +
        `Please make the payment and share confirmation.`
      )
    case 'recipient_notification': {
      const pool = formatMinor(v.poolAmountMinor ?? v.amountMinor, v.currency)
      return (
        `Congratulations ${v.memberName}! You have been selected as this cycle's ` +
        `recipient for ${pool} in ${v.groupName}.`
      )
    }
    case 'payout_confirmation':
      return (
        `Hi ${v.memberName}, your payout of ${amount} for ${v.groupName} has been recorded.`
      )
  }
}
