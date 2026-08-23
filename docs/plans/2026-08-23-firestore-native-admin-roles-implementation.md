# Firestore-Native Admin Roles Implementation Plan

## 1. Make Firestore roles authoritative in authentication

- Update `functions/src/auth.ts` to remove `ADMIN_PHONES`, role claim writes, and `syncClaims`.
- Make newly created profiles default to `roles: ['member']`.
- Preserve existing profile roles when an existing user logs in.
- Add an asynchronous admin authorization helper that reads `users/{uid}` from Firestore and optionally uses the caller's active transaction.

## 2. Migrate privileged callable authorization

- Update `functions/src/groups.ts`, including `createGroup`, to use the Firestore-backed helper.
- Update transaction-based checks in `groups.ts`, `cycles.ts`, `selection.ts`, and `payout.ts` to pass the transaction so authorization is read before writes and participates in transaction retries.
- Update non-transaction checks in `cycles.ts` and `backfill.ts` to await the helper.
- Preserve group ownership checks in every group-scoped operation.

## 3. Remove client claim synchronization

- Remove `syncClaims` from `functions/src/index.ts`.
- Remove the client callable and forced token refresh from `app/src/lib/auth.ts`.
- Keep the existing profile-driven UI role handling in `app/src/lib/useAuth.ts`.

## 4. Add trusted local admin provisioning

- Add `functions/scripts/create-admin.mjs` using Firebase Admin and Application Default Credentials.
- Accept phone and name arguments, validate them, and use the synthetic-email convention.
- Create or reuse the Auth user, then merge the user profile with `admin` and `member` roles.
- Make the operation idempotent and report creation/update status without exposing credentials.
- Add an `admin:create` package command and concise usage documentation.

## 5. Clean configuration and verify

- Remove `ADMIN_PHONES` from the ignored local `functions/.env` and any tracked examples or documentation.
- Rebuild shared before functions if needed.
- Run `npm run typecheck`, `npm run test:shared`, and `npm run lint --prefix app`.
- Deploy the changed functions only after checks pass.
- Run the local provisioning script for `+919003711581`, name `Imthiyaz`, and verify the Auth user and Firestore profile.
