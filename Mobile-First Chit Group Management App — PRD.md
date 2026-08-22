# Product Requirements Document

## 1. Product Overview

A mobile-first application for administrators who manage multiple rotating savings/chit groups and for members who participate in those groups.

The product replaces WhatsApp messages, spreadsheets, notebooks, and manual calculations with a simple workflow for:

- Managing multiple groups
- Managing members and contributions
- Running the monthly random selection
- Tracking who has received the monthly pool
- Sending WhatsApp payment/reminder messages
- Giving members a private view of their own group and payment history

### Product principle

Keep the product extremely simple. The admin should be able to run a monthly group in **less than 2–3 minutes**.

---

# 2. Target Users

## Admin

A person who manages one or more groups.

Typical characteristics:

- Manages 5–50+ groups
- Each group may have 10–100 members
- Collects monthly payments
- Needs to know who has paid
- Needs to select the monthly recipient
- Communicates primarily through WhatsApp

## Member

A participant in one or more groups.

They primarily need to:

- Know how much they need to pay
- Know when payment is due
- See whether their payment has been recorded
- See whether/when they were selected
- See their contribution history
- See group status

---

# 3. MVP Scope

### Admin

1. Create/manage groups
2. Add/remove members
3. Configure monthly contribution
4. Set payment date
5. Track monthly payment status
6. Run monthly random selection
7. View selection history
8. Record payout
9. Send WhatsApp reminders
10. View group-level dashboard
11. Manage multiple groups

### Member

1. Login
2. View their groups
3. View monthly contribution
4. View payment status
5. View payment history
6. View selection/payout status
7. View basic group information
8. Receive WhatsApp reminders

---

# 4. Core Concept

Each group has:

- Group name
- Number of members
- Monthly contribution
- Total pool
- Start date
- Number of months
- Payment date
- Monthly recipient
- Payment status for every member

### Example

20 members × ₹10,000/month

Monthly pool:

**₹2,00,000**

20-month group.

Each month:

1. Members are expected to pay ₹10,000
2. Admin sees collection status
3. On the designated date, the system selects one eligible member randomly
4. That member becomes the recipient for the month
5. Admin records the payout
6. The cycle is completed
7. Next month begins

---

# 5. Admin Experience

## 5.1 Admin Home

The home screen should immediately show what needs attention.

### Dashboard

**Today's Actions**

- 3 payments pending
- 2 groups due today
- 1 group ready for selection
- 4 members overdue

### Groups

Cards/list:

**Ahmed Friends Group**
- ₹10,000/month
- 20 members
- Month 7/20
- ₹1,80,000 collected
- Selection: Pending

**Business Group**
- ₹25,000/month
- 15 members
- Month 4/15
- ₹3,25,000 collected
- Selection: Completed

Primary CTA:

**Create Group**

---

# 6. Group Management

## Create Group

Fields:

- Group name
- Monthly contribution
- Number of members
- Start date
- Payment due day
- Duration
- Currency
- Optional description

After creation:

**Add Members**

Member fields:

- Name
- Mobile number
- Optional email
- Optional member ID

Admin can:

- Add one member
- Add multiple members
- Import members from contacts/file in later versions

---

# 7. Group Dashboard

The group dashboard is the most important admin screen.

### Header

**Ahmed Friends Group**

₹10,000/month  
20 members  
Month 7 of 20

### Collection status

**17 / 20 paid**

₹1,70,000 collected

Progress bar

### Current month

Payment date:

**21 Aug 2026**

Status:

**Collection in progress**

Actions:

- View payments
- Send reminders
- Run selection
- Record payout

---

# 8. Monthly Cycle

Each group operates in monthly cycles.

### State machine

```text
UPCOMING
   ↓
PAYMENT OPEN
   ↓
COLLECTION COMPLETE
   ↓
SELECTION READY
   ↓
RECIPIENT SELECTED
   ↓
PAYOUT RECORDED
   ↓
MONTH COMPLETE
   ↓
NEXT MONTH
```

The system should prevent accidental actions that violate the cycle.

For example:

- Cannot select the same recipient twice
- Cannot select a member who already received a payout
- Cannot start the next cycle before closing the current cycle
- Cannot accidentally run selection twice

---

# 9. Random Selection

This is the signature feature of the product.

## Eligibility

When admin taps:

**Select Recipient**

The app generates the eligible member list.

A member is eligible when:

- They have not previously been selected
- They are an active member
- They satisfy any configured eligibility rules

### Selection screen

Display:

**Month 7 Recipient**

20 members

Eligible: 14

Large CTA:

**Pick Random Member**

### Animation

The product can display a short random-selection animation:

```text
Ahmed
Rahman
Ibrahim
Faisal
...
...
FARHAN
```

Then reveal:

# Farhan

**Recipient for Month 7**

₹2,00,000

### Confirmation

Admin must confirm:

**Confirm Selection**

After confirmation:

- Recipient is permanently recorded
- Selection timestamp is stored
- Selection history is updated
- Other members become ineligible for this cycle
- WhatsApp action becomes available

---

# 10. Randomness / Auditability

Because the selection can involve money, the system should make the selection trustworthy.

