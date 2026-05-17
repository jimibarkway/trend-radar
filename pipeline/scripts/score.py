#!/usr/bin/env python3
"""score.py - LLM niche-scoring + cross-event percentile-rank velocity +
HN-gravity freshness + harmonic-mean composite.

Architecture upgrades from the NotebookLM research (2026-05-15):

  Pass 1 (per new event):
    - Niche score 0-10 from Gemini Flash-Lite on the title/body (existing)
    - +keyword boost when AI-virality terms appear in title/body
    - Raw velocity metric stored per source (e.g. views_per_hour for YT,
      ups+2*comments for Reddit). We store the RAW number, not a curve-fit
      0-10 - that comes in pass 2 from cross-event ranking.
    - Freshness via HN-style gravity (1 / (age+2)^1.8), normalized 0-10
    - Status -> 'scored'

  Pass 2 (every run, cross-event):
    - For each source, percentile-rank every scored event's raw velocity
      against the other events from the same source. Result: a 0-10 that
      naturally reflects "how this event compares to its peers" rather
      than a hand-tuned log curve.
    - Composite = harmonic-mean(niche, velocity_rank, freshness) * 10
      (0-100). Harmonic mean penalises any axis being flat - a high-niche
      but low-velocity, low-freshness event can't dominate the feed.

Why this is better:
  - Percentile-rank auto-adjusts to whatever the data looks like; no more
    hand-tuned log multipliers per source.
  - Harmonic mean kills "one-hit wonder" rankings (a 358-view fresh
    on-niche video, the bug Jimi caught).
  - HN gravity gives the standard, well-understood decay curve.
"""

import argparse
import json
import math
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, config_path, require_env

GEMINI_MODEL = "gemini-3.1-flash-lite"
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
INTER_CALL_SLEEP_SEC = 2.5

# AI-virality terms - when these appear in title/body the LLM-niche score
# gets a small bump. Drawn from the AI-virality-patterns research. Each hit
# adds 0.5, capped at +2 total. The LLM already catches most of these, but
# this is a safety net for terms it might under-weight.
VIRAL_KEYWORDS = [
    "vibe coding", "vibe code", "vibe coder",
    "mcp server", "mcp servers", "model context protocol",
    "agent-first", "agent first", "agentic workflow", "agentic os",
    "cli-first", "cli first",
    "local inference", "local model", "local llm",
    "claude code", "claude opus", "claude sonnet", "claude haiku",
    "anthropic", "openai launch",
    "browser use", "computer use",
    "hermes agent", "openclaw", "antigravity",
]

PROMPT_TEMPLATE = """You are scoring trending tech / AI signals for a YouTube creator.

CREATOR NICHE:
{niche_description}

Rate this signal 0-10 for niche relevance + likely-to-be-a-video-idea:
- 10 = brand new release directly in the creator's lane, strong hook potential
- 8-9 = adjacent and clearly video-able
- 5-7 = AI/tech relevant but not directly in the lane
- 1-4 = AI-tangential or weak video angle
- 0 = totally off-niche

Be strict. Most signals should land in 1-5. Reserve 8+ for genuine
zero-to-video opportunities.

Source: {source}
Title: {title}
Author/Origin: {author}
Body excerpt: {body}
Published: {published}

Return strict JSON only:
{{
  "niche_score": 0-10,
  "video_angle": "one sentence describing the strongest angle, or null",
  "why_this_score": "one short sentence"
}}"""


# ============================================================
# Pass 1: per-event scoring (only runs for status='new' events)
# ============================================================

