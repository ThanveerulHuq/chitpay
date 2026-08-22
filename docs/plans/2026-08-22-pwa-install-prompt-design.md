# PWA Install Prompt Design

## Goal

Offer installation when an eligible user opens ChitPay without blocking normal app use or repeatedly nagging someone who declines.

## Experience

- Show a compact, dismissible bottom sheet only while the app is running in a browser.
- On Chromium browsers, wait for `beforeinstallprompt`, retain the event, and show an **Install** action. Trigger the browser-owned confirmation only after that action is tapped.
- On iPhone and iPad Safari, show **Share → Add to Home Screen** instructions because iOS does not expose a programmable native install prompt.
- Do not render the promotion when the app is already running in standalone mode.
- When **Not now** is selected, save a timestamp in local storage and suppress the promotion for seven days.
- Close the promotion after installation and clear the retained prompt after it has been used.

## Structure and data flow

- A root-level `InstallPrompt` component owns browser feature detection, event listeners, dismissal persistence, and the bottom-sheet UI.
- `App` renders the component once so it is available across public and authenticated routes.
- All visible text is defined in both English and Tamil dictionaries.
- The component reads local storage defensively so restricted storage cannot break the app.

## Verification

- Run the app TypeScript/build check and app lint.
- Run the repository typecheck and shared tests required by `AGENTS.md`.
- Manually validate Chromium prompting, seven-day dismissal, installed/standalone suppression, and iOS instruction detection when testing on real devices.
