# Remove Members “Selected” Filter

## Goal

Remove the filter dropdown from the admin members list so the toolbar contains only member search.

## Design

- Remove the `all | selected` filter state and dropdown UI from `GroupMembersPage`.
- Filter visible members only by the existing case-insensitive name search.
- Let the search input use the full toolbar width.
- Keep the “Selected” chip shown on member rows; it remains useful status information and is not part of the removed filter control.
- Do not change data fetching, member records, translations, or backend behavior.

## Verification

- Run the app typecheck and app lint.
- Confirm the members page no longer renders the filter dropdown and search still narrows the list.
