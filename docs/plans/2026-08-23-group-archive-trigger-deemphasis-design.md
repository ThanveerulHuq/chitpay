# Group Archive Trigger De-emphasis Design

## Goal

Make the workspace Archive trigger as visually insignificant as practical while keeping the final destructive confirmation unmistakable.

## Design

Keep Archive at the bottom of the group workspace with ample separation from normal actions. Replace the full-width red button with a compact, centered ghost action using muted gray text and icon, no border, and no filled background. A subtle neutral hover state remains for discoverability.

Do not use danger color on the workspace trigger. The confirmation modal retains its danger icon, warning treatment, and solid danger confirmation button. Backend behavior, modal copy, routing, and archived-group behavior remain unchanged.

## Verification

- Run the app build/typecheck.
- Run app lint.
- Confirm the trigger contains no danger-color class and the modal confirmation still does.
