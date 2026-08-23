# AGENTS.md

## Packages

Multi-package repo **without** npm workspaces — each package has its own lockfile and install:

```bash
npm ci --prefix shared && npm ci --prefix functions && npm ci --prefix app
```

| Path | Role |
|---|---|
| `shared/` | `@chitapp/shared`: domain types, cycle state machine, currency, errors, OTP/password, WhatsApp templates |
| `functions/` | Firebase Cloud Functions — every Firestore write lives here |
| `app/` | React 19 + Vite PWA (Tailwind 4, react-router, custom i18n) |

Dependency direction: `functions -> shared/dist` (via `file:../shared`), `app -> shared/src` (via the `@shared` alias in vite/tsconfig). Nothing depends on `app`. If you change `shared/`, rebuild it (`npm run build --prefix shared`) before building or typechecking functions.

## Commands

From root unless noted:

- `npm run dev` — Vite dev server for `app`
- `npm run typecheck` — shared typecheck + real builds of functions and app; this is the repo's "everything compiles" check (no CI exists)
- `npm run build` — shared → functions → app; order matters (functions needs `shared/dist`)
- `npm run test:shared` — vitest unit tests; single file: `npx vitest run src/currency.test.ts` from `shared/`
- `npm run lint --prefix app` — oxlint (`app/.oxlintrc.json`); the only linter in the repo

## Firebase backend

- **No local emulators.** The app (dev and prod) connects directly to the deployed `chitpay` Firebase project — dev config lives in gitignored `app/.env` (`app/.env.production` shows the shape). Every mutation hits real data; be deliberate about running callables against it.

- **No client-side Firestore writes.** Rules deny all writes; mutations are v2 Callable Functions (`onCall({ region: 'asia-south1', invoker: 'public' })`) in `functions/src/`, exported from `functions/src/index.ts`. New write path = new callable.
- Rules are in a temporary open-read state (any signed-in user reads everything) with a TODO to restore the privacy model — don't assume read isolation and don't "fix" casually (see comments in `firestore.rules`).
- Throw domain errors as `AppError` from shared and map them with `toHttpsError`; don't construct raw `HttpsError`s ad hoc.
- Admin status comes from `users/{uid}.roles` in Firestore. Provision admins only with the trusted local `functions` package script; privileged callables verify the profile role server-side.
- WhatsApp sends go through the Kwic adapter (`functions/src/messaging.ts`) using gitignored `functions/.env` (see `.env.example`): `KWIC_API_KEY` required. Templates are `_en`/`_ta` pairs in `shared/src/templates.ts`.

## Conventions

- Money is integer minor units (paise) end to end — never floats; format with `formatMinor` from shared.
- Cycle lifecycle transitions go through the state machine in `shared/src/stateMachine.ts` (`assertTransition`).
- UI strings use the custom typed dictionary in `app/src/i18n/` (no i18n library): add new strings to both `en.ts` and `ta.ts` — a missing Tamil key fails typecheck.
- Node 22 everywhere (pinned by functions `engines`).
- Design decisions live in `docs/plans/`; product spec is `Mobile-First Chit Group Management App — PRD.md` at the root.

## Verification before finishing

No CI is configured. Run `npm run typecheck` and `npm run test:shared`, plus `npm run lint --prefix app` if you touched `app/`.
