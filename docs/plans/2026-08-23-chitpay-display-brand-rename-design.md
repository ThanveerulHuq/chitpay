# ChitPay Display Brand Rename

## Goal

Use ChitPay consistently as the user-visible product name and use
`https://chitpay.web.app` as the public application URL.

## Scope

- Update the browser title, UI copy, WhatsApp templates, tests, comments, and
  product documentation where the old display brand appears.
- Use `https://chitpay.web.app` for public application links.
- Preserve compatibility-sensitive identifiers, including the
  `@chitapp/shared` package scope, `chitapp_*` browser storage keys,
  `@phone.chitapp.app` authentication aliases, Firebase project identifiers,
  and the repository directory name.

## Verification

- Search the repository for stale display-brand and public-URL references and
  confirm that any matches are intentionally preserved internal identifiers.
- Run the repository typecheck and shared tests.
- Run the app linter because user-facing application files are changing.
