export type Role = 'admin' | 'member'
export type Lang = 'en' | 'ta'

export interface UserDoc {
  name: string
  phone: string
  roles: Role[]
  language?: Lang
  createdAt: number
}

export type GroupStatus = 'active' | 'completed' | 'archived'
export type ArchivableGroupStatus = Exclude<GroupStatus, 'archived'>
export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'
export type CycleFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface GroupDoc {
  adminUid: string
  name: string
  contributionAmountMinor: number
  currency: string
  frequency: CycleFrequency
  cycleCount: number
  startDate: string // YYYY-MM-DD
  description?: string
  requirePaidToWin: boolean
  status: GroupStatus
  statusBeforeArchive?: ArchivableGroupStatus
  archivedAt?: number
  archivedBy?: string
  memberCount: number
  activeCycleCount: number
  completedCycleCount: number
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
  totalContributedMinor: number
  paidCycleCount: number
  joinedAt: number
}

export type CycleStatus = 'upcoming' | 'active' | 'complete'

export type PayoutStatus = 'pending' | 'paid'

export interface PayoutInfo {
  amountMinor: number
  status: PayoutStatus
  paidAt: number | null
  recordedBy: string | null
}

export interface CycleDoc {
  cycleNumber: number
  plannedStartDate: string // YYYY-MM-DD
  startedAt: number | null
  completedAt: number | null
  status: CycleStatus
  expectedPaymentCount: number
  recipientMembershipId: string | null
  payout: PayoutInfo
  paidCount: number
  collectedAmountMinor: number
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
  updatedAt?: number | null
}

export type PaymentEventType = 'recorded' | 'edited' | 'reversed'

export interface PaymentEventSnapshot {
  status: PaymentStatus
  amountMinor: number
  method: PaymentMethod | null
  referenceNo: string | null
  note: string | null
  paidAt: number | null
}

export interface PaymentEventDoc {
  groupId: string
  cycleNumber: number
  membershipId: string
  type: PaymentEventType
  before: PaymentEventSnapshot | null
  after: PaymentEventSnapshot | null
  reason: string | null
  performedBy: string
  createdAt: number
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

export interface MembershipMirrorDoc {
  groupId: string
  groupName: string
  membershipId: string
  contributionAmountMinor: number
  currency: string
  status: MemberSlotStatus
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
  | 'login_link'
  | 'login_access'
  | 'member_invite'
  | 'payment_reminder'
  | 'pending_payments_reminder'
  | 'recipient_notification'
  | 'payout_confirmation'

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface MessageLogDoc {
  groupId: string
  cycleNumber?: number
  cycleNumbers?: number[]
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
