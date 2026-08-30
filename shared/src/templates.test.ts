import { describe, it, expect } from 'vitest'
import { renderMessage } from './templates'

const vars = {
  memberName: 'Farhan',
  groupName: 'Ahmed Friends Group',
  amountMinor: 1000000,
}

describe('message templates', () => {
  describe('English', () => {
    it('renders a cycle payment reminder without a due date', () => {
      const msg = renderMessage('payment_reminder', vars)
      expect(msg).toContain('Farhan')
      expect(msg).toContain('₹10,000')
      expect(msg).toContain('cycle contribution')
    })

    it('renders one consolidated reminder for all pending cycles', () => {
      const msg = renderMessage('pending_payments_reminder', {
        ...vars,
        amountMinor: 3000000,
        pendingCycles: [1, 2, 3],
      })
      expect(msg).toContain('cycles 1, 2, 3')
      expect(msg).toContain('₹30,000')
      expect(msg).toContain('total pending')
    })

    it('renders recipient notification with pool amount', () => {
      const msg = renderMessage('recipient_notification', { ...vars, poolAmountMinor: 20000000 })
      expect(msg).toContain('₹2,00,000')
    })

    it('renders login code', () => {
      const msg = renderMessage('login_code', { ...vars, loginCode: '123456' })
      expect(msg).toContain('123456')
    })

    it('renders login link copy', () => {
      const msg = renderMessage('login_link', vars)
      expect(msg).toContain("Hi Farhan, here's your access link for ChitPay.")
      expect(msg).toContain('Tap the button below to see your group.')
    })

    it('renders member invite', () => {
      const msg = renderMessage('member_invite', { ...vars, loginCode: '123456', appUrl: 'https://chitpay.web.app' })
      expect(msg).toContain('Farhan')
      expect(msg).toContain('Ahmed Friends Group')
      expect(msg).toContain('123456')
    })

    it('renders payout confirmation', () => {
      const msg = renderMessage('payout_confirmation', vars)
      expect(msg).toContain('Farhan')
      expect(msg).toContain('₹10,000')
    })

    it('never leaks other members into messages', () => {
      const msg = renderMessage('payment_reminder', vars)
      expect(msg).not.toMatch(/password/i)
    })
  })

  describe('Tamil', () => {
    it('renders login code in Tamil', () => {
      const msg = renderMessage('login_code', { ...vars, loginCode: '123456' }, 'ta')
      expect(msg).toContain('ChitPay உள்நுழைவு OTP: 123456')
      expect(msg).toContain('5 நிமிடங்களில்')
    })

    it('renders login link copy in Tamil', () => {
      const msg = renderMessage('login_link', vars, 'ta')
      expect(msg).toContain('வணக்கம் Farhan')
      expect(msg).toContain('உங்கள் உள்நுழைவு இணைப்பு')
    })

    it('renders member invite in Tamil', () => {
      const msg = renderMessage('member_invite', { ...vars, loginCode: '123456' }, 'ta')
      expect(msg).toContain('வணக்கம் Farhan')
      expect(msg).toContain('*Ahmed Friends Group*')
      expect(msg).toContain('123456')
    })

    it('renders payment reminder in Tamil', () => {
      const msg = renderMessage('payment_reminder', vars, 'ta')
      expect(msg).toContain('Farhan')
      expect(msg).toContain('₹10,000')
      expect(msg).toContain('சுற்று சந்தா')
    })

    it('renders a consolidated payment reminder in Tamil', () => {
      const msg = renderMessage('pending_payments_reminder', {
        ...vars,
        amountMinor: 3000000,
        pendingCycles: [1, 2, 3],
      }, 'ta')
      expect(msg).toContain('1, 2, 3')
      expect(msg).toContain('₹30,000')
      expect(msg).toContain('மொத்த நிலுவை')
    })

    it('renders recipient notification in Tamil', () => {
      const msg = renderMessage('recipient_notification', { ...vars, poolAmountMinor: 20000000 }, 'ta')
      expect(msg).toContain('வாழ்த்துகள் Farhan')
      expect(msg).toContain('₹2,00,000')
      expect(msg).toContain('Ahmed Friends Group')
    })

    it('renders payout confirmation in Tamil', () => {
      const msg = renderMessage('payout_confirmation', vars, 'ta')
      expect(msg).toContain('வணக்கம் Farhan')
      expect(msg).toContain('₹10,000')
      expect(msg).toContain('வழங்கப்பட்டது பதிவு செய்யப்பட்டுள்ளது')
    })
  })
})
