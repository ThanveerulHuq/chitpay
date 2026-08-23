# Compact Cycle Actions Design

## Goal

Reduce description-heavy content on the active cycle page. Move willing-member selection into a focused searchable sheet and collapse cycle completion into a compact progress disclosure.

## Recipient Action

Before a recipient is selected, the cycle page shows one compact action row containing:

- a trophy icon;
- the label `Pick recipient`;
- the current eligible membership-slot count; and
- a chevron.

The full eligible list, pool description, willingness heading, and helper paragraph do not appear on the main page.

## Recipient Picker Sheet

Tapping the recipient action opens a bottom sheet consistent with the existing payment sheet. The sheet contains:

- a `Pick recipient` header and close action;
- a search field;
- searchable eligible membership slots with checkboxes;
- each slot's member name and slot number; and
- a sticky footer action.

Search filters visible rows without clearing checked membership slots. Closing the sheet clears its temporary search, willing-slot choices, and any unconfirmed result.

With no checked slots, the footer action is disabled. With one checked slot, its label is `Announce winner` and that slot becomes the proposed winner without randomness. With multiple checked slots, its label is `Pick randomly` and the existing secure picker chooses from only those slots.

The proposed winner is revealed and confirmed within the same sheet. This avoids stacking a second dialog above the picker. Cancelling the result returns to the searchable checklist with the current choices intact. Successful confirmation closes the sheet and refreshes the cycle.

Existing backend participant validation and audit behavior remain unchanged.

## Complete Cycle Disclosure

Replace the large completion card with a compact disclosure row containing:

- the label `Complete cycle`;
- progress such as `2 of 3 ready`; and
- a chevron indicating collapsed or expanded state.

The disclosure starts collapsed. Expanding it reveals the existing three checks and completion button. The button remains disabled until payments, recipient selection, and payout are all complete.

## Copy and Accessibility

Remove redundant helper descriptions from these two controls. Retain only labels, counts, names, and actionable state.

The sheet uses dialog semantics, body locking, a close label, scroll containment, a sticky footer, and safe-area padding. The disclosure exposes `aria-expanded` and keyboard-operable button behavior. Existing light and dark themes, radius conventions, and English and Tamil dictionaries are preserved.

## Verification

- Confirm search filters eligible slots and preserves hidden checks.
- Confirm closing and reopening clears temporary selection state.
- Confirm zero, one, and multiple willing-slot actions.
- Confirm the winner is revealed and confirmed within the same sheet.
- Confirm already-selected and otherwise ineligible slots remain absent.
- Confirm the completion disclosure starts collapsed and reports `0-3 of 3 ready` correctly.
- Confirm the completion button remains guarded by all three requirements.
- Run typecheck, shared tests, and app lint.
