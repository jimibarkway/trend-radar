#!/usr/bin/env python3
"""score.py - LLM-driven niche + velocity + freshness scoring.

Walks all raw_events with status='new', asks Gemini Flash-Lite to rate each
0-10 for niche relevance, then computes velocity + freshness + composite.

The niche prompt lives in config/niche.json so anyone forking this can retune
it for their own creator focus. The default is tuned for AI / agentic-workflow
content.

Marks events as status='scored'.

Usage:
    python -m pipeline.scripts.score
    python -m pipeline.scripts.score --limit 50   # cap LLM calls
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


def velocity_score(event: dict) -> tuple[float, str, float]:
    """Returns (velocity_0_to_10, metric_name, raw_value). The raw value lands
    in velocity_snapshots for dashboard transparency."""
    engagement = json.loads(event.get("engagement_raw") or "{}")
    source = event["source"]
    if source == "youtube_upload":
        outlier = engagement.get("outlier_ratio", 1.0)
        vph = engagement.get("views_per_hour", 0)
        v = min(10, outlier * 1.5 + math.log1p(vph) * 0.8)
        return (v, "outlier_ratio_x_views_per_hour", float(vph))
    if source == "youtube_search":
        # views/hour, but the old log1p(vph)*1.5 curve saturated far too
        # fast: a 179 views/hr video scored 7.8/10, making a 358-view video
        # look like a viral signal. A log10 curve needs real traction:
        #   ~50/hr -> 2.6 | ~200/hr -> 4.3 | ~1k/hr -> 6.0 | ~10k/hr -> 8.6
        # Genuinely-accelerating videos still rank; modest ones don't claim
        # the top hidden-gem slot.
        vph = engagement.get("views_per_hour", 0)
        v = min(10, math.log10(1 + vph) * 2.0)
        return (v, "views_per_hour", float(vph))
    if source == "github_release":
        weight = {"high": 8, "med": 5, "low": 3}.get(engagement.get("priority", "med"), 5)
        return (float(weight), "release_priority", float(weight))
    if source == "github_trending":
        stars = engagement.get("stars_period", 0)
        v = min(10, math.log1p(stars) * 1.5)
        return (v, "stars_today_or_week", float(stars))
    if source == "rss":
        weight = {"high": 7, "med": 4, "low": 2}.get(engagement.get("priority", "med"), 4)
        return (float(weight), "feed_priority", float(weight))
    if source == "x":
        likes = engagement.get("likes", 0)
        replies = engagement.get("replies", 0)
        raw = likes + replies * 2
        v = min(10, math.log1p(raw) * 1.2)
        return (v, "likes_plus_2x_replies", float(raw))
    if source == "reddit":
        # We enrich each Reddit ingest with the real ups + num_comments from
        # Reddit's public JSON endpoint. If that worked, score on actual
        # engagement. If not, fall through to 0.
        ups = engagement.get("ups")
        nc = engagement.get("num_comments")
        if ups is not None or nc is not None:
            raw = (ups or 0) + (nc or 0) * 2  # comments weighted 2x
            v = min(10, math.log1p(raw) * 1.4)
            return (v, "ups_plus_2x_comments", float(raw))
        return (0.0, "no_engagement_data", 0.0)
    return (3.0, "default", 0.0)


def freshness_score(published_at: str | None) -> float:
    if not published_at:
        return 5.0
    try:
        pub = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        age_hours = max((datetime.now(timezone.utc) - pub).total_seconds() / 3600, 0.5)
    except Exception:
        return 5.0
    if age_hours < 1:   return 10
    if age_hours < 6:   return 9
    if age_hours < 12:  return 7
    if age_hours < 24:  return 5
    if age_hours < 48:  return 3
    return 1


def composite(niche: float, velocity: float, freshness: float) -> float:
    """0-100 composite. Velocity weighting bumped vs the v0.1 formula -
    fits the 'hidden gem' / 'caught early' frame better."""
    return round((niche * 5) + (velocity * 3) + (freshness * 2), 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="Cap LLM calls (for dev)")
    args = ap.parse_args()

    key = require_env("GOOGLE_API_KEY")
    niche = json.loads(config_path("niche.json").read_text())["description"]
    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    rows = con.execute(
        "SELECT * FROM raw_events "
        "WHERE status='new' AND (published_at IS NULL OR published_at > datetime('now','-72 hours'))"
    ).fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"Scoring {len(rows)} events ({GEMINI_MODEL})", file=sys.stderr)

    updated = 0
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
        v, metric, raw_v = velocity_score(event)
        f = freshness_score(event.get("published_at"))
        score = composite(niche_s, v, f)
        con.execute(
            "UPDATE raw_events SET niche_score=?, velocity_score=?, "
            "freshness_score=?, composite_score=?, status='scored' WHERE id=?",
            (niche_s, v, f, score, event["id"]),
        )
        con.execute(
            "INSERT OR REPLACE INTO velocity_snapshots "
            "(event_id, computed_at, velocity, metric_used, raw_value) VALUES (?,?,?,?,?)",
            (event["id"], datetime.now(timezone.utc).isoformat(), v, metric, raw_v),
        )
        con.commit()
        updated += 1
        print(f"  {niche_s:>4.1f} (v={v:.1f} f={f:.0f}) -> {score:>5.1f}  {event['title'][:60]}",
              file=sys.stderr)
    con.close()
    print(f"Scored {updated} events.", file=sys.stderr)


if __name__ == "__main__":
    main()