Store:

- Eligible member list
- Selection timestamp
- Selected member
- Admin who performed selection
- Selection ID
- Randomization event ID

Later versions could provide:

**View Selection Record**

This shows how the winner was selected.

The product should never allow an admin to silently change historical selection results.

---

# 11. Payment Management

## Monthly Payment Screen

Example:

**August — Month 7**

| Member | Amount | Status |
|---|---:|---|
| Ahmed | ₹10,000 | Paid |
| Rahman | ₹10,000 | Paid |
| Farhan | ₹10,000 | Pending |
| Ibrahim | ₹10,000 | Paid |

Filters:

- All
- Paid
- Pending
- Overdue

Actions:

**Mark Paid**

---

# 12. WhatsApp Reminders

WhatsApp is the primary communication channel.

The MVP should not require WhatsApp API integration.

Instead, provide a WhatsApp deep link from the app.

### Example

Admin taps:

**Remind Farhan**

The app opens WhatsApp with:

> Hi Farhan, your monthly contribution of ₹10,000 for Ahmed Friends Group is due today. Please make the payment and share confirmation.

The admin then sends the message through WhatsApp.

### WhatsApp link

Use:

`https://wa.me/<phone>?text=<encoded-message>`

The application generates the appropriate message automatically.

---

# 13. Reminder Types

Admin can send:

### Payment reminder

> Your monthly contribution of ₹10,000 is due today.

### Overdue reminder

> Your monthly contribution of ₹10,000 is overdue.

### Recipient notification

> Congratulations. You have been selected as this month's recipient for ₹2,00,000.

### Payout confirmation

> Your payout of ₹2,00,000 has been recorded.

---

# 14. Bulk WhatsApp Actions

Admin should be able to select multiple members.

Example:

**12 members pending**

CTA:

**Remind All**

The app opens WhatsApp sequentially for each member.

Important MVP limitation:

The app should not claim that the WhatsApp message was delivered. It only knows that WhatsApp was opened with the generated message.

---

# 15. Member App

Member login should be extremely simple.

Possible authentication:

- Mobile number + OTP

After login:

# My Groups

**Ahmed Friends Group**

₹10,000/month

Month 7 / 20

Status:

**Payment Pending**

CTA:

**View Details**

---

# 16. Member Group Details

### My Details

Contribution:

₹10,000/month

Total contributions:

₹60,000

Months completed:

6

Months remaining:

14

### Current month

Payment:

**Pending**

Due:

21 Aug 2026

### Recipient status

You have already received:

**No**

Your expected/selection status:

**Eligible**

### History

| Month | Contribution | Status | Recipient |
|---|---:|---|---|
| 1 | ₹10,000 | Paid | Ahmed |
| 2 | ₹10,000 | Paid | Rahman |
| 3 | ₹10,000 | Paid | Ibrahim |
| ... | ... | ... | ... |

---

# 17. Member Notifications

MVP can rely primarily on WhatsApp.

The member should be able to access:

- Payment due
- Payment recorded
- Selection result
- Payout recorded

Push notifications can be introduced later.

---

# 18. Admin Member Profile

Admin taps a member.

Display:

**Farhan**

Mobile:
+91 XXXXX XXXXX

### Group status

Contribution: ₹10,000

Paid months: 6

Pending months: 1

Total paid: ₹60,000

Selected: No

### Actions

- Mark payment
- Send WhatsApp reminder
- Edit member
- Deactivate member

---

# 19. Group Member List

Admin should be able to search and filter.

Filters:

- Paid
- Pending
- Overdue
- Selected
- Not selected

Search:

**Search members**

---

# 20. Multiple Groups

Admin can manage many groups from one account.

Example:

### My Groups

**Chennai Friends**
₹10,000 × 20

**Family Group**
₹5,000 × 15

**Business Group**
₹25,000 × 30

Each group maintains completely independent:

- Members
- Payment history
- Cycles
- Selection history
- Payouts

---

# 21. Dashboard KPIs

Admin dashboard should show:

### Today

Payments due:
₹4,25,000

Collected:
₹3,80,000

Pending:
₹45,000

### Groups

Active groups:
12

Groups requiring action:
4

Selections pending:
2

Overdue members:
13

Keep KPIs limited. This is an operational product, not an analytics product.

---

# 22. Data Model

Core entities:

### Admin

```text
id
name
mobile
created_at
```

### Group

```text
id
admin_id
name
monthly_amount
member_count
start_date
payment_due_day
duration_months
status
created_at
```

### Member

```text
id
name
mobile
status
created_at
```

### GroupMember

```text
id
group_id
member_id
joined_at
status
```

### MonthlyCycle

```text
id
group_id
month_number
period
due_date
status
recipient_member_id
selection_id
payout_status
```

### Payment

```text
id
cycle_id
member_id
amount
status
paid_at
recorded_by
```

### Selection

```text
id
cycle_id
selected_member_id
eligible_member_count
performed_by
selected_at
```

### Payout

```text
id
cycle_id
member_id
amount
status
paid_at
recorded_by
```

---

# 23. Roles & Permissions

## Admin

Can:

