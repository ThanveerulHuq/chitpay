#!/usr/bin/env bash
# Browser smoke checks against a running dev server. Read-only by design:
# the app talks to the deployed chitpay Firebase project, so these checks
# must never mutate data. Auth uses the login page's dev-only anonymous
# sign-in button (import.meta.env.DEV builds only).
#
#   bash e2e/smoke.sh [base-url]
set -uo pipefail

BASE_URL="${1:-${E2E_URL:-http://localhost:5173}}"
SESSION="${E2E_SESSION:-chitpay-e2e}"

ab() { agent-browser --session "$SESSION" "$@"; }

FAILURES=0
pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAILURES=$((FAILURES + 1)); }

# Loads a URL and waits for text to appear. Retries: cold browser launches
# can race first render (PWA service-worker reloads, Firebase init).
expect_page_text() {
  local desc="$1" url="$2" text="$3" attempt
  for attempt in 1 2 3; do
    ab batch "open $url" "wait --text '$text'" >/dev/null 2>&1 && {
      pass "$desc"
      return 0
    }
    sleep 2
  done
  fail "$desc (missing text: $text)"
  return 1
}

expect_no_overlay() {
  local desc="$1"
  if ab wait --fn "!document.querySelector('vite-error-overlay')" >/dev/null 2>&1; then
    pass "$desc"
  else
    fail "$desc (vite error overlay present — run the app to see the error)"
  fi
}

echo "e2e: smoke against $BASE_URL (session: $SESSION)"

# Fresh session every run.
ab close >/dev/null 2>&1 || true

# --- Public: login page renders -------------------------------------------
expect_page_text "login page renders" "$BASE_URL/login" "Mobile number"
expect_no_overlay "no build errors on /login"

# --- Dev sign-in bypass -> authenticated pages ------------------------------
click_dev_sign_in() {
  local snap ref
  for attempt in 1 2 3; do
    snap="$(ab batch "open $BASE_URL/login" "wait --text 'Dev sign-in'" "snapshot -i" 2>/dev/null || true)"
    ref="$(printf '%s' "$snap" | grep -o 'Dev sign-in[^[]*\[ref=[^]]*\]' | grep -o 'ref=[^]]*' | cut -d= -f2)"
    if [[ -n "$ref" ]] && ab click "@$ref" >/dev/null 2>&1 && ab wait --url "**/groups" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if click_dev_sign_in; then
  pass "dev sign-in reaches /groups"
else
  fail "dev sign-in reaches /groups (is anonymous auth enabled in the Firebase project?)"
fi

# Anonymous dev user has no profile/roles -> member view with an empty list.
expect_page_text "groups list renders" "$BASE_URL/groups" "No groups yet"
expect_no_overlay "no build errors on /groups"

expect_page_text "settings page renders" "$BASE_URL/settings" "Settings"

ab close >/dev/null 2>&1 || true

if [[ "$FAILURES" -gt 0 ]]; then
  echo "e2e: $FAILURES check(s) failed"
  exit 1
fi
echo "e2e: all checks passed"
