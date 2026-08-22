import { formatMinor } from './currency.js'

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
export function renderMessage(template: TemplateId, v: TemplateVars): string {
  const amount = formatMinor(v.amountMinor, v.currency)
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
