import { describe, it, expect } from 'vitest'
import { renderMessage } from './templates'

const vars = {
  memberName: 'Farhan',
  groupName: 'Ahmed Friends Group',
  amountMinor: 1000000,
  currency: 'INR',
}

describe('message templates', () => {
  it('renders payment reminder with due date', () => {
    const msg = renderMessage('payment_reminder', { ...vars, dueDate: '21 Aug 2026' })
    expect(msg).toContain('Farhan')
    expect(msg).toContain('₹10,000')
    expect(msg).toContain('21 Aug 2026')
  })

  it('renders recipient notification with pool amount', () => {
    const msg = renderMessage('recipient_notification', { ...vars, poolAmountMinor: 20000000 })
    expect(msg).toContain('₹2,00,000')
  })

  it('renders login code', () => {
    const msg = renderMessage('login_code', { ...vars, loginCode: '123456' })
    expect(msg).toContain('123456')
  })

  it('never leaks other members into messages', () => {
    const msg = renderMessage('overdue_reminder', { ...vars, dueDate: '21 Aug 2026' })
    expect(msg).not.toMatch(/password/i)
  })
})
