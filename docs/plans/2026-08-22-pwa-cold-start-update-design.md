# PWA cold-start update design

## Goal

Load the newest deployed frontend automatically whenever ChitPay starts, without asking the user and without reloading an app that is already in use.

## Chosen behavior

- Check the service-worker registration once during each full document load or installed-PWA launch.
- Hold React rendering briefly while that startup check runs.
- If an updated worker is already waiting or finishes installing during the startup window, activate it and reload the document immediately.
- If no update is available, render the app normally.
- If the device is offline, the check fails, or the check exceeds a short timeout, render the currently cached app. An update discovered after that timeout remains waiting until the next cold start.
- Do not check periodically or when the app returns to the foreground. This guarantees that an update will not interrupt a form after the app has opened.

## Service-worker lifecycle

The generated Workbox worker will use prompt-style activation internally, but ChitPay will not show a prompt. Automatic `skipWaiting` and `clientsClaim` behavior must be disabled so a browser background update cannot take control during an active session.

Vite's automatic registration injection will also be disabled. A small startup module will own registration, update detection, activation, and the one-time reload. It will only send Workbox's `SKIP_WAITING` message when an existing worker already controls the page, so the first-ever service-worker installation does not cause an unnecessary reload.

## Cache policy

Firebase Hosting will require revalidation for the HTML shell, service worker, manifest, and other stable URLs. Vite's content-hashed files under `/assets/` will use a one-year immutable cache because a changed file receives a new URL.

Workbox's default outdated-precache cleanup remains enabled. Existing IndexedDB, local storage, authentication, and Firestore data are not cleared during an update.

## Failure handling

Update checks are best-effort and must never prevent offline startup. A timeout or registration error falls back to the current version without displaying an error. A worker that is discovered too late is left waiting safely for the following cold start.

## Verification

- Build the production PWA and verify that `sw.js` is generated without forced `skipWaiting`/`clientsClaim` activation.
- Run the repository typecheck and app lint.
- Run shared unit tests as required by the repository instructions.
