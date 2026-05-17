#!/usr/bin/env bash
# Hourly pipeline run: ingest cheap sources, score new events, cluster,
# export snapshot, upload to Vercel Blob.
#
# Cron: 0 * * * * /root/trend-radar-comp/scripts/run_hourly.sh

set -eu

cd "$(dirname "$0")/.."
export TREND_RADAR_ROOT="$(pwd)"

# Load env. .env has the API keys; .env.local has BLOB_READ_WRITE_TOKEN
# (auto-dropped there by `vercel env pull`). Merge both.
set -a
[[ -f ./.env ]] && . ./.env
[[ -f ./.env.local ]] && . ./.env.local
set +a

LOG="$TREND_RADAR_ROOT/logs/pipeline.log"
mkdir -p "$(dirname "$LOG")"
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
say() { echo "[$(ts)] $*" >> "$LOG"; }

say "=== hourly run start ==="

# Cheap ingest sources (no paid API calls)
for mod in rss_feeds github_releases github_trending youtube_uploads youtube_searches reddit_native hackernews polymarket bluesky; do
  if python3 -m "pipeline.scripts.ingest.$mod" >> "$LOG" 2>&1; then
    say "  ✓ $mod"
  else
    say "  ✗ $mod failed (exit $?)"
  fi
done

# Score new events
if python3 -m pipeline.scripts.score >> "$LOG" 2>&1; then
  say "  ✓ score"
else
  say "  ✗ score failed (exit $?)"
fi

# Validate YouTube links - mark videos that have gone private/deleted so a
# dead link never sits on the dashboard
if python3 -m pipeline.scripts.validate_links >> "$LOG" 2>&1; then
  say "  ✓ validate_links"
else
  say "  ✗ validate_links failed (exit $?)"
fi

# Re-cluster the last 96h window
if python3 -m pipeline.scripts.cluster --window-hours 96 >> "$LOG" 2>&1; then
  say "  ✓ cluster"
else
  say "  ✗ cluster failed (exit $?)"
fi

# Export snapshot (writes web/public/snapshot.json + uploads to Blob)
if python3 -m pipeline.scripts.export_snapshot >> "$LOG" 2>&1; then
  say "  ✓ snapshot exported"
else
  say "  ✗ export failed (exit $?)"
fi

# Upload to Vercel Blob via CLI (more reliable than the Python urllib PUT)
if [[ -n "${BLOB_READ_WRITE_TOKEN:-}" ]] && command -v vercel >/dev/null; then
  if vercel blob put web/public/snapshot.json \
    --access public \
    --pathname snapshot.json \
    --allow-overwrite=true \
    --cache-control-max-age 60 \
    --token "$BLOB_READ_WRITE_TOKEN" \
    >> "$LOG" 2>&1; then
    say "  ✓ Blob uploaded"
  else
    say "  ✗ Blob upload failed (exit $?)"
  fi
fi

say "=== hourly run done ==="
