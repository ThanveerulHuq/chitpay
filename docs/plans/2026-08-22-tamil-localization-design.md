# Tamil Localization Design

Date: 2026-08-22
Status: Approved

## Goal

Localize the entire ChitPay experience in Tamil alongside English:

- All app UI (login, groups list, create group, group dashboard, member view, shared UI primitives, offline banner)
- User-facing error messages
- The six WhatsApp message templates in `shared/src/templates.ts`

Decisions made during brainstorming:

- **Bilingual**: Tamil + English with an in-app toggle (not Tamil-only replacement).
- **Scope**: Everything including WhatsApp templates.
- **Preference storage**: Per-user in Firestore (`users/{uid}.language`), mirrored to localStorage for pre-auth render and cross-reload speed.
- **Default language**: English. Existing users and new users start in English; they opt into Tamil.

## Approach chosen

Custom typed dictionary + React Context (no i18n dependencies). Rejected react-i18next (heavy for ~200 simple strings, one alternate locale, loses compile-time key checking) and Lingui (build complexity, churn).

## Architecture

### Core module `app/src/i18n/`

- `types.ts` — `type Lang = 'en' | 'ta'`; `Dictionary` type derived from the English dictionary shape.
- `en.ts` — single source of truth: every UI string as a flat keyed object (e.g. `login.title`, `dash.markPaid`, `status.paid`).
- `ta.ts` — Tamil translations declared `satisfies Dictionary`; a missing key fails `npm run typecheck`.
- `context.tsx` — `I18nProvider` + `useT()` hook returning `t(key, params?)` with `{name}`-style interpolation.

Language resolution order: logged-in user's Firestore profile → localStorage cache → `'en'`.

### Preference & switching

- New field `users/{uid}.language: 'en' | 'ta'`, default `'en'`.
- Compact `EN | தமிழ்` toggle on the login screen and in the app header; switching writes Firestore + localStorage immediately.
- `index.html` `lang` attribute updates reactively when language changes.

### Fonts

Self-hosted subsetted **Noto Sans Tamil** webfont, loaded with `unicode-range` so it only applies to Tamil glyphs; English rendering unchanged.

## String coverage

1. **App UI** — all JSX literals move to the dictionary: LoginPage (~25 strings), GroupsListPage, CreateGroupPage, GroupDashboardPage (~90 strings), MemberGroupView, `components/ui.tsx` (labels, aria-labels, placeholders), OfflineBanner. Duplicated words (`Paid`, `Pending`, `Month`, `Members`) get single shared keys.
2. **Errors** — `shared/src/errors.ts`: `MESSAGES` becomes per-language (`Record<Lang, Record<AppErrorCode, string>>`) with `userMessage(code, lang)`. LoginPage's local `errMessage()` routes through the same maps. Functions keep throwing codes only; clients render localized prose.
3. **WhatsApp templates** — `shared/src/templates.ts`: `renderMessage(id, params, lang)` with `en` and `ta` template sets. On send, functions look up the **recipient's** `users/{uid}.language` (fallback: sender's language, then `'en'`).
4. **Formatting** — month names/dates via `Intl.DateTimeFormat('ta-IN' | 'en-IN')`. Currency stays `₹` with Western digits (standard Tamil usage).

## Testing

- `npm run typecheck` enforces complete Tamil dictionary.
- Shared unit tests cover `renderMessage(id, params, lang)` and `userMessage(code, lang)` in both languages.
- Existing e2e suite passes unchanged (English remains default); add one Tamil-path e2e: toggle language → key screens render Tamil.
- Manual smoke test in Tamil on login + dashboard; watch for layout breakage from longer Tamil strings (~15–30% longer); use flexible widths where needed.

## Rollout order

1. i18n core module
2. Dictionary extraction screen-by-screen (English behaviour preserved at each step)
3. Error-code localization
4. WhatsApp template localization + recipient-language lookup in functions
5. Noto Sans Tamil font + language toggle UI
6. Tests (unit + Tamil e2e path)

## Out of scope

- A dedicated settings page (header/login toggle is enough)
- Languages beyond `en` / `ta`
- Translating PRD/docs
