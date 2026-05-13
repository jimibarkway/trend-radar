#!/usr/bin/env python3
"""enrich_reddit.py - one-shot tool to backfill real Reddit engagement
(ups + num_comments + created_utc) on existing reddit events that were
ingested before reddit_tavily.py started enriching at ingest time.

Fetches Reddit's public JSON for each post, paced to stay under the ~60/min
unauthenticated rate limit. Updates engagement_raw, recomputes velocity and
composite, and uses created_utc as published_at where missing.

Usage:
    python -m pipeline.scripts.enrich_reddit
    python -m pipeline.scripts.enrich_reddit --limit 20
"""

import argparse
import json
import math
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path

REDDIT_UA = "trend-radar/0.2 (+https://github.com/jimibarkway/trend-radar)"


def post_id_from_url(url: str) -> str | None:
    m = re.search(r"/comments/([a-z0-9]+)/", url)
    return m.group(1) if m else None


def fetch_engagement(post_url: str) -> dict | None:
    pid = post_id_from_url(post_url)
    if not pid:
        return None
    api = f"https://www.reddit.com/comments/{pid}.json"
    req = urllib.request.Request(
        api, headers={"User-Agent": REDDIT_UA, "Accept": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
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
            time.sleep(5)
        return None
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="Cap how many to enrich")
    args = ap.parse_args()

    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    rows = list(con.execute(
        "SELECT id, url, engagement_raw, niche_score, freshness_score "
        "FROM raw_events WHERE source='reddit'"
    ))
    if args.limit:
        rows = rows[: args.limit]

    print(f"Enriching {len(rows)} Reddit events", file=sys.stderr)

    enriched = 0
    for row in rows:
        eng = json.loads(row["engagement_raw"] or "{}")
        if "ups" in eng:
            continue  # already enriched
        real = fetch_engagement(row["url"])
        if not real:
            time.sleep(1.1)
            continue
        eng.update(real)
        raw = (real["ups"] or 0) + (real["num_comments"] or 0) * 2
        velocity = min(10, math.log1p(raw) * 1.4)
        pub_at = None
        if real.get("created_utc"):
            pub_at = datetime.fromtimestamp(real["created_utc"], tz=timezone.utc).isoformat()
        niche = row["niche_score"] or 0
        fresh = row["freshness_score"] if row["freshness_score"] is not None else 5
        composite = round(niche * 5 + velocity * 3 + fresh * 2, 1)
        con.execute(
            "UPDATE raw_events SET engagement_raw = ?, velocity_score = ?, "
            "composite_score = ?, published_at = COALESCE(published_at, ?) "
            "WHERE id = ?",
            (json.dumps(eng), velocity, composite, pub_at, row["id"]),
        )
        con.commit()
        enriched += 1
        if enriched % 5 == 0:
            print(f"  enriched {enriched}", file=sys.stderr)
        time.sleep(1.1)  # ~55/min, under Reddit's ~60/min unauth limit

    print(f"Done. Enriched {enriched}/{len(rows)} Reddit events.", file=sys.stderr)
    con.close()


if __name__ == "__main__":
    main()
