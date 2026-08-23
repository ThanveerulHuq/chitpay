# Group Workspace Back Navigation

## Goal

Give every routed group workspace screen one consistent back action in the sticky group header.

## Behavior

- Members, Cycles, and Reports return to the group list.
- A cycle detail returns to its group's Cycles tab.
- Member-preview state is retained through the existing `view=member` query parameter.
- Cycle detail's local back icon is removed so each screen shows only one back action.

## Verification

Typecheck the complete repository and lint the app after implementation.
