# Firestore-Native Admin Roles

## Goal

Make `users/{uid}.roles` the sole source of truth for application roles. Remove the `ADMIN_PHONES` environment allowlist and Firebase Auth custom-claim synchronization. Admins are provisioned manually with a trusted script run from the local workspace.

## Authorization model

Firestore user profiles store `roles: ('admin' | 'member')[]`. New users created through normal login flows receive only the `member` role. A user becomes an admin only when the trusted local provisioning script writes both `admin` and `member` to that profile.

All client Firestore writes remain denied. The web app may read its profile and use its roles for navigation and presentation, but it cannot promote a user. Backend callables independently authorize privileged mutations by reading the caller's `users/{uid}` document. Group-scoped mutations must also continue to require `group.adminUid === uid`.

Firebase Auth custom claims are not used for roles. This removes duplicate role state, token-refresh requirements, and the possibility of Firestore and claims drifting apart.

## Authentication flow

`ensureUser` continues to find or create the synthetic-email Firebase Auth user. When the Firestore profile does not exist, it creates one with an empty name, normalized phone number, `roles: ['member']`, and `createdAt`. It does not overwrite roles on an existing profile.

Login-link, OTP, and password sign-in flows no longer call `syncClaims`. Role changes become visible to the app through the Firestore profile and take effect on the next profile fetch or sign-in. The callable `syncClaims` is removed from the backend exports and client code.

## Backend checks

A shared asynchronous authorization helper reads `users/{uid}`, rejects unauthenticated callers, and requires the `admin` role. The helper may additionally receive a group and verify ownership. Existing privileged callables migrate from `req.auth.token.roles` checks to this helper.

Missing profiles, malformed role arrays, or absent admin roles fail closed with `permission_denied`. Authentication failures remain `unauthenticated`.

## Local provisioning script

The workspace provides a rerunnable script that accepts a phone number and name. It:

1. Normalizes and validates the phone number and validates the non-empty name.
2. Finds or creates the Firebase Auth user using the existing synthetic-email convention.
3. Creates or merges `users/{uid}` with the supplied name and phone.
4. Adds `admin` and `member` roles without discarding any recognized existing roles.
5. Reports the resulting UID and whether the Auth user/profile was created or updated.

The script uses trusted Firebase credentials and performs no function deployment. It must not print credentials. Re-running it for the same phone is safe.

## Configuration cleanup

Remove `ADMIN_PHONES` from local function environment files and all code/comments/documentation that describe it. No replacement environment variable is needed.

## Verification

Unit tests cover role parsing and authorization behavior where practical, including member rejection, missing-profile rejection, admin acceptance, and group-owner enforcement. Existing authentication tests verify that new users default to member and existing roles are preserved. Run the repository checks required by `AGENTS.md`: `npm run typecheck`, `npm run test:shared`, and `npm run lint --prefix app` when client code changes.

After deployment, provision the requested admin with the local script and verify the Auth user plus Firestore profile. No callable should depend on role custom claims or `ADMIN_PHONES`.
