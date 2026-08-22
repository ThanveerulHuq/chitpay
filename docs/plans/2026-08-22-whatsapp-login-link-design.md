# WhatsApp Login Link Design

## Goal

Replace the primary WhatsApp OTP login experience with a one-tap access link while retaining password login as a fallback.

## User flow

1. The user enters their Indian mobile number and requests an access link.
2. The backend finds or creates the phone-based Firebase user and asks Firebase Authentication to generate a native email sign-in action link for the user's existing synthetic email address.
3. The Firebase link is base64url-encoded for safe transport as a WhatsApp dynamic URL suffix. Kwic sends the localized `login_link_en` or `login_link_ta` template with the named `name` and `firebase_sign_in_link` variables.
4. The button opens `https://chitapp.app/login/link/{{firebase_sign_in_link}}`.
5. The app decodes the Firebase action link and completes it with `signInWithEmailLink`. The synthetic email saved on the requesting device is used to prevent session injection. If the link opens on another device, the user must re-enter the associated phone number.
6. The client refreshes role claims, replaces the credential-bearing history entry, and redirects to the user's groups.

Password login remains available from the login screen. Existing OTP callables remain temporarily available for rollback but are no longer used by the UI.

## Security and data model

- Firebase Authentication generates, expires, and consumes the one-time sign-in action code.
- ChitPay does not generate, hash, persist, or verify login tokens.
- The Firebase link is encoded only for URL-safe transport; encoding is not treated as encryption.
- The synthetic email is stored locally on the requesting device and is not embedded in the WhatsApp URL.
- When local state is unavailable, the user re-enters the phone number so the app can derive the matching synthetic email.
- Apply a 60-second per-phone send cooldown.
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

Both templates use a dynamic URL button with base URL `https://chitapp.app/login/link/{{firebase_sign_in_link}}`.

## Error handling

- Invalid, expired, and consumed Firebase links return the same user-facing failure state.
- Kwic delivery failures surface through the existing localized error mapping.
- A failed role refresh does not invalidate an otherwise successful sign-in.

## Verification

- Typecheck and build all packages.
- Run shared unit tests and the app linter.
- Exercise successful, expired, reused, and cross-device link behavior before production rollout.
