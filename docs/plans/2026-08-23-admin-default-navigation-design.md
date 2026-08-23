# Admin Default Navigation Design

## Goal

Make an admin start in the admin groups view after a new login or a later app session, while preserving an explicit switch to member view during the current session. Make both bottom navigation tabs return to the groups list for the selected view.

## Design

- Keep view mode in the existing `ViewModeProvider` so every authenticated page shares one source of truth.
- Replace persistent `localStorage` mode storage with session-scoped storage. Initialize admins to `admin` when the session has no saved choice; non-admin users always use `member`.
- Reset the session choice after a successful login so an admin always enters through the admin groups view.
- When an admin selects either bottom navigation tab, update the mode and navigate to `/groups`. The groups list already filters entries using the selected mode.
- Preserve existing authorization guards and member-only behavior.

## Data Flow

1. Authentication resolves the user's roles.
2. `ViewModeProvider` exposes `admin` by default for an admin with no current-session choice and `member` for everyone else.
3. Selecting a bottom tab saves the session choice and routes to `/groups`.
4. `GroupsListPage` filters admin-owned groups or member memberships using the active mode.

## Verification

- An admin with no session choice sees admin groups.
- Switching to member view works throughout the current session and survives a refresh.
- A successful new login clears the previous choice and starts the admin in admin view.
- Both Admin and Member tabs route from group details or settings to `/groups` in the selected mode.
- A non-admin remains in member view.
- App typecheck and lint pass.
