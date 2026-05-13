# Architecture

## Snapshot architecture (why Vercel Blob, not a public VPS endpoint)

Production data lives on a private VPS that does outbound-only hourly writes:

```
[ VPS ] -- hourly POST --> [ Vercel Blob ] <-- edge fetch -- [ trendradar.jimibarkway.com ]
                              (snapshot.json)                 (Next.js, revalidate 5m)
```

There is no inbound traffic to the VPS. The Blob URL is public, edge-cached, and unsigned reads cost nothing. Snapshot updates touch one file - no cluster of CDN invalidations.

For local dev (and the docker-compose path), `web/public/snapshot.json` is the source of truth.

## Pipeline DAG

```
                ┌───────────────────────────────────────────┐
                │           SQLite events.db                 │
                │   raw_events  velocity_snapshots  clusters │
                │   opportunity_angles  (hidden_gems view)   │
                └───────────────────────────────────────────┘
                  ▲       ▲          ▲              ▲
                  │       │          │              │
       ingest/   score   cluster   angles      snapshot
       (7)       (Gemini  (Gemini  (Gemini     (writes
       hourly    Flash-   embed-   2.5 Pro,    snapshot.json
       /5m/12h   Lite)    004)     top 5)      + uploads to
                                               Vercel Blob)
```

Each step is independent and idempotent. A failed step never corrupts the DB.

## Scoring formulas

**Per-event composite**: `(niche × 5) + (velocity × 3) + (freshness × 2)`, capped 0-100.

**Velocity per source** (normalised to 0-10):

| Source | Metric |
|---|---|
| github_trending | `min(10, log(1 + stars_period) × 1.5)` |
| github_release | priority weight (high=8, med=5, low=3) |
| youtube_upload | `min(10, outlier_ratio × 1.5 + log(1 + views_per_hour) × 0.8)` |
| youtube_search | `min(10, log(1 + views_per_hour) × 1.5)` |
| reddit | tavily relevance × 10 |
| rss | priority weight (high=7, med=4, low=2) |
| x | `min(10, log(1 + likes + 2 × replies) × 1.2)` |

**Cluster score**: `max(member_composites) × ln(1 + member_count)`.

## Hidden-gem filter

A view, not a table - recomputed on every query, never stale.

```sql
CREATE VIEW hidden_gems AS
SELECT *, CASE ... END AS gem_reason FROM raw_events
WHERE composite_score >= 40
  AND (
    (source='github_trending' AND stars_total < 1000) OR
    (source='youtube_upload'  AND channel_median_views < 50000) OR
    (source='x'               AND likes < 500) OR
    (published_at > now() - 72h AND velocity_score >= 7)
  )
ORDER BY composite_score DESC;
```

## Costs at the chosen cadences

| Service | Cadence | Cost / mo |
|---|---|---|
| Gemini Flash-Lite scoring | 30 RPM free tier, paced 2.5s | £0 |
| Gemini embedding-004 | 100/day max | £0 |
| Gemini 2.5 Pro angles | 5/day | £0 (free tier) |
| Tavily search | ~240/mo | £0 |
| Apify twitter-scraper-lite | every 12h | ~£0.20 |
| YouTube Data API | <1k units/day | £0 |
| Vercel Hobby + Blob | 1GB blob, edge | £0 |
| VPS (existing) | n/a | £0 |
| **Total** | | **~£0.20** |
