#!/usr/bin/env python3
"""reddit_native.py - Reddit signal via Reddit's own OAuth read-only API.

Reddit has locked down its public unauthenticated endpoints (.json and .rss
both return 403 from hosting-provider IPs since 2023). We use the free
'installed app' OAuth flow instead - no user creds, no quota burn, just a
one-time client_id registration.

ONE-TIME SETUP:
  1. https://www.reddit.com/prefs/apps  ->  "are you a developer? create an app"
  2. Choose "installed app", name=trend-radar, redirect_uri=http://localhost
  3. Copy the client_id (the short string under "personal use script")
  4. Add to repo .env:
        REDDIT_CLIENT_ID=abc123XYZ
     (no secret needed for installed apps)

Then this script gets a clean app-only token and reads any subreddit's
listings at the proper 100 requests-per-minute limit. Free, no Tavily.

Usage:
    python -m pipeline.scripts.ingest.reddit_native
    python -m pipeline.scripts.ingest.reddit_native --sub LocalLLaMA
"""

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, key_or_skip

REDDIT_UA = "trend-radar/0.3 (by /u/jimibarkway; https://github.com/jimibarkway/trend-radar)"
DEVICE_ID = "DO_NOT_TRACK_THIS_DEVICE"
TOKEN_ENDPOINT = "https://www.reddit.com/api/v1/access_token"
OAUTH_BASE = "https://oauth.reddit.com"

# Module-level token cache (single pipeline run reuses one token).
_token: dict = {}


def get_app_only_token(client_id: str) -> str:
    """OAuth2 'installed_client' grant - app-only, no user context, read-only.
    Token is valid ~1 hour; we cache for the process lifetime."""
    if _token.get("access_token") and _token.get("expires_at", 0) > time.time() + 60:
        return _token["access_token"]
    data = urllib.parse.urlencode({
        "grant_type": "https://oauth.reddit.com/grants/installed_client",
        "device_id": DEVICE_ID,
    }).encode()
    # Basic auth with empty password (installed apps have no secret).
    import base64
    creds = base64.b64encode(f"{client_id}:".encode()).decode()
    req = urllib.request.Request(TOKEN_ENDPOINT, data=data, headers={
        "Authorization": f"Basic {creds}",
        "User-Agent": REDDIT_UA,
        "Content-Type": "application/x-www-form-urlencoded",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")[:200]
        sys.exit(f"reddit oauth failed: HTTP {e.code} {body}\n"
                 f"Check REDDIT_CLIENT_ID is a valid 'installed app' client_id.")
    tok = resp["access_token"]
    _token["access_token"] = tok
    _token["expires_at"] = time.time() + int(resp.get("expires_in", 3600))
    return tok


def reddit_listing(sub: str, sort: str, t: str, limit: int, token: str) -> list[dict]:
    """Call oauth.reddit.com - the authenticated host that's not IP-blocked."""
    path = f"/r/{sub}/{sort}.json"
    qs = urllib.parse.urlencode({"limit": limit, "t": t} if sort == "top"
                                else {"limit": limit})
    req = urllib.request.Request(f"{OAUTH_BASE}{path}?{qs}", headers={
        "Authorization": f"Bearer {token}",
        "User-Agent": REDDIT_UA,
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(8)
        print(f"  ! Reddit HTTP {e.code} for r/{sub}/{sort}", file=sys.stderr)
        return []
    except Exception as e:
        print(f"  ! Reddit err r/{sub}/{sort}: {e}", file=sys.stderr)
        return []

    out = []
    for c in data.get("data", {}).get("children", []):
        d = c.get("data", {})
        if d.get("stickied") or d.get("removed_by_category"):
            continue
        permalink = d.get("permalink")
        if not permalink:
            continue
        out.append({
            "url": "https://www.reddit.com" + permalink,
            "title": d.get("title", ""),
            "body": d.get("selftext", "") or "",
            "subreddit": d.get("subreddit", sub),
            "author": d.get("author", ""),
            "ups": int(d.get("ups", 0)),
            "score": int(d.get("score", 0)),
            "num_comments": int(d.get("num_comments", 0)),
            "upvote_ratio": float(d.get("upvote_ratio", 0)),
            "created_utc": int(d.get("created_utc", 0)),
        })
    return out


def event_id(url: str) -> str:
    return "reddit:" + hashlib.sha256(url.encode()).hexdigest()[:20]


def insert_post(con: sqlite3.Connection, post: dict, searched_sub: str,
                priority: str, allowed_subs: set[str]) -> bool:
    url = post["url"]
    if "/comments/" not in url:
        return False
    actual_sub = post.get("subreddit", "")
    if not actual_sub or actual_sub.lower() not in allowed_subs:
        return False
    eid = event_id(url)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False

    engagement = {
        "subreddit": actual_sub,
        "searched_sub": searched_sub,
        "priority": priority,
        "ups": post["ups"],
        "score": post["score"],
        "num_comments": post["num_comments"],
        "upvote_ratio": post["upvote_ratio"],
        "created_utc": post["created_utc"],
    }
    pub_at = None
    if post["created_utc"]:
        pub_at = datetime.fromtimestamp(post["created_utc"], tz=timezone.utc).isoformat()

    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'reddit', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, actual_sub, url, post["title"][:300], post["body"][:2000],
            f"r/{actual_sub}",
            datetime.now(timezone.utc).isoformat(), pub_at,
            json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sub", help="Only one subreddit by name")
    ap.add_argument("--sorts", default="top,hot",
                    help="Comma-separated listings per sub (top|hot|new|rising)")
    ap.add_argument("--limit", type=int, default=25, help="Posts per listing")
    args = ap.parse_args()

    client_id = key_or_skip("REDDIT_CLIENT_ID", "reddit_native")
    token = get_app_only_token(client_id)

    config = json.loads(config_path("reddit_subs.json").read_text())
    subs = config["subreddits"]
    if args.sub:
        subs = [s for s in subs if s["name"].lower() == args.sub.lower()]
        if not subs:
            sys.exit(f"Unknown sub {args.sub}")

    sorts = [s.strip() for s in args.sorts.split(",") if s.strip()]
    allowed_subs = {s["name"].lower() for s in config["subreddits"]}

    print(f"[{datetime.now(timezone.utc).isoformat()}] reddit_native "
          f"subs={len(subs)} sorts={sorts}", file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total = 0
    for sub_entry in subs:
        sub = sub_entry["name"]
        priority = sub_entry.get("priority", "med")
        inserted_for_sub = 0
        for sort in sorts:
            posts = reddit_listing(sub, sort=sort, t="day", limit=args.limit, token=token)
            for p in posts:
                if insert_post(con, p, sub, priority, allowed_subs):
                    inserted_for_sub += 1
            time.sleep(0.7)  # 100 req/min cap = ~600ms/req minimum
        print(f"  r/{sub:25s}  +{inserted_for_sub}", file=sys.stderr)
        total += inserted_for_sub
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new Reddit posts.", file=sys.stderr)


if __name__ == "__main__":
    main()
