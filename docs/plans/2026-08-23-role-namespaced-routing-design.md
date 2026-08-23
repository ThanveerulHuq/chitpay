# Role-Namespaced Routing Design

## Goal

Give the admin and member experiences distinct URLs throughout the authenticated app. Make the URL the sole source of truth for the active experience so login landing, tab switching, deep links, and read-only behavior cannot disagree.

## Routes

Admin routes use `/admin`:

- `/admin/groups`
- `/admin/groups/new`
- `/admin/groups/:groupId/members`
- `/admin/groups/:groupId/cycles`
- `/admin/groups/:groupId/cycles/:cycleNumber`
- `/admin/groups/:groupId/reports`
- `/admin/settings`

Member routes mirror the read-only experience under `/member`, excluding group creation:

- `/member/groups`
- `/member/groups/:groupId/members`
- `/member/groups/:groupId/cycles`
- `/member/groups/:groupId/cycles/:cycleNumber`
- `/member/groups/:groupId/reports`
- `/member/settings`

## Navigation and Access

- `/` resolves authentication and sends admins to `/admin/groups`; other authenticated users go to `/member/groups`.
- Login flows return to `/` and let the role-aware landing choose the destination.
- The admin bottom navigation tabs link directly to `/admin/groups` and `/member/groups`.
- Non-admin users attempting an `/admin` route are redirected to `/member/groups`.
- Legacy `/groups` routes preserve their remaining path. A `view=member` query selects the member namespace; otherwise the authenticated user's role selects the namespace.
- Unknown authenticated routes use the same role-aware landing behavior.

## Rendering Model

- Shared list and workspace components remain shared.
- The `/admin` or `/member` path prefix determines which group collection the list displays and whether workspace controls are editable.
- Session storage, local storage, provider mode state, and `view=member` are removed from normal routing decisions.
- Admin-only actions are available only under `/admin`, even when the signed-in user has the admin role while browsing `/member`.

## Verification

- Verify role-aware login and root landing.
- Verify both bottom tabs and active state.
- Verify all list, create, workspace tab, cycle detail, report, settings, and back links stay within their namespace.
- Verify non-admin access to `/admin` redirects to `/member/groups`.
- Verify legacy list and deep links redirect correctly.
- Run the repository typecheck/build, shared tests, and app lint.