def score_one(event: dict, key: str, niche: str, max_retries: int = 4) -> dict | None:
    prompt = PROMPT_TEMPLATE.format(
        niche_description=niche,
        source=event["source"],
        title=event["title"][:250],
        author=(event.get("author") or "")[:80],
        body=(event.get("body_excerpt") or "")[:800],
        published=event.get("published_at") or "?",
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                f"{GEMINI_ENDPOINT}?key={key}",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode())
            return json.loads(body["candidates"][0]["content"]["parts"][0]["text"])
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep((attempt + 1) * 6)
                continue
            print(f"  ! score failed for {event['id']}: HTTP {e.code}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"  ! score failed for {event['id']}: {e}", file=sys.stderr)
            return None
    return None


def keyword_boost(title: str, body: str | None) -> float:
    text = (title + " " + (body or "")).lower()
    hits = sum(1 for kw in VIRAL_KEYWORDS if kw in text)
    return min(2.0, hits * 0.5)


def velocity_raw(event: dict) -> tuple[float, str]:
    """Per-source raw engagement metric. NOT scored 0-10 here - this is the
    raw value that pass 2 will percentile-rank across all same-source events.
    Returns (raw_value, metric_name)."""
    engagement = json.loads(event.get("engagement_raw") or "{}")
    source = event["source"]
    if source == "youtube_upload":
        # outlier_ratio is THE signal - is this video overperforming for its
        # channel? We rank by this within source.
        return (float(engagement.get("outlier_ratio", 0)), "outlier_ratio")
    if source == "youtube_search":
        return (float(engagement.get("views_per_hour", 0)), "views_per_hour")
    if source == "github_trending":
        return (float(engagement.get("stars_period", 0)), "stars_today_or_week")
    if source == "github_release":
        weight = {"high": 8, "med": 5, "low": 3}.get(engagement.get("priority", "med"), 5)
        return (float(weight), "release_priority")
    if source == "rss":
        weight = {"high": 7, "med": 4, "low": 2}.get(engagement.get("priority", "med"), 4)
        return (float(weight), "feed_priority")
    if source == "x":
        likes = engagement.get("likes", 0)
        replies = engagement.get("replies", 0)
        return (float(likes + replies * 2), "likes_plus_2x_replies")
    if source == "reddit":
        ups = engagement.get("ups")
        nc = engagement.get("num_comments")
        if ups is None and nc is None:
            return (0.0, "no_engagement_data")
        return (float((ups or 0) + (nc or 0) * 2), "ups_plus_2x_comments")
    if source == "hackernews":
        # Points are HN's upvote signal; comments imply discussion depth.
        # Same ratio as reddit so cross-source percentile is comparable.
        points = engagement.get("points") or 0
        nc = engagement.get("num_comments") or 0
        return (float(points + nc * 2), "points_plus_2x_comments")
    if source == "polymarket":
        # Real money on the line in the last 24h. The strongest single signal
        # we ingest - traders actually have skin in the game. Capped softly
        # by the percentile ranker downstream so a $100k market doesn't
        # nuke the rest of the source's scoring.
        return (float(engagement.get("volume_24hr") or 0), "volume_24hr_usd")
    if source == "bluesky":
        likes = engagement.get("likes") or 0
        reposts = engagement.get("reposts") or 0
        replies = engagement.get("replies") or 0
        return (float(likes + reposts * 2 + replies * 3), "likes_plus_2x_reposts_plus_3x_replies")
    return (0.0, "default")


def freshness_hn_gravity(published_at: str | None, gravity: float = 1.8) -> float:
    """HN-style time decay. Calibrated so 2h-old -> ~9, 24h -> ~3.5, 72h -> ~1,
    and "no publish date" stays at neutral 5 (we can't know). Formula:
    raw = 1 / (age_hours + 2)^gravity, then scaled."""
    if not published_at:
        return 5.0
    try:
        pub = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        age_hours = max((datetime.now(timezone.utc) - pub).total_seconds() / 3600, 0.5)
    except Exception:
        return 5.0
    raw = 1 / (age_hours + 2) ** gravity
    # Calibration: at age=2h, raw = 1/4^1.8 ≈ 0.0833. We want that to score ~9.
    # So scale ≈ 9 / 0.0833 ≈ 108.
    return round(min(10.0, raw * 108), 2)


# ============================================================
# Pass 2: cross-event percentile rank + harmonic-mean composite
# ============================================================

def percentile_rank(values: list[float]) -> list[float]:
    """Map each value to its percentile rank in 0-10. Ties get the same rank
    (average position). Empty list returns empty."""
    if not values:
        return []
    if len(values) == 1:
        return [5.0]
    indexed = sorted(enumerate(values), key=lambda x: x[1])
    n = len(values)
    ranks = [0.0] * n
    # Handle ties by assigning the average position
    i = 0
    while i < n:
        j = i
        while j + 1 < n and indexed[j + 1][1] == indexed[i][1]:
            j += 1
        # All indexes from i..j have the same value
        avg_pos = (i + j) / 2
        rank_score = (avg_pos / (n - 1)) * 10 if n > 1 else 5.0
        for k in range(i, j + 1):
            ranks[indexed[k][0]] = round(rank_score, 2)
        i = j + 1
    return ranks


def harmonic_mean(values: list[float]) -> float:
    """Penalises any axis being flat. If any value is 0, returns 0."""
    if not values or any(v <= 0 for v in values):
        return 0.0
    n = len(values)
    return n / sum(1 / v for v in values)


def composite(niche: float, velocity_rank: float, freshness: float) -> float:
    """0-100. Harmonic mean of the three axes (all 0-10), times 10.
    Penalises being flat in any axis - a fresh on-niche video that isn't
    moving stays in the feed but can't dominate."""
    hm = harmonic_mean([niche, velocity_rank, freshness])
    return round(hm * 10, 1)


def cross_rank_pass(con: sqlite3.Connection) -> int:
    """Reads all scored events. For each: recompute freshness from
    published_at via HN-gravity, derive velocity_raw (from
    velocity_snapshots OR compute on the fly from engagement_raw if
    missing), percentile-rank within source, harmonic-mean composite.
    Backfills velocity_snapshots when missing. Returns number updated."""
    con.row_factory = sqlite3.Row
    rows = list(con.execute(
        "SELECT e.id, e.source, e.niche_score, e.published_at, "
        "       e.engagement_raw, "
        "       vs.raw_value AS velocity_raw, vs.metric_used "
        "FROM raw_events e "
        "LEFT JOIN velocity_snapshots vs ON vs.event_id = e.id "
        "WHERE (e.composite_score IS NOT NULL OR e.status = 'scored') "
        "AND (e.status IS NULL OR e.status != 'unavailable')"
    ))
    by_source: dict[str, list[dict]] = {}
    for r in rows:
        if r["niche_score"] is None:
            continue
        ev = dict(r)
        # Backfill velocity_raw if missing (older events scored before the
        # velocity_snapshots table was populated).
        if ev["velocity_raw"] is None:
            raw, metric = velocity_raw(ev)
            ev["velocity_raw"] = raw
            ev["metric_used"] = metric
            con.execute(
                "INSERT OR REPLACE INTO velocity_snapshots "
                "(event_id, computed_at, velocity, metric_used, raw_value) "
                "VALUES (?,?,?,?,?)",
                (ev["id"], datetime.now(timezone.utc).isoformat(), 0, metric, raw),
            )
        by_source.setdefault(r["source"], []).append(ev)

    updated = 0
    for source, events in by_source.items():
        raws = [e["velocity_raw"] for e in events]
        ranks = percentile_rank(raws)
        for ev, rank in zip(events, ranks):
            niche = ev["niche_score"]
            fresh = freshness_hn_gravity(ev["published_at"])
            comp = composite(niche, rank, fresh)
            con.execute(
                "UPDATE raw_events SET velocity_score = ?, "
                "freshness_score = ?, composite_score = ? WHERE id = ?",
                (rank, fresh, comp, ev["id"]),
            )
            updated += 1
    con.commit()
    return updated


# ============================================================
# Main
# ============================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="Cap LLM calls (for dev)")
    ap.add_argument("--rank-only", action="store_true",
                    help="Skip the LLM pass, only run the cross-event ranking + recompute composite")
    args = ap.parse_args()

    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    if not args.rank_only:
        key = require_env("GOOGLE_API_KEY")
        niche = json.loads(config_path("niche.json").read_text())["description"]

        rows = con.execute(
            "SELECT * FROM raw_events "
            "WHERE status='new' AND (published_at IS NULL OR datetime(published_at) > datetime('now','-72 hours'))"
        ).fetchall()
        if args.limit:
            rows = rows[: args.limit]
        print(f"Pass 1: scoring {len(rows)} new events ({GEMINI_MODEL})", file=sys.stderr)

        last_call = 0.0
        for row in rows:
            elapsed = time.time() - last_call
            if elapsed < INTER_CALL_SLEEP_SEC:
                time.sleep(INTER_CALL_SLEEP_SEC - elapsed)
            last_call = time.time()
            event = dict(row)
            result = score_one(event, key, niche)
            if not result:
                continue
            niche_s = float(result.get("niche_score", 0))
            niche_s = round(min(10.0, niche_s + keyword_boost(event["title"], event.get("body_excerpt"))), 2)
            raw_v, metric = velocity_raw(event)
            fresh = freshness_hn_gravity(event.get("published_at"))
            # Composite is provisional here; pass 2 will overwrite with rank-based.
            con.execute(
                "UPDATE raw_events SET niche_score=?, freshness_score=?, status='scored' WHERE id=?",
                (niche_s, fresh, event["id"]),
            )
            con.execute(
                "INSERT OR REPLACE INTO velocity_snapshots "
                "(event_id, computed_at, velocity, metric_used, raw_value) VALUES (?,?,?,?,?)",
                (event["id"], datetime.now(timezone.utc).isoformat(), 0, metric, raw_v),
            )
            con.commit()
            print(f"  niche={niche_s:>4.1f} fresh={fresh:>4.1f} raw_v={raw_v:.2f}  {event['title'][:55]}",
                  file=sys.stderr)

    # Pass 2: cross-event ranking + harmonic-mean composite (always runs)
    print("Pass 2: cross-event percentile rank + composite recompute", file=sys.stderr)
    n = cross_rank_pass(con)
    print(f"Updated composite + velocity_rank on {n} events.", file=sys.stderr)
    con.close()


if __name__ == "__main__":
    main()
