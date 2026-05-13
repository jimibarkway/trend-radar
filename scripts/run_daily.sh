#!/usr/bin/env bash
# Daily pipeline run: regenerate angles for top opportunities + run X/Apify
# ingest (paid, cadence: 12h).
#
# Cron: 30 2,14 * * * /root/trend-radar-comp/scripts/run_daily.sh

set -eu

cd "$(dirname "$0")/.."
export TREND_RADAR_ROOT="$(pwd)"

set -a
[[ -f ./.env ]] && . ./.env
[[ -f ./.env.local ]] && . ./.env.local
set +a

LOG="$TREND_RADAR_ROOT/logs/pipeline.log"
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
say() { echo "[$(ts)] $*" >> "$LOG"; }

say "=== daily run start ==="

# X / Twitter via Apify (only if APIFY_TOKEN is set)
if [[ -n "${APIFY_TOKEN:-}" ]]; then
  if python3 -m pipeline.scripts.ingest.x_apify >> "$LOG" 2>&1; then
    say "  ✓ x_apify"
  else
    say "  ✗ x_apify failed (exit $?)"
  fi
else
  say "  (skipping x_apify - no APIFY_TOKEN)"
fi

# Regenerate angles for top 5 opportunities (skip events that already have angles)
if python3 -m pipeline.scripts.generate_angles --top 5 >> "$LOG" 2>&1; then
  say "  ✓ generate_angles"
else
  say "  ✗ generate_angles failed (exit $?)"
fi

# Final snapshot + upload (the hourly job will also do this, but this picks
# up the new angles immediately)
python3 -m pipeline.scripts.export_snapshot >> "$LOG" 2>&1 || true

if [[ -n "${BLOB_READ_WRITE_TOKEN:-}" ]] && command -v vercel >/dev/null; then
  vercel blob put web/public/snapshot.json \
    --access public \
    --pathname snapshot.json \
    --allow-overwrite=true \
    --cache-control-max-age 60 \
    --token "$BLOB_READ_WRITE_TOKEN" \
    >> "$LOG" 2>&1 || true
  say "  ✓ Blob refreshed"
fi

say "=== daily run done ==="
