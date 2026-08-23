# Group Archival Design

## Goal

Allow admins to archive active or completed groups so they leave the main groups list while remaining fully reviewable. Archived groups are listed in Settings and become editable again only after an admin restores them.

## Data model and lifecycle

Use the existing `GroupStatus` value `archived`. Add optional archive metadata to `GroupDoc`:

- `statusBeforeArchive`: the prior `active` or `completed` status
- `archivedAt`: the server timestamp of the latest archive action
- `archivedBy`: the admin UID that performed it

Archiving changes `status` to `archived` and records the metadata in one Firestore transaction. Unarchiving restores `statusBeforeArchive` and removes the archive metadata. This preserves completed groups as completed instead of incorrectly making them active.

## Backend behavior

Add admin-only `archiveGroup` and `unarchiveGroup` callable functions and export them from the functions entry point. Both operations load and validate the group transactionally and report domain errors through `AppError` and `toHttpsError`.

All existing group mutation paths must reject archived groups on the server. A shared assertion will enforce this after group authorization in member, cycle, payment, selection, payout, reminder, and maintenance mutations. The archive and unarchive callables intentionally bypass this writable assertion after checking admin ownership, because restoration must remain possible.

## App behavior

The main Groups page excludes archived admin groups from cards and KPI totals. Member-facing memberships are unchanged.

Settings gains an admin-only Archived Groups section. It loads the signed-in admin's archived groups and shows useful summary information. Selecting a group opens its normal workspace, so the admin can review members, cycles, payments, and reports.

The group workspace treats an archived group as read-only regardless of admin role. It shows a clear archived banner and an Unarchive action. Non-archived admin workspaces provide an Archive action with confirmation. Archived routes and tabs remain accessible; all mutation controls are hidden or disabled through the existing read-only mechanism, while backend rejection provides the authoritative safeguard.

## Error handling

Archive attempts against an already archived group and restore attempts against a non-archived group return an invalid-transition domain error. A legacy archived document without `statusBeforeArchive` restores to `completed` when all configured cycles are finished, otherwise to `active`.

The UI shows localized error feedback when archive or restore fails and does not optimistically change group state.

## Localization and accessibility

Add matching English and Tamil dictionary entries for the archived list, status banner, confirmation, actions, empty state, and errors. Confirmation and action controls use native buttons and descriptive labels.

## Verification

- Add shared tests for archive-state restoration logic and writable-state validation.
- Run `npm run typecheck`.
- Run `npm run test:shared`.
- Run `npm run lint --prefix app`.
- Inspect the app flows for main-list filtering, Settings visibility, archived workspace navigation, read-only controls, and restoration.

No callable will be manually exercised against the configured Firebase project during local verification because this repository has no emulator and local calls would affect real data.
