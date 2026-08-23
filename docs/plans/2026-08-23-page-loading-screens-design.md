# Page Loading Screens Design

## Goal

Give every route a loading state that resembles its final layout, so authentication and Firestore waits feel responsive and do not cause large layout shifts.

## Approach

Create reusable, page-specific skeleton screens for the login, groups list, group detail, payments, create-group, and settings layouts. Route guards select the skeleton for the destination route while authentication resolves. Data-driven pages reuse the same skeleton while their own requests are pending.

Synchronous pages will not receive artificial delays. Their skeleton is visible only when the route is genuinely waiting for authentication or data.

## Components and behavior

- Keep the existing `Skeleton` primitive and add composed loading-screen components near the shared UI layer.
- Preserve each page's header, content width, cards, forms, and navigation spacing.
- Use the current theme tokens so loaders work in light and dark modes.
- Hide decorative skeleton shapes from assistive technology while exposing one localized loading status for the screen.
- Replace the auth guards' plain ellipsis with the skeleton that matches the current route.
- Replace duplicated inline data-loading layouts with the corresponding shared screen.
- Keep login-link verification's purposeful status UI; it communicates an operation rather than initial page loading.

## Verification

Run the repository typecheck and shared tests, plus the app linter. Confirm every route maps to the expected loading screen and no loading state changes navigation or data behavior.
