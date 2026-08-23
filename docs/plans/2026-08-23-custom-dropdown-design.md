# Custom Dropdown Design

## Goal

Replace every native HTML select menu in the app with one reusable, app-styled dropdown so menus remain visually consistent across macOS, iOS, Android, and installed PWA contexts.

## Scope

Replace native dropdowns used for:

- group frequency;
- member filtering;
- report payment-status filtering;
- report cycle filtering;
- report payment-method filtering; and
- payment-correction method selection.

Date inputs are outside this change.

## Component

Add a typed `Dropdown` component to `app/src/components/ui.tsx`.

```ts
interface DropdownOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

interface DropdownProps<T extends string> {
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
  disabled?: boolean
  compact?: boolean
  className?: string
}
```

The closed control is a button styled with the existing input surface, border, radius, text, and focus tokens. A chevron indicates that it opens a menu.

The open menu:

- floats directly below the control;
- uses the app's surface, border, shadow, radius, and typography tokens;
- stays within the control/page width;
- shows a checkmark beside the selected option;
- highlights keyboard focus separately from selection; and
- layers above adjacent form content.

## Interaction and accessibility

- The trigger uses `aria-haspopup="listbox"`, `aria-expanded`, and `aria-controls`.
- The menu uses `role="listbox"`; entries use `role="option"` and `aria-selected`.
- Enter, Space, or Arrow Down opens the menu.
- Arrow Up/Down moves active focus and wraps across enabled options.
- Home/End moves to the first/last enabled option.
- Enter or Space chooses the active option.
- Escape closes without changing the value and returns focus to the trigger.
- Clicking outside closes without changing the value.
- Choosing an option closes the menu and returns focus to the trigger.
- Disabled controls and options cannot be activated.

## Data flow

Each page continues to own its current state. The dropdown receives the current value and an option array, then returns only the selected value through `onChange`. No filter, form submission, or API behavior changes.

Dynamic report cycle options are derived exactly as they are today and passed to the component as typed option objects.

## Verification

- Confirm there are no `<select>` elements or imports of the old `Select` wrapper under `app/src`.
- Exercise mouse/touch selection and keyboard navigation.
- Confirm long Tamil labels wrap or truncate without escaping the menu.
- Run app typecheck/build and lint.
- Run `git diff --check`.
