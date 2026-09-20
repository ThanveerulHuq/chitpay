# Schema v2 migration runbook

This migration renames the contribution field, removes stored currency, moves payment events and selections to the group level, moves message history to users, and backfills `lastLoginAt` from Firebase Auth. Commands use production Application Default Credentials and must not be run from tests.

1. Preview without writes:
   `pnpm --filter chitapp-functions schema:migrate -- --dry-run`
2. Copy canonical fields and documents while retaining all legacy data:
   `pnpm --filter chitapp-functions schema:migrate -- --apply`
3. Deploy the application and functions release that reads and writes schema v2.
4. Immediately rerun `--apply` to catch writes made by the previous release during deployment.
5. Verify that every required copy exists:
   `pnpm --filter chitapp-functions schema:migrate -- --verify`
6. After the new release is stable, delete legacy amount/currency fields, nested payment events, global selections, and group message logs:
   `pnpm --filter chitapp-functions schema:migrate -- --cleanup`
7. Run `--verify` once more.

`--apply` and `--verify` are idempotent. `--cleanup` refuses to run when verification finds a missing copy. Unresolvable legacy messages stop the migration and must be investigated rather than silently discarded.
