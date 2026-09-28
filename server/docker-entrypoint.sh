#!/bin/sh
set -e

# Database schema first: the server must never run against tables older than
# its code. `migrate deploy` only applies migrations not yet recorded, so it is
# a no-op on every start but the first after an upgrade. A failure (database
# unreachable, wrong DATABASE_URL) stops the container here, loudly.
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL absente de server/.env : voir DEPLOY.md" >&2
  exit 1
fi
npx --no-install prisma migrate deploy

# patchright drives Chrome in headed mode (see src/services/browserFetch.ts
# for why headless doesn't work against DataDome) — it needs a real display
# to render into even though nothing is ever meant to be looked at.
if [ "${LISTING_BROWSER_FALLBACK:-true}" != "false" ]; then
  Xvfb "$DISPLAY" -screen 0 1440x900x24 -nolisten tcp -nolisten unix &
  XVFB_PID=$!
  trap 'kill "$XVFB_PID" 2>/dev/null' EXIT
fi

exec "$@"
