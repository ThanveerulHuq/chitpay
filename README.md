<p align="center">
  <img src="./app/public/brand/chitpay-app-icon.png" alt="ChitPay app icon" width="128" />
</p>

<h1 align="center">ChitPay</h1>

<p align="center">
  A mobile-first workspace for running rotating savings and chit groups with clarity.
</p>

ChitPay replaces scattered WhatsApp messages, spreadsheets, notebooks, and manual calculations with one focused workflow. Administrators can manage groups, collections, monthly selections, and payouts, while members get a private view of their contributions and group status.

## What ChitPay does

### For administrators

- Manage multiple chit groups and their members
- Configure contributions, schedules, and payment due dates
- Track monthly collections and overdue payments
- Run an eligible-member random selection
- Record payouts and review selection history
- Prepare WhatsApp payment reminders

### For members

- View group details and monthly contribution amounts
- Check current and historical payment status
- Follow selection and payout progress
- Review personal contribution history

## Built with

- React 19, TypeScript, and Vite
- Tailwind CSS and Phosphor Icons
- Firebase Authentication, Firestore, Cloud Functions, and Hosting
- Progressive Web App support for a mobile-first experience
- Vitest and Firebase Emulator Suite tests

## Getting started

### Prerequisites

- Node.js 22
- npm
- Java, when running the Firestore emulator tests

Install the workspace dependencies:

```bash
npm ci --prefix shared
npm ci --prefix functions
npm ci --prefix app
```

Start the web application:

```bash
npm run dev
```

The Vite development server will print the local URL in your terminal.

## Useful commands

```bash
# Type-check the shared package and build the functions and web app
npm run typecheck

# Create a production build
npm run build

# Run shared unit tests
npm run test:shared

# Install rules-test dependencies and run Firestore rules tests
npm ci --prefix tests/rules
npm run test:rules

# Start the local Firebase emulators
npm run emulators
```

## Repository structure

```text
app/          React and Vite progressive web application
functions/    Firebase Cloud Functions
shared/       Shared domain types, validation, and utilities
tests/e2e/    End-to-end acceptance tests
tests/rules/  Firestore security rules tests
docs/plans/   Product and implementation design notes
```

## Project status

ChitPay is under active development. The current repository contains the mobile-first application shell, core admin and member experiences, shared business rules, and Firebase backend foundations.
