# ChitPay Display Brand Rename

## Goal

Rename every user-visible reference to ChitApp as ChitPay and use
`https://chitpay.web.app` as the public application URL.

## Scope

- Update the browser title, UI copy, WhatsApp templates, tests, comments, and
  product documentation where the old display brand appears.
- Replace public `https://chitapp.app` links with `https://chitpay.web.app`.
- Preserve compatibility-sensitive identifiers, including the
  `@chitapp/shared` package scope, `chitapp_*` browser storage keys,
  `@phone.chitapp.app` authentication aliases, Firebase project identifiers,
  and the repository directory name.

## Verification

- Search the repository for remaining ChitApp and old public-URL references and
  confirm that any matches are intentionally preserved internal identifiers.
- Run the repository typecheck and shared tests.
- Run the app linter because user-facing application files are changing.
