# WhatsApp Login Link Design

## Goal

Replace the primary WhatsApp OTP login experience with a one-tap access link while retaining password login as a fallback.

## User flow

1. The user enters their Indian mobile number and requests an access link.
2. The backend finds or creates the phone-based Firebase user and creates a cryptographically random, single-use token that expires after 10 minutes.
3. Kwic sends the localized `login_link_en` or `login_link_ta` WhatsApp template. The body receives the named `name` variable, and the URL button receives the named `token` variable.
4. The button opens `https://chitapp.app/login/link/{{token}}`.
5. The app sends the token to the backend. The backend hashes it, consumes the matching Firestore record in a transaction, and returns a Firebase custom token.
6. The client signs in, refreshes role claims, removes the credential from browser history, and redirects to the user's groups.

Password login remains available from the login screen. Existing OTP callables remain temporarily available for rollback but are no longer used by the UI.

## Security and data model

- Generate 32 random bytes and encode them as base64url.
- Store only the SHA-256 hash in `loginLinks/{tokenHash}`.
- Store `uid`, `phone`, `createdAt`, `expiresAt`, and `lastSentAt`; never log or persist the raw token.
- Expire links after 10 minutes and reject expired or already-consumed links.
- Delete the link record transactionally before issuing the Firebase custom token, making the link single-use.
- Apply a 60-second per-phone send cooldown.
- Delete the newly created link record if the Kwic send fails.
- Treat the URL as an authentication credential regardless of the WhatsApp template category. Meta may independently reclassify the submitted template.

## Templates

English (`login_link_en`):

> Hi {{name}}, here's your access link for Chitpay.
>
> Tap the button below to see your group.

Tamil (`login_link_ta`):

> அன்புள்ள {{name}},
>
> இதோ ChitPay-க்கான உங்கள் அணுகல் இணைப்பு.
>
> உங்கள் குழுவைப் பார்க்க கீழே உள்ள பொத்தானைத் தட்டவும்.

Both templates use a dynamic URL button with base URL `https://chitapp.app/login/link/{{token}}`.

## Error handling

- Invalid, expired, and consumed links return the same user-facing failure state.
- Kwic delivery failures surface through the existing localized error mapping.
- A failed role refresh does not invalidate an otherwise successful sign-in.

## Verification

- Typecheck and build all packages.
- Run shared unit tests and the app linter.
- Exercise successful, expired, and reused-link behavior against the callable functions before production rollout.
