export type Role = 'admin' | 'member'

export interface UserDoc {
  name: string
  phone: string
  roles: Role[]
  createdAt: number
}

export type GroupStatus = 'active' | 'completed' | 'archived'
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'

export interface GroupDoc {
  adminUid: string
  name: string
  monthlyAmountMinor: number
  currency: string
  dueDay: number // 1-28
  durationMonths: number
  startDate: string // YYYY-MM-DD
  description?: string
  requirePaidToWin: boolean
  status: GroupStatus
  currentCycleNumber: number
  memberCount: number
  paidCount: number
  collectedAmountMinor: number
  createdAt: number
}

export type MemberSlotStatus = 'active' | 'inactive'

/** A membership slot inside a group — decoupled from uid (multiple slots allowed). */
export interface GroupMemberDoc {
  uid: string
  slotNo: number
  displayName: string
  status: MemberSlotStatus
  selectedInCycle: number | null
  joinedAt: number
}

export type CycleStatus =
  | 'upcoming'
  | 'payment_open'
  | 'collection_complete'
  | 'recipient_selected'
  | 'payout_recorded'
  | 'complete'

export type PayoutStatus = 'pending' | 'paid'

export interface PayoutInfo {
  amountMinor: number
  status: PayoutStatus
  paidAt: number | null
  recordedBy: string | null
}

export interface CycleDoc {
  monthNumber: number
  periodStart: string // YYYY-MM-DD
  dueDate: string // YYYY-MM-DD
  status: CycleStatus
  recipientMembershipId: string | null
  payout: PayoutInfo
  createdAt: number
}

export type PaymentStatus = 'pending' | 'paid'

export interface PaymentDoc {
  amountMinor: number
  status: PaymentStatus
  method: PaymentMethod | null
  referenceNo: string | null
  note: string | null
  paidAt: number | null
  recordedBy: string | null
}

export interface BoardEntry {
  membershipId: string
  name: string
  status: PaymentStatus
  method: PaymentMethod | null
}

export interface BoardDoc {
  entries: BoardEntry[]
}

export type MembershipPaymentStatus = 'pending' | 'paid' | 'overdue' | null

export interface MembershipMirrorDoc {
  groupId: string
  groupName: string
  membershipId: string
  monthlyAmountMinor: number
  currency: string
  status: MemberSlotStatus
  myPaymentStatus: MembershipPaymentStatus
  selectedInCycle: number | null
  joinedAt: number
}

export interface SelectionAuditDoc {
  groupId: string
  cycleNumber: number
  selectedMembershipId: string
  selectedMemberName: string
  eligibleMembershipIds: string[]
  eligibleCount: number
  performedBy: string
  poolAmountMinor: number
  selectedAt: number
}

export type MessageTemplate =
  | 'login_code'
  | 'member_invite'
  | 'payment_reminder'
  | 'overdue_reminder'
  | 'recipient_notification'
  | 'payout_confirmation'

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface MessageLogDoc {
  groupId: string
  template: MessageTemplate
  toPhone: string
  membershipId: string | null
  providerMessageId: string | null
  status: MessageStatus
  error: string | null
  sentBy: string | null
  createdAt: number
  updatedAt: number
}
