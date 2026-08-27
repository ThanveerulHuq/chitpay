<p align="center">
  <img src="./app/public/chitpay-pwa-192.png" alt="ChitPay app icon" width="128" />
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
- Vitest unit tests

## Getting started

### Prerequisites

- Node.js 22
- pnpm 9+ (`corepack enable` if needed)

Install the workspace dependencies:

```bash
pnpm install
```

Start the web application:

```bash
pnpm dev
```

The Vite development server will print the local URL in your terminal. In local
development the app connects directly to the deployed Firebase project using
the config in `app/.env` (see `app/.env.production` for the shape of it).

## Useful commands

```bash
# Type-check the shared package and build the functions and web app
pnpm typecheck        # or pnpm build for just builds

# Create a production build (turbo handles shared→functions→app order)
pnpm build

# Run shared unit tests (or pnpm test for all workspaces)
pnpm test:shared
pnpm --filter app lint
```

## Kwic WhatsApp configuration

Functions send the approved `_en`/`_ta` templates through Kwic. Firebase loads
the ignored `functions/.env` file when deploying Functions. Set the token under
`KWIC_API_KEY` and never commit that file:

```bash
firebase deploy --only functions
```

The adapter uses `https://app.kwic.in/api/v1/api/v1/push` by default. Copy
`functions/.env.example` to `functions/.env` to override any value.

## Admin provisioning

Admin roles are stored in `users/{uid}.roles` in Firestore and are assigned only
through the trusted local script. Authenticate with Application Default
Credentials, then run:

```bash
pnpm --filter chitapp-functions admin:create -- +919003711581 "Imthiyaz"
```

The command is safe to rerun. It creates or reuses the synthetic-email Firebase
Auth user and merges `admin` and `member` into the Firestore profile roles.

## Repository structure

```text
app/          React and Vite progressive web application
functions/    Firebase Cloud Functions
shared/       Shared domain types, validation, and utilities
docs/plans/   Product and implementation design notes
```

## Project status

ChitPay is under active development. The current repository contains the mobile-first application shell, core admin and member experiences, shared business rules, and Firebase backend foundations.
