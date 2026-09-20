# Provider migration runbook

The provider migration is deliberately separate from deployment. All commands run against the production `chitpay` Firestore database and require Application Default Credentials.

1. Deploy the compatibility release containing provider-aware functions and UI.
2. Preview without writes:
   `pnpm --filter chitapp-functions provider:migrate -- --dry-run`
3. Resolve every reported preflight problem, then migrate:
   `pnpm --filter chitapp-functions provider:migrate -- --apply`
4. Verify that every group has a valid provider with at least one consistent admin:
   `pnpm --filter chitapp-functions provider:migrate -- --verify`
5. After clients have received the compatibility release, remove legacy `adminUid` fields:
   `pnpm --filter chitapp-functions provider:migrate -- --cleanup`
6. In a later code release, remove the documented legacy fallbacks from `GroupDoc`, backend authorization, and `fetchMyGroups`.

Create a brand-new provider only through the trusted local provisioning command:
`pnpm --filter chitapp-functions provider:create -- +919000000000 "Admin name" "Provider name"`

Do not run migration or provisioning commands from automated tests. The repository has no Firebase emulator and these commands mutate production data.
