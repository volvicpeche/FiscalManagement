#!/bin/sh
# patchright drives Chrome in headed mode (see src/services/browserFetch.ts
# for why headless doesn't work against DataDome) — it needs a real display
# to render into even though nothing is ever meant to be looked at.
set -e

if [ "${LISTING_BROWSER_FALLBACK:-true}" != "false" ]; then
  Xvfb "$DISPLAY" -screen 0 1440x900x24 -nolisten tcp -nolisten unix &
  XVFB_PID=$!
  trap 'kill "$XVFB_PID" 2>/dev/null' EXIT
fi

exec "$@"
