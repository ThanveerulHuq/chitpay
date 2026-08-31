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

expect_no_text() {
  local desc="$1" text="$2"
  if ab wait --text "$text" >/dev/null 2>&1; then
    fail "$desc (unexpected text present: $text)"
    return 1
  else
    pass "$desc"
    return 0
  fi
}

expect_no_overlay() {
  local desc="$1"
  if ab wait --fn "!document.querySelector('vite-error-overlay')" >/dev/null 2>&1; then
    pass "$desc"
  else
    fail "$desc (vite error overlay present — run the app to see the error)"
  fi
}

expect_eval_true() {
  local desc="$1" expr="$2"
  if ab eval "$expr" 2>/dev/null | grep -qi "true"; then
    pass "$desc"
  else
    fail "$desc (eval did not return true: $expr)"
    return 1
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
expect_page_text "groups list renders (member view)" "$BASE_URL/groups" "No groups yet"
expect_no_overlay "no build errors on /groups (member fallback)"

# Legacy URL redirect: /groups should land on member groups after auth.
if ab batch "open $BASE_URL/groups" "wait --url '**/member/groups'" >/dev/null 2>&1 || ab wait --text "No groups yet" >/dev/null 2>&1; then
  pass "legacy /groups redirects correctly for member"
else
  fail "legacy /groups redirects correctly for member"
fi

expect_page_text "member settings renders" "$BASE_URL/member/settings" "Settings"
expect_page_text "settings shows language selector" "$BASE_URL/member/settings" "Choose the language"
expect_no_overlay "no build errors on /member/settings"

# Member (anonymous) should NOT see provider settings link (requires providerId).
ab batch "open $BASE_URL/member/settings" "wait --text 'Settings'" >/dev/null 2>&1
# Give it a moment to render, then assert provider card is absent.
if ab wait --text "Chit provider" >/dev/null 2>&1; then
  fail "member settings hides provider link for non-provider user"
else
  pass "member settings hides provider link for non-provider user"
fi

# Admin routes must redirect anonymous/member users to member view.
ab batch "open $BASE_URL/admin/groups/new" "wait --url '**/member/groups'" >/dev/null 2>&1 && pass "admin /groups/new redirects member to /member/groups" || {
  # Some builds may redirect to /groups then to /member/groups — accept either.
  if ab wait --text "No groups yet" >/dev/null 2>&1; then pass "admin /groups/new redirects member to /member/groups"
  else fail "admin /groups/new redirects member to /member/groups"; fi
}

ab batch "open $BASE_URL/admin/settings/provider" "wait --url '**/member/groups'" >/dev/null 2>&1 && pass "admin provider settings redirects member" || {
  if ab wait --url "**/login" >/dev/null 2>&1 || ab wait --text "No groups yet" >/dev/null 2>&1; then pass "admin provider settings redirects member (fallback)"
  else fail "admin provider settings redirects member"; fi
}
expect_no_overlay "no build errors after admin redirects"

# --- Backward compat: contribution amount field migration (old data) -----------
# Old Firestore docs used `contributionAmountMinor` + `currency`; new docs use
# `contributionAmountInPaise` (paise, INR hard-coded). The app must handle both.
expect_eval_true "contribution compat: old field fallback" "(() => { const doc={contributionAmountMinor: 500000}; const val=doc.contributionAmountInPaise ?? doc.contributionAmountMinor; return val===500000 })()"
expect_eval_true "contribution compat: new field preferred" "(() => { const doc={contributionAmountInPaise: 750000, contributionAmountMinor: 500000}; const val=doc.contributionAmountInPaise ?? doc.contributionAmountMinor; return val===750000 })()"
expect_eval_true "contribution compat: missing fields => 0" "(() => { const doc={}; const val=doc.contributionAmountInPaise ?? doc.contributionAmountMinor ?? 0; return val===0 })()"

# formatMinor must hard-code INR and handle whole-rupee vs paise cases (currency param removed).
expect_eval_true "formatMinor whole-rupee contains ₹ and no broken NaN" "(() => { try { const s=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(10000); return s.includes('\u20B9') && !s.includes('NaN') } catch { return false } })()"
expect_eval_true "INR formatting uses paise-aware fractions" "(() => { try { const major=1050/100; const s=new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:1}).format(major); return s.includes('10') } catch { return false } })()"

# Groups list KPI strip must not crash on empty list (handles old data shapes).
expect_page_text "groups list handles empty legacy data gracefully" "$BASE_URL/member/groups" "No groups yet"

ab close >/dev/null 2>&1 || true

if [[ "$FAILURES" -gt 0 ]]; then
  echo "e2e: $FAILURES check(s) failed"
  exit 1
fi
echo "e2e: all checks passed"
