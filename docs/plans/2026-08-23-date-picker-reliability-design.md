# Date Picker Reliability Design

## Problem

The create-group start-date control can receive focus without opening the browser's native date picker. The native WebKit picker indicator is visually hidden and replaced by a decorative icon, so relying on the browser's default indicator interaction is unreliable. If a user enters a partial or otherwise invalid date manually, the schedule preview calls the strict schedule generator during React rendering and crashes the page with `Invalid start date.`

## Design

- Keep the native `input[type="date"]` and the existing visual treatment.
- Explicitly request the native picker from a direct click anywhere on the date input when the browser supports `showPicker()`.
- Preserve manual entry, keyboard behavior, supplied click handlers, and native fallback behavior.
- Validate the ISO date before generating the schedule preview. Invalid or incomplete values render no preview; strict validation remains in the shared schedule generator and backend.

## Error Handling

Calling `showPicker()` is best-effort because browser support and input state vary. A failure falls back to the browser's ordinary date-input behavior. Invalid preview input is treated as incomplete form state rather than an application error.

## Verification

- Add shared tests for valid and invalid ISO dates.
- Run shared tests and the repository typecheck.
- Run the app linter.
- Exercise the create-group date field in a browser and confirm that clicking it opens the native picker and selecting a date renders a schedule without console errors.