- Create groups
- Add/remove members
- Record payments
- Run selections
- Record payouts
- View all members
- View all groups

## Member

Can:

- View own information
- View own payments
- View group status
- View recipient history

Members cannot:

- Change payments
- Change selection results
- Edit other members
- Access other members' private information beyond what the group is intended to expose

---

# 24. Authentication

### Admin

Mobile number + OTP.

### Member

Mobile number + OTP.

A phone number may belong to:

- One admin
- Multiple group memberships
- Potentially both admin and member roles

Role-based access must therefore be explicit.

---

# 25. Mobile UX

Design for:

- Android first
- Mobile web/PWA or React Native
- One-handed usage
- Large touch targets
- Minimal typing
- WhatsApp-first workflow

### Primary navigation

Admin:

```text
Home | Groups | Activity | Profile
```

Member:

```text
Home | My Groups | Profile
```

---

# 26. Important UX Principle

The app should answer one question immediately:

> **"What do I need to do today?"**

For an admin, this could be:

**4 payments pending**

**1 group ready for selection**

For a member:

**₹10,000 payment due today**

---

# 27. Edge Cases

The product must handle:

### Member doesn't pay

Status becomes:

**Overdue**

Admin can continue collection.

Whether an unpaid member remains eligible for random selection should be configurable.

### Member leaves

Member becomes inactive.

Historical records remain unchanged.

### Member was selected but hasn't received payout

Selection remains complete.

Payout status:

**Pending**

### Admin accidentally closes app during selection

The selection must either:

- Complete atomically, or
- Remain unconfirmed and allow retry

Never create ambiguous results.

### Duplicate phone number

Prevent accidental duplicate member creation within the same group.

---

# 28. MVP Non-Goals

Do not build these initially:

- WhatsApp Business API
- Automatic WhatsApp messaging
- Payment gateway
- UPI collection
- Automatic bank reconciliation
- Complex accounting
- Investment features
- Auction/bidding mechanics
- Loans
- Credit scoring
- AI chatbot
- Advanced reporting

These add significant complexity without improving the core workflow.

---

# 29. Phase 2

Potential additions:

### Payments

- UPI payment links
- Payment gateway
- Payment receipts
- Automatic payment reconciliation

### WhatsApp

- WhatsApp Business API
- Automated reminders
- Delivery/read status
- Templates

### Admin

- CSV import
- Bulk member addition
- Multiple admins
- Assistant/admin roles
- Reports
- Export to Excel/PDF

### Member

- Payment proof upload
- UPI payment
- Digital receipts
- Notifications

---

# 30. Phase 3

Potential advanced features:

- Multiple payment frequencies
- Auction-based groups
- Flexible contribution amounts
- Digital agreements
- E-signatures
- Automated accounting
- Group invitation links
- Family/group referral system
- Audit reports
- Shariah-compliant group configuration

---

# 31. Success Metrics

### Admin activation

% of admins who:

**Create group → add members → complete first monthly cycle**

### Monthly usage

- Active groups
- Monthly cycles completed
- Payments recorded
- Selections completed
- WhatsApp reminders sent

### Operational efficiency

Target:

**Admin can complete monthly collection workflow in <3 minutes**

### Retention

- Groups active after 3 months
- Groups completed successfully
- Admins managing >1 group

---

# 32. MVP Acceptance Criteria

A release is successful when an admin can:

1. Sign up using mobile OTP
2. Create a group
3. Add 20 members
4. Configure ₹10,000 monthly contribution
5. Start the first monthly cycle
6. Mark members as paid
7. View pending members
8. Open WhatsApp reminder for a member
9. Select an eligible member randomly
10. Confirm the selection
11. Record payout
12. Start the next cycle
13. View complete historical records

A member can:

1. Login using mobile OTP
2. See their group
3. See monthly contribution
4. See current payment status
5. See payment history
6. See previous recipients
7. See whether they have been selected
8. See their payout status

---

# 33. Recommended MVP Architecture

Given the mobile-first requirement:

### Frontend

**Next.js PWA** or **React Native**

For the fastest MVP, a responsive **Next.js PWA** is sufficient.

### Backend

**Supabase**

- PostgreSQL
- Authentication
- Row-level security
- REST APIs
- Realtime where useful

### Hosting

**Vercel**

### WhatsApp

No API initially.

Generate:

`wa.me` links directly from the application.

### Notifications

Start with WhatsApp/manual workflow.

Add push notifications later.

---

# 34. Recommended MVP Screens

Admin:

1. Login
2. Dashboard
3. Groups
4. Create Group
5. Group Dashboard
6. Monthly Collection
7. Member Details
8. Random Selection
9. Selection Result
10. Payout
11. Activity/History
12. Profile

Member:

1. Login
2. Home
3. My Group
4. Payment History
5. Selection/Payout History
6. Profile

---

# 35. Product Positioning

The product should not initially position itself as a "chit fund investment platform."

A clearer positioning is:

**"Simple group savings management for admins and members."**

The differentiation is the operational workflow:

**Group → Collect → Remind → Randomly Select → Payout → Repeat**

That should remain the center of the product rather than turning it into a full financial-management application.