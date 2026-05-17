#!/usr/bin/env python3
"""hackernews.py - HN stories via Algolia's free public search API.

Hacker News exposes a fully-featured search API at hn.algolia.com - no key,
no quota, sub-minute freshness. We query for the AI keyword set in
config/hackernews.json and store new stories as raw_events with real HN
engagement (points + num_comments + age).

The scorer's niche LLM (score.py) is what decides per-event AI relevance,
so we cast a wide net here and let downstream do the precision filtering.

Usage:
    python -m pipeline.scripts.ingest.hackernews
    python -m pipeline.scripts.ingest.hackernews --query "claude code"
"""

import argparse
import hashlib
import json
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path

HN_API = "https://hn.algolia.com/api/v1/search"
DEFAULT_QUERIES = [
    "claude", "anthropic", "claude code", "mcp server",
    "ollama", "ai agent", "agentic", "llama.cpp", "local llm",
    "ai automation", "cursor ide", "windsurf editor",
]


def hn_search(query: str, since_ts: int, hits_per_page: int = 30) -> list[dict]:
    """Search HN stories newer than since_ts (unix seconds). Algolia returns
    by relevance + recency mix; tag filter limits to top-level stories."""
    qs = urllib.parse.urlencode({
        "query": query,
        "tags": "story",
        "numericFilters": f"created_at_i>{since_ts}",
        "hitsPerPage": hits_per_page,
    })
    req = urllib.request.Request(
        f"{HN_API}?{qs}",
        headers={"User-Agent": "trend-radar/0.3 (+https://github.com/jimibarkway/trend-radar)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode()).get("hits", [])
    except Exception as e:
        print(f"  ! HN search err {query!r}: {e}", file=sys.stderr)
        return []


def event_id(story: dict) -> str:
    obj_id = story.get("objectID") or story.get("story_id") or ""
    return f"hn:{obj_id}" if obj_id else "hn:" + hashlib.sha256(json.dumps(story, sort_keys=True).encode()).hexdigest()[:16]


def insert_story(con: sqlite3.Connection, story: dict, matched_query: str) -> bool:
    eid = event_id(story)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False

    obj_id = story.get("objectID", "")
    external_url = story.get("url") or ""
    hn_url = f"https://news.ycombinator.com/item?id={obj_id}"
    # Show-HN / Ask-HN have no external url; the discussion IS the link.
    canonical_url = external_url or hn_url
    title = story.get("title") or ""
    if not title:
        return False
    points = int(story.get("points") or 0)
    num_comments = int(story.get("num_comments") or 0)
    author = story.get("author") or ""
    created_at = story.get("created_at") or ""

    age_hours = None
    if story.get("created_at_i"):
        try:
            age_hours = round((time.time() - int(story["created_at_i"])) / 3600, 1)
        except Exception:
            pass

    engagement = {
        "matched_query": matched_query,
        "points": points,
        "num_comments": num_comments,
        "hn_url": hn_url,
        "external_url": external_url,
        "age_hours": age_hours,
        # Velocity hint for score.py - points per hour
        "points_per_hour": round(points / age_hours, 2) if age_hours else None,
    }
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'hackernews', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, matched_query[:50], canonical_url, title[:300],
            (story.get("story_text") or "")[:2000],
            author,
            datetime.now(timezone.utc).isoformat(),
            created_at, json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", help="Only one query")
    ap.add_argument("--lookback-hours", type=int, default=48)
    args = ap.parse_args()

    # Optional config file lets the user override the keyword list without
    # editing this script. Falls back to DEFAULT_QUERIES.
    cfg_file = config_path("hackernews.json")
    if cfg_file.exists():
        cfg = json.loads(cfg_file.read_text())
        queries = cfg.get("queries", DEFAULT_QUERIES)
    else:
        queries = DEFAULT_QUERIES
    if args.query:
        queries = [args.query]

    since_ts = int((datetime.now(timezone.utc) - timedelta(hours=args.lookback_hours)).timestamp())
    print(f"[{datetime.now(timezone.utc).isoformat()}] hackernews queries={len(queries)}",
          file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total = 0
    for q in queries:
        hits = hn_search(q, since_ts)
        inserted = sum(1 for h in hits if insert_story(con, h, q))
        print(f"  {q:25s} {len(hits):2d} hits, {inserted} new", file=sys.stderr)
        total += inserted
        time.sleep(0.3)
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new HN stories.", file=sys.stderr)


if __name__ == "__main__":
    main()
