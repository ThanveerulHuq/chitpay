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

## E2E browser harness

Browser tests are driven by the `agent-browser` CLI against the Vite dev server — no test framework, scripts live in `e2e/`.

- `npm run test:e2e` — full run: starts vite on :5173 (reuses one already running), runs read-only smoke checks (`e2e/smoke.sh`), tears down. Exit code 0 = pass.
- Auth uses the login page's **dev sign-in bypass** (anonymous Firebase Auth, only rendered when `import.meta.env.DEV`) — no real WhatsApp OTP needed. It requires the Anonymous provider to be enabled in the Firebase project. The anonymous user has no profile doc and no roles, so the app runs in member view, read-only.
- To drive the browser manually (debugging a failing check): `agent-browser --session chitpay-e2e open http://localhost:5173/groups`, then `snapshot -i`, interact via refs. Always close with `agent-browser --session chitpay-e2e close`.
- **The dev server hits real production data** (see Firebase backend below). Smoke checks are strictly read-only; never add an e2e step that taps a button which triggers a callable mutation.

### Test users

| User | Sign-in | Roles | Use for |
|---|---|---|---|
| Anonymous dev user | "Dev sign-in (read-only)" button on `/login` (dev builds only) | none — no profile doc | read-only member-view smoke checks; uid changes every run |
| E2E Admin | password form on `/login`; phone, password, uid and synthetic email live in gitignored `e2e/.test-admin-notes` (+ `e2e/.test-admin-password`) — **never commit them** | `['admin','member']` | admin flows: create group, add members, cycles, payouts |

Provisioning/re-provisioning the test admin (needs Application Default Credentials — see below). Read the concrete values from `e2e/.test-admin-notes`; the snippets use placeholders:

```bash
npm run admin:create --prefix functions -- +<phone> "E2E Admin"   # creates/updates Auth user + users/{uid} with roles ['admin','member']
node -e "…getAuth().updateUser('<uid>', { password })…"  # set an 8-char password matching shared's generateMemberPassword format (XXXX-XXXX)
```

Password gotcha: the login form strips non-alphanumerics then re-formats, so it submits exactly `XXXX-XXXX` (8 chars). Longer or lowercase passwords fail as "Wrong number or password."

### agent-browser tips

- `find text` requires the exact accessible text ("Dev sign-in", not "Dev sign-in (read-only)" fails) and is unreliable — prefer `snapshot -i` → parse `ref=eN` → `click @eN` (two separate argv args, not one quoted string).
- Snapshot immediately after a cold launch can return "Loading…" or about:blank — always `wait --text '…'` before snapshotting, and retry once on empty output.
- The create-group date field is a native `input[type=date]` with invisible text; automation must set it via JS (`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set` + dispatch `input`/`change`), or click to open the native picker.

### Firebase CLI / ADC setup

`firebase-tools` is installed globally and logged in (`firebase login --no-localhost` flow). Application Default Credentials were derived from the CLI refresh token into `~/.config/gcloud/application_default_credentials.json` (authorized_user JSON using firebase-tools' public client id/secret from `lib/api.js`); Admin SDK scripts (`admin:create`, ad-hoc verification snippets) depend on this file. If provisioning fails with `invalid_client`, re-do the login + ADC derivation.

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

No CI is configured. Run `npm run typecheck` and `npm run test:shared`, plus `npm run lint --prefix app` if you touched `app/`. If you touched the app UI or routes, also run `npm run test:e2e`.
