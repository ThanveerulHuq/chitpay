# Group Archival UI Revision Design

## Goal

Make group archival clearly destructive and move archived-group browsing out of the main Settings screen.

## Workspace behavior

For active and completed admin groups, remove the existing archive card and its description. Show a full-width danger-colored **Archive group** button after the workspace page content.

Selecting Archive opens an in-app confirmation modal. The modal explains that the group will become read-only until restored and provides Cancel and danger-colored Archive actions. The archive request runs only after confirmation. Errors remain visible near the archive action.

Archived groups retain the existing read-only notice and Unarchive action. Unarchive is not styled as destructive and does not move to the bottom action area.

## Settings and routing

Settings contains one admin-only **Archived groups** navigation row instead of loading and rendering archived group cards inline.

Add an admin-only `/settings/archived-groups` route. The page loads the signed-in admin's groups, filters archived groups, and renders the existing member/cycle summary for each. Selecting a group switches to admin view and opens the full read-only group workspace.

The page includes loading, empty, and load-error states. Its back action returns to Settings.

## Localization and accessibility

Update the English and Tamil dictionaries for the dedicated page, Settings link, archive modal title/body, and modal actions. Remove the unused archive-card description copy.

The modal uses `role="dialog"`, `aria-modal="true"`, a visible title, backdrop dismissal, and explicit Cancel/Archive buttons. The danger styling is limited to the destructive archive actions.

## Verification

- Run `npm run typecheck` after rebuilding `shared` if needed.
- Run `npm run test:shared`.
- Run `npm run lint --prefix app`.
- Confirm that Settings contains only the archived-groups link, the list has its own route, Archive is at the workspace bottom, and archival requires the modal confirmation.
