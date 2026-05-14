#!/usr/bin/env python3
"""x_apify.py - X / Twitter ingestion via Apify CLI at 12-hour cadence.

For each keyword in config/x_keywords.json, invoke an Apify Twitter scraper
actor to pull recent tweets, filter by engagement threshold, store as
raw_events.

Actor: apidojo/twitter-scraper-lite (lite is cheaper).

Usage:
    python -m pipeline.scripts.ingest.x_apify
    python -m pipeline.scripts.ingest.x_apify --keyword "claude code"
    python -m pipeline.scripts.ingest.x_apify --dry-run
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sqlite3
import sys
import tempfile
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, key_or_skip

ACTOR_ID = "apidojo/twitter-scraper-lite"


def event_id(tweet_url: str) -> str:
    return "x:" + hashlib.sha256(tweet_url.encode()).hexdigest()[:20]


def run_apify_actor(keyword: str, token: str, max_results: int = 25,
                    window_hours: int = 12) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(hours=window_hours)).strftime("%Y-%m-%d")
    actor_input = {
        "searchTerms": [keyword],
        "maxItems": max_results,
        "sort": "Latest",
        "tweetLanguage": "en",
        "start": since,
    }
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
        json.dump(actor_input, f)
        input_path = f.name

    try:
        result = subprocess.run(
            ["apify", "actors", "call", ACTOR_ID, "--input-file", input_path, "--silent"],
            env={**os.environ, "APIFY_API_TOKEN": token},
            capture_output=True, text=True, timeout=180,
        )
        if result.returncode != 0:
            print(f"  ! actor failed: {result.stderr[:300]}", file=sys.stderr)
            return []
        run_id = None
        for line in result.stdout.splitlines():
            m = re.search(r"runs/([a-zA-Z0-9]+)", line)
            if m:
                run_id = m.group(1)
                break
        if not run_id:
            return []
        ds_url = f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items?clean=1&token={token}"
        with urllib.request.urlopen(ds_url, timeout=30) as r:
            items = json.loads(r.read())
        return items if isinstance(items, list) else []
    except subprocess.TimeoutExpired:
        print(f"  ! actor timed out for {keyword!r}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  ! actor exception: {e}", file=sys.stderr)
        return []
    finally:
        os.unlink(input_path)


def insert_tweet(con: sqlite3.Connection, tweet: dict, keyword: str, thresholds: dict) -> bool:
    url = tweet.get("url") or tweet.get("twitterUrl") or tweet.get("permalink", "")
    if not url:
        return False
    likes = int(tweet.get("likeCount") or tweet.get("favorite_count") or 0)
    replies = int(tweet.get("replyCount") or tweet.get("reply_count") or 0)
    retweets = int(tweet.get("retweetCount") or tweet.get("retweet_count") or 0)
    if likes < thresholds.get("likes", 50) and replies < thresholds.get("comment_replies", 5):
        return False
    eid = event_id(url)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False
    text = tweet.get("text") or tweet.get("fullText", "")
    author_name = tweet.get("author", {}).get("name") if isinstance(tweet.get("author"), dict) else (tweet.get("username") or "?")
    author_handle = tweet.get("author", {}).get("userName") if isinstance(tweet.get("author"), dict) else (tweet.get("username") or "?")
    published = tweet.get("createdAt") or tweet.get("created_at") or None

    engagement = {
        "keyword": keyword, "likes": likes, "replies": replies,
        "retweets": retweets, "author_handle": author_handle,
    }
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'x', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, keyword, url,
            text[:200] if text else "(tweet)", text[:2000],
            f"{author_name} (@{author_handle})",
            datetime.now(timezone.utc).isoformat(),
            published, json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keyword", help="Only one keyword")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    config = json.loads(config_path("x_keywords.json").read_text())
    keywords = config["keywords"]
    if args.keyword:
        keywords = [k for k in keywords if k.lower() == args.keyword.lower()]
    thresholds = config.get("min_engagement_threshold", {"likes": 50, "comment_replies": 5})
    window = config.get("search_window_hours", 12)
    max_per = config.get("max_results_per_keyword", 25)

    print(f"[{datetime.now(timezone.utc).isoformat()}] x_apify keywords={len(keywords)} window={window}h",
          file=sys.stderr)

    if args.dry_run:
        for kw in keywords:
            print(f"  WOULD run apify for {kw!r}", file=sys.stderr)
        return

    token = key_or_skip("APIFY_TOKEN", "x_apify")
    con = sqlite3.connect(str(db_path()))
    total = 0
    for kw in keywords:
        tweets = run_apify_actor(kw, token, max_results=max_per, window_hours=window)
        inserted = 0
        for t in tweets:
            if insert_tweet(con, t, kw, thresholds):
                inserted += 1
        print(f"  {kw:30s}  {len(tweets):2d} tweets, {inserted} new", file=sys.stderr)
        total += inserted
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new X events.", file=sys.stderr)


if __name__ == "__main__":
    main()
