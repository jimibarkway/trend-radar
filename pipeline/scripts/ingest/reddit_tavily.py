#!/usr/bin/env python3
"""reddit_tavily.py - Reddit signal via Tavily search API.

For each subreddit in config/reddit_subs.json, run a Tavily search restricted
to reddit.com, pulling fresh AI-relevant posts. Stores each as raw_event with
source='reddit'.

Free tier: 1000 searches/mo. With 8 subs daily, we burn ~240/mo.

Usage:
    python -m pipeline.scripts.ingest.reddit_tavily
    python -m pipeline.scripts.ingest.reddit_tavily --sub LocalLLaMA
"""

import argparse
import hashlib
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, key_or_skip

TAVILY_URL = "https://api.tavily.com/search"


def tavily_search(query: str, key: str, max_results: int = 8) -> list[dict]:
    payload = {
        "api_key": key,
        "query": query,
        "include_domains": ["reddit.com"],
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
        "include_raw_content": False,
    }
    req = urllib.request.Request(
        TAVILY_URL,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
        return data.get("results", [])
    except urllib.error.HTTPError as e:
        print(f"  ! Tavily HTTP {e.code}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  ! Tavily err: {e}", file=sys.stderr)
        return []


def event_id(url: str) -> str:
    return "reddit:" + hashlib.sha256(url.encode()).hexdigest()[:20]


def url_subreddit(url: str) -> str | None:
    """Extract the subreddit from a Reddit post URL (/r/<sub>/comments/...)."""
    import re
    m = re.search(r"reddit\.com/r/([A-Za-z0-9_]+)/comments/", url)
    return m.group(1) if m else None


def post_id_from_url(url: str) -> str | None:
    """Extract the Reddit post id from a post URL."""
    import re
    m = re.search(r"/comments/([a-z0-9]+)/", url)
    return m.group(1) if m else None


REDDIT_UA = "trend-radar/0.2 (+https://github.com/jimibarkway/trend-radar)"


def fetch_reddit_engagement(post_url: str) -> dict | None:
    """Hit Reddit's public JSON endpoint for the post to get real ups +
    num_comments + created_utc. Returns None on failure (404, rate limit, etc).
    Reddit rate limits unauth'd at ~60/min - we pace with a small sleep."""
    pid = post_id_from_url(post_url)
    if not pid:
        return None
    api = f"https://www.reddit.com/comments/{pid}.json"
    req = urllib.request.Request(api, headers={"User-Agent": REDDIT_UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        # First listing is the post itself
        post = data[0]["data"]["children"][0]["data"]
        return {
            "ups": int(post.get("ups", 0)),
            "downs": int(post.get("downs", 0)),
            "score": int(post.get("score", 0)),
            "num_comments": int(post.get("num_comments", 0)),
            "upvote_ratio": float(post.get("upvote_ratio", 0)),
            "created_utc": int(post.get("created_utc", 0)),
        }
    except urllib.error.HTTPError as e:
        if e.code == 429:
            import time
            time.sleep(5)
        return None
    except Exception:
        return None


def insert_post(con: sqlite3.Connection, post: dict, sub: str, priority: str,
                allowed_subs: set[str]) -> bool:
    url = post.get("url", "")
    if not url or "reddit.com" not in url:
        return False
    # Filter out subreddit landing pages - we want actual post URLs.
    if "/comments/" not in url:
        return False
    # Filter out off-topic spam subs - Tavily's site: filter is fuzzy and
    # sometimes returns posts from related subs we didn't ask for.
    actual_sub = url_subreddit(url)
    if not actual_sub or actual_sub.lower() not in allowed_subs:
        return False
    eid = event_id(url)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False
    title = post.get("title", "")
    body = post.get("content", "") or ""
    score = post.get("score", 0)
    engagement: dict = {
        "subreddit": actual_sub,            # the ACTUAL sub the post is in
        "searched_sub": sub,                 # the sub we were querying
        "priority": priority,
        "tavily_relevance": score,
    }
    # Enrich with real Reddit engagement (ups, num_comments, created_utc).
    # This is what fixes the "Tavily relevance != engagement" bug long-term.
    real = fetch_reddit_engagement(url)
    pub_at = None
    if real:
        engagement.update(real)
        if real.get("created_utc"):
            pub_at = datetime.fromtimestamp(
                real["created_utc"], tz=timezone.utc
            ).isoformat()
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'reddit', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, actual_sub, url, title[:300], body[:2000], f"r/{actual_sub}",
            datetime.now(timezone.utc).isoformat(), pub_at,
            json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sub", help="Only one subreddit by name")
    args = ap.parse_args()

    key = key_or_skip("TAVILY_API_KEY", "reddit_tavily")
    config = json.loads(config_path("reddit_subs.json").read_text())
    subs = config["subreddits"]
    if args.sub:
        subs = [s for s in subs if s["name"].lower() == args.sub.lower()]
        if not subs:
            sys.exit(f"Unknown sub {args.sub}")

    print(f"[{datetime.now(timezone.utc).isoformat()}] reddit_tavily subs={len(subs)}", file=sys.stderr)

    # Allowlist for the URL-subreddit check (case-insensitive)
    allowed_subs = {s["name"].lower() for s in config["subreddits"]}

    con = sqlite3.connect(str(db_path()))
    total = 0
    for sub_entry in subs:
        sub = sub_entry["name"]
        priority = sub_entry.get("priority", "med")
        query = f"site:reddit.com/r/{sub} (claude OR agent OR ai OR mcp OR ollama OR llm) new"
        results = tavily_search(query, key, max_results=sub_entry.get("max_results", 8))
        inserted = 0
        for post in results:
            if insert_post(con, post, sub, priority, allowed_subs):
                inserted += 1
        print(f"  r/{sub:25s}  {len(results):2d} results, {inserted} new", file=sys.stderr)
        total += inserted
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new Reddit posts.", file=sys.stderr)


if __name__ == "__main__":
    main()
