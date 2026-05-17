#!/usr/bin/env python3
"""reddit_native.py - Reddit signal via community archive APIs (Arctic Shift / PullPush).

Background: Reddit's 2023 API squeeze killed unauth'd JSON access from hosting
IPs and locked the official API behind OAuth + commercial pricing. We use the
community-maintained archive mirrors instead - both are free, no auth, work
from any IP, and are kept current to ~real-time by volunteer infrastructure:

  - Arctic Shift (primary): https://arctic-shift.photon-reddit.com - indexes
    posts within seconds of publication, 2000 req/min limit.
  - PullPush (fallback): https://api.pullpush.io - successor to Pushshift,
    same data shape, used when Arctic Shift returns an error.

Both return Reddit's native post JSON, so engagement (ups, num_comments,
created_utc, upvote_ratio) comes straight from the source - no Tavily
relevance proxy, no token quotas, no OAuth setup.

Usage:
    python -m pipeline.scripts.ingest.reddit_native
    python -m pipeline.scripts.ingest.reddit_native --sub LocalLLaMA
"""

import argparse
import hashlib
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path

USER_AGENT = "trend-radar/0.4 (+https://github.com/jimibarkway/trend-radar)"
ARCTIC = "https://arctic-shift.photon-reddit.com/api/posts/search"
PULLPUSH = "https://api.pullpush.io/reddit/search/submission"


def _http_json(url: str, timeout: int = 20) -> dict | None:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  ! {url} -> HTTP {e.code}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ! {url} -> {type(e).__name__}: {e}", file=sys.stderr)
        return None


def fetch_subreddit(sub: str, limit: int = 25) -> list[dict]:
    """Return up to `limit` recent posts from /r/<sub>, falling back from
    Arctic Shift to PullPush if the primary errors. Both produce identical
    Reddit-native post dicts."""
    arctic_url = f"{ARCTIC}?{urllib.parse.urlencode({'subreddit': sub, 'limit': limit, 'sort': 'desc'})}"
    data = _http_json(arctic_url)
    if data and data.get("data"):
        return data["data"]

    pullpush_url = f"{PULLPUSH}?{urllib.parse.urlencode({'subreddit': sub, 'size': limit, 'sort': 'desc'})}"
    data = _http_json(pullpush_url)
    if data and data.get("data"):
        return data["data"]

    return []


def event_id(post: dict) -> str:
    pid = post.get("id") or hashlib.sha256(json.dumps(post.get("permalink", ""), sort_keys=True).encode()).hexdigest()[:16]
    return f"reddit:{pid}"


def insert_post(con: sqlite3.Connection, post: dict, searched_sub: str,
                priority: str, allowed_subs: set[str]) -> bool:
    permalink = post.get("permalink") or ""
    if not permalink:
        return False
    actual_sub = (post.get("subreddit") or "")
    if not actual_sub or actual_sub.lower() not in allowed_subs:
        return False
    if post.get("removed_by_category") or post.get("stickied"):
        return False
    eid = event_id(post)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False

    url = "https://www.reddit.com" + permalink
    title = (post.get("title") or "").strip()
    if not title:
        return False
    body = (post.get("selftext") or "").strip()
    author = post.get("author") or ""

    ups = int(post.get("ups") or post.get("score") or 0)
    num_comments = int(post.get("num_comments") or 0)
    upvote_ratio = float(post.get("upvote_ratio") or 0)
    created_utc = int(post.get("created_utc") or post.get("created") or 0)

    pub_at = None
    if created_utc:
        pub_at = datetime.fromtimestamp(created_utc, tz=timezone.utc).isoformat()

    engagement = {
        "subreddit": actual_sub,
        "searched_sub": searched_sub,
        "priority": priority,
        "ups": ups,
        "score": ups,
        "num_comments": num_comments,
        "upvote_ratio": upvote_ratio,
        "created_utc": created_utc,
        "via": "arctic_shift_or_pullpush",
    }

    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'reddit', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, actual_sub, url, title[:300], body[:2000],
            f"r/{actual_sub}",
            datetime.now(timezone.utc).isoformat(), pub_at,
            json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sub", help="Only one subreddit by name")
    ap.add_argument("--limit", type=int, default=25, help="Posts to fetch per sub")
    args = ap.parse_args()

    config = json.loads(config_path("reddit_subs.json").read_text())
    subs = config["subreddits"]
    if args.sub:
        subs = [s for s in subs if s["name"].lower() == args.sub.lower()]
        if not subs:
            sys.exit(f"Unknown sub {args.sub}")

    allowed_subs = {s["name"].lower() for s in config["subreddits"]}

    print(f"[{datetime.now(timezone.utc).isoformat()}] reddit_native (arctic-shift/pullpush) "
          f"subs={len(subs)}", file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total = 0
    for sub_entry in subs:
        sub = sub_entry["name"]
        priority = sub_entry.get("priority", "med")
        posts = fetch_subreddit(sub, limit=args.limit)
        inserted = sum(1 for p in posts if insert_post(con, p, sub, priority, allowed_subs))
        print(f"  r/{sub:25s}  {len(posts):2d} posts, {inserted} new", file=sys.stderr)
        total += inserted
        time.sleep(0.5)  # well under both APIs' 2000 req/min limits
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new Reddit posts.", file=sys.stderr)


if __name__ == "__main__":
    main()
