#!/usr/bin/env python3
"""youtube_uploads.py - poll AI-niche YouTube channels' recent uploads.

For each channel in config/channels.json, fetch the latest ~15 videos via the
YT Data API, compute views-per-hour velocity and outlier ratio (views vs
channel median), store as raw_events.

Usage:
    python -m pipeline.scripts.ingest.youtube_uploads
    python -m pipeline.scripts.ingest.youtube_uploads --channel @somehandle
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


def get_channel_meta(channel_id: str, key: str) -> tuple[str | None, int]:
    """Returns (uploads_playlist_id, subscriber_count). One API call -
    'statistics' added to the part param so the real sub count comes for
    free. The sub count is what 'small channel' should be judged on, NOT
    median views."""
    data = yt_get("channels", {"part": "contentDetails,statistics", "id": channel_id}, key)
    items = data.get("items", [])
    if not items:
        return None, 0
    uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]
    subs = int(items[0].get("statistics", {}).get("subscriberCount", 0) or 0)
    return uploads, subs


def list_recent_uploads(playlist_id: str, key: str, max_results: int = 15) -> list[str]:
    data = yt_get("playlistItems", {"part": "contentDetails", "playlistId": playlist_id, "maxResults": max_results}, key)
    return [item["contentDetails"]["videoId"] for item in data.get("items", []) if item.get("contentDetails", {}).get("videoId")]


def fetch_video_stats(video_ids: list[str], key: str) -> list[dict]:
    if not video_ids:
        return []
    out = []
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i : i + 50]
        data = yt_get("videos", {"part": "snippet,statistics,contentDetails", "id": ",".join(batch)}, key)
        out.extend(data.get("items", []))
    return out


def event_id(video_id: str) -> str:
    return f"youtube_upload:{video_id}"


def parse_iso_duration(d: str) -> int:
    if not d or not d.startswith("PT"):
        return 0
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", d)
    if not m:
        return 0
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


def insert_video(con: sqlite3.Connection, video: dict, channel_meta: dict, channel_median: float) -> bool:
    vid = video["id"]
    eid = event_id(vid)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False
    snippet = video["snippet"]
    stats = video.get("statistics", {})
    content = video.get("contentDetails", {})

    duration_sec = parse_iso_duration(content.get("duration", ""))
    if duration_sec < 60:
        return False

    published = snippet.get("publishedAt", "")
    try:
        published_dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
    except Exception:
        published_dt = datetime.now(timezone.utc)
    age_hours = max((datetime.now(timezone.utc) - published_dt).total_seconds() / 3600, 0.5)
    views = int(stats.get("viewCount", 0))
    likes = int(stats.get("likeCount", 0)) if stats.get("likeCount") else 0
    comments = int(stats.get("commentCount", 0)) if stats.get("commentCount") else 0

    velocity = views / age_hours
    outlier_ratio = round(views / channel_median, 3) if channel_median > 0 else 0

    engagement = {
        "views": views, "likes": likes, "comments": comments,
        "duration_sec": duration_sec, "age_hours": round(age_hours, 1),
        "views_per_hour": round(velocity, 1),
        "channel_median_views": int(channel_median),
        "channel_subscriber_count": int(channel_meta.get("subscriber_count", 0)),
        "outlier_ratio": outlier_ratio,
        "channel_id": channel_meta["channel_id"],
        "channel_title": channel_meta["title"],
        "channel_handle": channel_meta["handle"],
        "thumbnail_url": snippet["thumbnails"].get("maxres", snippet["thumbnails"].get("high", {})).get("url", ""),
    }
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'youtube_upload', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, channel_meta["handle"],
            f"https://www.youtube.com/watch?v={vid}",
            snippet.get("title", "")[:300],
            (snippet.get("description", "") or "")[:2000],
            channel_meta["title"],
            datetime.now(timezone.utc).isoformat(),
            published, json.dumps(engagement),
        ),
    )
    return True


def channel_median_views(video_items: list[dict]) -> float:
    views = [int(v.get("statistics", {}).get("viewCount", 0)) for v in video_items]
    views = [v for v in views if v > 0]
    return statistics.median(views) if views else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", help="Process only one channel (by handle, e.g. @somehandle)")
    ap.add_argument("--lookback-hours", type=int, default=48)
    args = ap.parse_args()

    key = key_or_skip("YOUTUBE_API_KEY", "youtube_uploads")
    channels = json.loads(config_path("channels.json").read_text())["channels"]
    if args.channel:
        wanted = args.channel.lstrip("@")
        channels = [c for c in channels if c.get("handle", "").lstrip("@") == wanted]
        if not channels:
            sys.exit(f"channel {args.channel} not in config")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=args.lookback_hours)
    print(f"[{datetime.now(timezone.utc).isoformat()}] youtube_uploads channels={len(channels)}",
          file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total_inserted = 0
    for ch in channels:
        cid = ch.get("channel_id")
        if not cid:
            continue
        try:
            uploads, subs = get_channel_meta(cid, key)
            if not uploads:
                continue
            ch = {**ch, "subscriber_count": subs}  # real sub count for insert_video
            recent_ids = list_recent_uploads(uploads, key, max_results=15)
            videos = fetch_video_stats(recent_ids, key)
            if not videos:
                continue
            median = channel_median_views(videos)
            ch_handle = ch.get("handle", "?")
            inserted_count = 0
            for v in videos:
                pub = v.get("snippet", {}).get("publishedAt", "")
                if pub:
                    try:
                        if datetime.fromisoformat(pub.replace("Z", "+00:00")) < cutoff:
                            continue
                    except Exception:
                        pass
                if insert_video(con, v, ch, median):
                    inserted_count += 1
            print(f"  {ch_handle:25s} median={int(median):>8,}  +{inserted_count}", file=sys.stderr)
            total_inserted += inserted_count
        except Exception as e:
            print(f"  ! {ch.get('name','?')} failed: {e}", file=sys.stderr)
    con.commit()
    con.close()
    print(f"Done. Inserted {total_inserted} new YouTube uploads.", file=sys.stderr)


if __name__ == "__main__":
    main()
