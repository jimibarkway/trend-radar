-- Trend Radar SQLite schema.
-- One DB at <repo_root>/data/events.db (override via TREND_RADAR_ROOT env).

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- One row per ingested signal across all sources.
CREATE TABLE IF NOT EXISTS raw_events (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL,
  source_subtype  TEXT,
  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  body_excerpt    TEXT,
  author          TEXT,
  ingested_at     TEXT NOT NULL,
  published_at    TEXT,
  engagement_raw  TEXT,
  niche_score     REAL,
  velocity_score  REAL,
  freshness_score REAL,
  composite_score REAL,
  cluster_id      TEXT,
  status          TEXT DEFAULT 'new'
);
CREATE INDEX IF NOT EXISTS idx_events_status_score ON raw_events(status, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_events_published_at ON raw_events(published_at);
CREATE INDEX IF NOT EXISTS idx_events_cluster ON raw_events(cluster_id);
CREATE INDEX IF NOT EXISTS idx_events_source ON raw_events(source);

-- Convergence clusters - groups of raw_events covering the same topic.
CREATE TABLE IF NOT EXISTS clusters (
  id              TEXT PRIMARY KEY,
  centroid_title  TEXT NOT NULL,
  member_count    INTEGER NOT NULL,
  source_count    INTEGER NOT NULL,
  sources         TEXT NOT NULL,           -- JSON array of distinct source names
  max_composite   REAL NOT NULL,
  cluster_score   REAL NOT NULL,           -- max_composite * ln(1 + member_count)
  first_seen      TEXT NOT NULL,
  last_seen       TEXT NOT NULL,
  computed_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cluster_score ON clusters(cluster_score DESC);

-- Per-source velocity snapshots (filled by velocity.py + read by score.py).
CREATE TABLE IF NOT EXISTS velocity_snapshots (
  event_id      TEXT PRIMARY KEY,
  computed_at   TEXT NOT NULL,
  velocity      REAL NOT NULL,             -- 0-10
  metric_used   TEXT NOT NULL,             -- "stars_per_day" | "views_per_hour" | "upvotes_per_hour" | etc
  raw_value     REAL,                      -- the underlying number for transparency
  FOREIGN KEY (event_id) REFERENCES raw_events(id)
);

-- Angle generation outputs (one row per opportunity, written by generate_angles.py).
CREATE TABLE IF NOT EXISTS opportunity_angles (
  event_id       TEXT PRIMARY KEY,
  primary_title  TEXT NOT NULL,
  alt_titles     TEXT NOT NULL,             -- JSON array
  hook_first_2_sentences TEXT NOT NULL,
  outline_30s    TEXT NOT NULL,             -- JSON array of 4-6 beats
  generated_at   TEXT NOT NULL,
  model          TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES raw_events(id)
);

-- Hidden-gem view: genuinely small-but-fast-moving signals (the value prop).
--
-- Design rules, each learned from a real mislabelling bug:
--  1. "small" conditions require the metric > 0. A 0/NULL means the ingest
--     failed to capture the count - it must NOT count as "small" (that once
--     mislabelled a 96k-star repo as "under 1k stars").
--  2. Each source is a gem via EXACTLY ONE path:
--       - github_trending  -> small_repo    (genuine star count < 1k)
--       - youtube_upload   -> small_channel (genuine subscriber count < 50k)
--       - x                -> small_account (low like count)
--       - youtube_search / reddit / rss -> fresh_fast (no "small entity"
--         metric available for these, so fresh + high velocity is the
--         gem signal)
--       - github_release   -> never a gem (releases are from big canonical
--         repos by definition)
--     A source with a "small entity" test is NEVER a gem via fresh_fast -
--     otherwise a 740k-sub channel's fresh video, or a 96k-star repo,
--     would land in the hidden-gems feed. "Hidden" means small.
DROP VIEW IF EXISTS hidden_gems;
CREATE VIEW hidden_gems AS
SELECT
  e.*,
  CASE
    WHEN e.source = 'github_trending' AND
         CAST(json_extract(e.engagement_raw, '$.stars_total') AS INTEGER) BETWEEN 1 AND 999
         THEN 'small_repo'
    WHEN e.source = 'youtube_upload' AND
         CAST(json_extract(e.engagement_raw, '$.channel_subscriber_count') AS INTEGER) BETWEEN 1 AND 49999
         THEN 'small_channel'
    WHEN e.source = 'x' AND
         CAST(json_extract(e.engagement_raw, '$.likes') AS INTEGER) BETWEEN 1 AND 499
         THEN 'small_account'
    WHEN e.source IN ('youtube_search', 'reddit', 'rss')
         AND e.published_at > datetime('now', '-72 hours')
         AND e.velocity_score >= 7
         THEN 'fresh_fast'
    ELSE NULL
  END AS gem_reason
FROM raw_events e
WHERE e.composite_score IS NOT NULL
  AND e.composite_score >= 40
  AND (
    (e.source = 'github_trending' AND
     CAST(json_extract(e.engagement_raw, '$.stars_total') AS INTEGER) BETWEEN 1 AND 999)
    OR
    (e.source = 'youtube_upload' AND
     CAST(json_extract(e.engagement_raw, '$.channel_subscriber_count') AS INTEGER) BETWEEN 1 AND 49999)
    OR
    (e.source = 'x' AND
     CAST(json_extract(e.engagement_raw, '$.likes') AS INTEGER) BETWEEN 1 AND 499)
    OR
    (e.source IN ('youtube_search', 'reddit', 'rss')
     AND e.published_at > datetime('now', '-72 hours')
     AND e.velocity_score >= 7)
  )
ORDER BY e.composite_score DESC;
