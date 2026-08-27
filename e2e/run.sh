#!/usr/bin/env bash
# E2E harness entry point: starts the dev server if needed, runs the
# agent-browser smoke checks, then tears everything down.
#
#   pnpm test:e2e          # full run (uses saved auth state if present)
#   pnpm e2e:login         # one-time interactive login bootstrap
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${E2E_PORT:-5173}"
URL="http://localhost:${PORT}"
VITE_PID=""

cleanup() {
  if [[ -n "$VITE_PID" ]]; then kill "$VITE_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

if curl -sf "$URL" >/dev/null 2>&1; then
  echo "e2e: reusing dev server already running at $URL"
else
  echo "e2e: starting vite on :$PORT ..."
  pnpm --filter app dev -- --port "$PORT" --strictPort >/tmp/chitpay-e2e-vite.log 2>&1 &
  VITE_PID=$!
  for _ in $(seq 1 120); do
    curl -sf "$URL" >/dev/null 2>&1 && break
    kill -0 "$VITE_PID" 2>/dev/null || { echo "e2e: vite exited:" >&2; tail -20 /tmp/chitpay-e2e-vite.log >&2; exit 1; }
    sleep 0.5
  done
  curl -sf "$URL" >/dev/null 2>&1 || { echo "e2e: vite did not become ready:" >&2; tail -20 /tmp/chitpay-e2e-vite.log >&2; exit 1; }
fi

STATUS=0
bash e2e/smoke.sh "$URL" || STATUS=$?
exit "$STATUS"
