#!/usr/bin/env python3
"""bluesky.py - Bluesky posts via the authenticated AppView API.

Bluesky's public.api.bsky.app returns 403 from hosting-provider IPs, same as
Reddit. We use an authenticated session instead - free, no quota burn,
needs only an app password (not your main password).

ONE-TIME SETUP:
  1. https://bsky.app/settings/app-passwords  ->  "Add App Password"
  2. Name it "trend-radar", copy the generated app password (looks like
     xxxx-xxxx-xxxx-xxxx)
  3. Add to repo .env:
        BLUESKY_HANDLE=yourhandle.bsky.social
        BLUESKY_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

The session token is created once per pipeline run and cached. The AI
early-adopter crowd is increasingly on Bluesky rather than X - this is
exactly the diversity diversify() in export_snapshot.py rewards.

Usage:
    python -m pipeline.scripts.ingest.bluesky
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
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, key_or_skip, optional_env

BSKY_API = "https://bsky.social/xrpc"   # auth host (works from hosting IPs)

_session: dict = {}


def get_session(handle: str, app_password: str) -> str:
    """Create an authenticated session, return accessJwt. Cached per process."""
    if _session.get("jwt"):
        return _session["jwt"]
    body = json.dumps({"identifier": handle, "password": app_password}).encode()
    req = urllib.request.Request(
        f"{BSKY_API}/com.atproto.server.createSession",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "trend-radar/0.3"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            resp = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"bluesky session create failed: HTTP {e.code} - check BLUESKY_HANDLE + BLUESKY_APP_PASSWORD")
    _session["jwt"] = resp["accessJwt"]
    return _session["jwt"]
DEFAULT_QUERIES = [
    "claude code", "anthropic claude",
    "ai agent", "mcp server", "ollama",
    "cursor ide", "windsurf", "ai automation",
]


def bsky_search(query: str, jwt: str, limit: int = 25, since: str | None = None) -> list[dict]:
    """app.bsky.feed.searchPosts - top sort, optional since (RFC3339).
    Uses the authenticated host (bsky.social) which works from hosting IPs."""
    params = {"q": query, "limit": limit, "sort": "top"}
    if since:
        params["since"] = since
    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{BSKY_API}/app.bsky.feed.searchPosts?{qs}",
        headers={
            "Authorization": f"Bearer {jwt}",
            "User-Agent": "trend-radar/0.3",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode()).get("posts", [])
    except Exception as e:
        print(f"  ! Bluesky err {query!r}: {e}", file=sys.stderr)
        return []


def event_id(post: dict) -> str:
    uri = post.get("uri", "")
    return "bsky:" + hashlib.sha256(uri.encode()).hexdigest()[:20]


def bsky_url(post: dict) -> str:
    """at://did:plc:.../app.bsky.feed.post/<rkey>  ->  bsky.app/profile/<handle>/post/<rkey>"""
    uri = post.get("uri", "")
    handle = (post.get("author") or {}).get("handle", "")
    rkey = uri.split("/")[-1] if "/" in uri else ""
    if handle and rkey:
        return f"https://bsky.app/profile/{handle}/post/{rkey}"
    return uri


def insert_post(con: sqlite3.Connection, post: dict, matched_query: str) -> bool:
    eid = event_id(post)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False

    record = post.get("record") or {}
    text = record.get("text") or ""
    if not text:
        return False
    author = post.get("author") or {}
    likes = int(post.get("likeCount") or 0)
    reposts = int(post.get("repostCount") or 0)
    replies = int(post.get("replyCount") or 0)
    created_at = record.get("createdAt") or ""

    age_hours = None
    if created_at:
        try:
            t = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            age_hours = round((datetime.now(timezone.utc) - t).total_seconds() / 3600, 1)
        except Exception:
            pass

    engagement = {
        "matched_query": matched_query,
        "likes": likes,
        "reposts": reposts,
        "replies": replies,
        "author_handle": author.get("handle"),
        "author_followers": int((author.get("viewer") or {}).get("followersCount", 0) or 0),
        "age_hours": age_hours,
        "likes_per_hour": round(likes / age_hours, 2) if age_hours else None,
    }
    # Title for the dashboard is the first ~140 chars of the post text.
    title = text.strip().splitlines()[0] if text else "(Bluesky post)"
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'bluesky', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, matched_query[:50], bsky_url(post), title[:300],
            text[:2000], author.get("handle") or "",
            datetime.now(timezone.utc).isoformat(),
            created_at, json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", help="Only one query")
    ap.add_argument("--lookback-hours", type=int, default=48)
    ap.add_argument("--limit-per-query", type=int, default=25)
    args = ap.parse_args()

    handle = key_or_skip("BLUESKY_HANDLE", "bluesky")
    app_pw = key_or_skip("BLUESKY_APP_PASSWORD", "bluesky")
    jwt = get_session(handle, app_pw)

    cfg_file = config_path("bluesky.json")
    if cfg_file.exists():
        cfg = json.loads(cfg_file.read_text())
        queries = cfg.get("queries", DEFAULT_QUERIES)
    else:
        queries = DEFAULT_QUERIES
    if args.query:
        queries = [args.query]

    since = (datetime.now(timezone.utc) - timedelta(hours=args.lookback_hours)).isoformat().replace("+00:00", "Z")
    print(f"[{datetime.now(timezone.utc).isoformat()}] bluesky queries={len(queries)}",
          file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    total = 0
    for q in queries:
        posts = bsky_search(q, jwt, limit=args.limit_per_query, since=since)
        inserted = sum(1 for p in posts if insert_post(con, p, q))
        print(f"  {q:25s} {len(posts):2d} posts, {inserted} new", file=sys.stderr)
        total += inserted
        time.sleep(0.5)
    con.commit()
    con.close()
    print(f"Done. Inserted {total} new Bluesky posts.", file=sys.stderr)


if __name__ == "__main__":
    main()
