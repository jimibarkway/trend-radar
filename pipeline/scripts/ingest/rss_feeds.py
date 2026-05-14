#!/usr/bin/env python3
"""rss_feeds.py - poll RSS feeds for new items.

For each feed in config/rss_feeds.json, fetch the feed, dedupe by
(feed_name, entry_guid) against raw_events table, store new items. Apply
keyword filter post-fetch for feeds with filter_required=true.

Usage:
    python -m pipeline.scripts.ingest.rss_feeds
    python -m pipeline.scripts.ingest.rss_feeds --feed "Anthropic News"
"""

import argparse
import hashlib
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import feedparser

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path


def event_id(feed_name: str, entry_id: str) -> str:
    safe = hashlib.sha256(entry_id.encode()).hexdigest()[:16]
    return f"rss:{feed_name.lower().replace(' ','_')}:{safe}"


def matches_keywords(text: str, keywords: list[str]) -> bool:
    lower = text.lower()
    return any(k in lower for k in keywords)


def insert_entry(con: sqlite3.Connection, feed_name: str, entry, priority: str) -> bool:
    raw_id = entry.get("id") or entry.get("guid") or entry.get("link", "")
    if not raw_id:
        return False
    eid = event_id(feed_name, raw_id)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False

    title = entry.get("title", "")
    link = entry.get("link", "")
    body = entry.get("summary", "") or entry.get("description", "") or ""
    body = re.sub(r"<[^>]+>", " ", body)
    body = re.sub(r"\s+", " ", body).strip()
    published = entry.get("published") or entry.get("updated")
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        try:
            from time import mktime
            published = datetime.fromtimestamp(
                mktime(entry.published_parsed), tz=timezone.utc
            ).isoformat()
        except Exception:
            pass
    # Some feeds publish items with a future date (scheduled posts, timezone
    # quirks). An item can't genuinely be published after we ingested it -
    # clamp to "now" so freshness scoring and lead-time stay sane.
    now = datetime.now(timezone.utc)
    if published:
        try:
            if datetime.fromisoformat(published.replace("Z", "+00:00")) > now:
                published = now.isoformat()
        except Exception:
            pass
    author = entry.get("author") or feed_name

    engagement = {"priority": priority, "feed": feed_name}
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'rss', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, feed_name, link, title, body[:2000], author,
            datetime.now(timezone.utc).isoformat(), published,
            json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--feed", help="Poll only one feed by name")
    args = ap.parse_args()

    config = json.loads(config_path("rss_feeds.json").read_text())
    feeds = config["feeds"]
    keywords = config.get("keyword_filter", [])
    if args.feed:
        feeds = [f for f in feeds if f["name"] == args.feed]
        if not feeds:
            sys.exit(f"No feed named {args.feed!r}")

    print(f"[{datetime.now(timezone.utc).isoformat()}] rss feeds={len(feeds)}", file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total_inserted = 0
    for entry in feeds:
        name = entry["name"]
        url = entry["url"]
        priority = entry.get("priority", "med")
        filter_required = entry.get("filter_required", False)
        try:
            parsed = feedparser.parse(url)
        except Exception as e:
            print(f"  ! {name}: parse error {e}", file=sys.stderr)
            continue
        if parsed.bozo and not parsed.entries:
            print(f"  ! {name}: parse failed", file=sys.stderr)
            continue
        inserted = 0
        for e in parsed.entries[:30]:
            if filter_required:
                text = (e.get("title", "") + " " + e.get("summary", "") + " " + e.get("description", ""))
                if not matches_keywords(text, keywords):
                    continue
            if insert_entry(con, name, e, priority):
                inserted += 1
        total_inserted += inserted
        print(f"  {name:30s}  {len(parsed.entries):3d} entries, {inserted} new", file=sys.stderr)
    con.commit()
    con.close()
    print(f"Done. Inserted {total_inserted} new RSS items.", file=sys.stderr)


if __name__ == "__main__":
    main()
