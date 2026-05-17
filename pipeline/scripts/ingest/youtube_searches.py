#!/usr/bin/env python3
"""youtube_searches.py - poll YT search endpoint for trending queries.

Catches viral videos that are NOT from the channel list - e.g. a new account
posting a breakout video. Queries come from config/youtube_searches.json.

Filtered to the last N hours and sorted by date. For each candidate video, we
also fetch its channel's recent uploads to compute a channel-median baseline
and the outlier_ratio (this video's views / channel median). The outlier
ratio is what lets the scorer distinguish 'genuine breakout' from 'low-view
noise that happens to be fresh.'

Usage:
    python -m pipeline.scripts.ingest.youtube_searches
    python -m pipeline.scripts.ingest.youtube_searches --query "new ai destroys"
"""

import argparse
import json
import re
import sqlite3
import statistics
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, key_or_skip

YT_API = "https://www.googleapis.com/youtube/v3"


def yt_get(path: str, params: dict, key: str) -> dict:
    params = {**params, "key": key}
    url = f"{YT_API}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())


def event_id(video_id: str) -> str:
    return f"youtube_search:{video_id}"


# --- channel-median baseline (per-run cache) --------------------------------

_CHANNEL_CACHE: dict[str, dict] = {}


def channel_baseline(channel_id: str, key: str) -> dict:
    """Return {'median_views': int, 'subscriber_count': int} for a channel.
    Result is cached for the run so 10 search hits from the same channel
    only cost one extra channels + one playlistItems + one videos call."""
    if channel_id in _CHANNEL_CACHE:
        return _CHANNEL_CACHE[channel_id]

    out = {"median_views": 0, "subscriber_count": 0}
    try:
        cdata = yt_get("channels", {"part": "contentDetails,statistics", "id": channel_id}, key)
        items = cdata.get("items", [])
        if not items:
            _CHANNEL_CACHE[channel_id] = out
            return out
        out["subscriber_count"] = int(items[0].get("statistics", {}).get("subscriberCount", 0) or 0)
        uploads_pl = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

        pdata = yt_get("playlistItems",
                       {"part": "contentDetails", "playlistId": uploads_pl, "maxResults": 15}, key)
        vids = [it["contentDetails"]["videoId"] for it in pdata.get("items", [])
                if it.get("contentDetails", {}).get("videoId")]
        if not vids:
            _CHANNEL_CACHE[channel_id] = out
            return out

        vdata = yt_get("videos", {"part": "statistics", "id": ",".join(vids)}, key)
        views = [int(v.get("statistics", {}).get("viewCount", 0))
                 for v in vdata.get("items", [])]
        views = [v for v in views if v > 0]
        if views:
            out["median_views"] = int(statistics.median(views))
    except Exception as e:
        print(f"  ! channel_baseline({channel_id}) failed: {e}", file=sys.stderr)

    _CHANNEL_CACHE[channel_id] = out
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", help="Run only one query")
    ap.add_argument("--lookback-hours", type=int, default=24)
    ap.add_argument("--max-per-query", type=int, default=15)
    ap.add_argument("--min-outlier-ratio", type=float, default=1.5,
                    help="Reject search hits below this outlier ratio (default 1.5).")
    ap.add_argument("--keep-unknown-baseline", action="store_true",
                    help="Keep videos where channel median can't be computed.")
    args = ap.parse_args()

    key = key_or_skip("YOUTUBE_API_KEY", "youtube_searches")
    cfg = json.loads(config_path("youtube_searches.json").read_text())
    queries = [args.query] if args.query else cfg.get("queries", [])
    since = (datetime.now(timezone.utc) - timedelta(hours=args.lookback_hours)).isoformat()
    since = since.replace("+00:00", "Z")

    print(f"[{datetime.now(timezone.utc).isoformat()}] youtube_searches queries={len(queries)}",
          file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total = 0
    rejected_low_outlier = 0
    rejected_no_baseline = 0
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

            channel_id = snippet.get("channelId", "")
            baseline = channel_baseline(channel_id, key) if channel_id else {"median_views": 0, "subscriber_count": 0}
            median = baseline["median_views"]
            outlier = round(views / median, 3) if median > 0 else 0

            # Outlier gate: a low-view search hit only earns a slot if it's
            # a genuine outlier against its own channel's baseline. Without
            # this gate, fresh videos with 200 views slip through on raw vph.
            if median == 0:
                if not args.keep_unknown_baseline:
                    rejected_no_baseline += 1
                    continue
            elif outlier < args.min_outlier_ratio:
                rejected_low_outlier += 1
                continue

            engagement = {
                "search_query": q, "views": views, "likes": likes,
                "age_hours": round(age_hours, 1), "views_per_hour": round(vph, 1),
                "channel_id": channel_id,
                "channel_title": snippet.get("channelTitle"),
                "channel_median_views": int(median),
                "channel_subscriber_count": int(baseline["subscriber_count"]),
                "outlier_ratio": outlier,
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
    print(f"Done. Inserted {total} new search-discovered videos "
          f"(rejected: {rejected_low_outlier} low-outlier, {rejected_no_baseline} no-baseline).",
          file=sys.stderr)


if __name__ == "__main__":
    main()
