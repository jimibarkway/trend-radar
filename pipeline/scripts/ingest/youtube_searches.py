#!/usr/bin/env python3
"""youtube_searches.py - poll YT search endpoint for trending queries.

Catches viral videos that are NOT from the channel list - e.g. a new account
posting a breakout video. Queries come from config/youtube_searches.json.

Filtered to the last N hours and sorted by date.

Usage:
    python -m pipeline.scripts.ingest.youtube_searches
    python -m pipeline.scripts.ingest.youtube_searches --query "new ai destroys"
"""

import argparse
import json
import re
import sqlite3
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, require_env

YT_API = "https://www.googleapis.com/youtube/v3"


def yt_get(path: str, params: dict, key: str) -> dict:
    params = {**params, "key": key}
    url = f"{YT_API}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())


def event_id(video_id: str) -> str:
    return f"youtube_search:{video_id}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", help="Run only one query")
    ap.add_argument("--lookback-hours", type=int, default=24)
    ap.add_argument("--max-per-query", type=int, default=15)
    args = ap.parse_args()

    key = require_env("YOUTUBE_API_KEY")
    cfg = json.loads(config_path("youtube_searches.json").read_text())
    queries = [args.query] if args.query else cfg.get("queries", [])
    since = (datetime.now(timezone.utc) - timedelta(hours=args.lookback_hours)).isoformat()
    since = since.replace("+00:00", "Z")

    print(f"[{datetime.now(timezone.utc).isoformat()}] youtube_searches queries={len(queries)}",
          file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total = 0
    for q in queries:
        try:
            data = yt_get("search", {
                "part": "snippet", "q": q, "type": "video", "order": "date",
                "publishedAfter": since, "maxResults": args.max_per_query,
                "relevanceLanguage": "en",
            }, key)
        except Exception as e:
            print(f"  ! search failed for {q!r}: {e}", file=sys.stderr)
            continue

        items = data.get("items", [])
        if not items:
            print(f"  {q:35s} 0 results", file=sys.stderr)
            continue

        ids = [it["id"]["videoId"] for it in items if it.get("id", {}).get("videoId")]
        try:
            stats_data = yt_get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(ids)}, key)
            stats_by_id = {v["id"]: v for v in stats_data.get("items", [])}
        except Exception as e:
            print(f"  ! stats fetch failed for {q!r}: {e}", file=sys.stderr)
            continue

        inserted = 0
        for v in stats_by_id.values():
            vid = v["id"]
            eid = event_id(vid)
            if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
                continue
            snippet = v["snippet"]
            stats = v.get("statistics", {})
            content = v.get("contentDetails", {})

            duration = content.get("duration", "")
            m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or "")
            if m:
                h, mi, s = (int(x) if x else 0 for x in m.groups())
                if (h * 3600 + mi * 60 + s) < 60:
                    continue

            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount") or 0)
            published = snippet.get("publishedAt", "")
            try:
                pub_dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
                age_hours = max((datetime.now(timezone.utc) - pub_dt).total_seconds() / 3600, 0.5)
            except Exception:
                age_hours = 24.0
            vph = views / age_hours

            engagement = {
                "search_query": q, "views": views, "likes": likes,
                "age_hours": round(age_hours, 1), "views_per_hour": round(vph, 1),
                "channel_id": snippet.get("channelId"),
                "channel_title": snippet.get("channelTitle"),
                "thumbnail_url": snippet["thumbnails"].get("high", {}).get("url", ""),
            }
            con.execute(
                """INSERT INTO raw_events
                     (id, source, source_subtype, url, title, body_excerpt, author,
                      ingested_at, published_at, engagement_raw)
                   VALUES (?, 'youtube_search', ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    eid, q[:50],
                    f"https://www.youtube.com/watch?v={vid}",
                    snippet.get("title", "")[:300],
                    (snippet.get("description", "") or "")[:2000],
                    snippet.get("channelTitle", ""),
                    datetime.now(timezone.utc).isoformat(),
                    published, json.dumps(engagement),
                ),
            )
            inserted += 1
        print(f"  {q:35s} {len(items):2d} results, {inserted} new", file=sys.stderr)
        total += inserted
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new search-discovered videos.", file=sys.stderr)


if __name__ == "__main__":
    main()
