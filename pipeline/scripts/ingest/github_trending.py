#!/usr/bin/env python3
"""github_trending.py - daily snapshot of github trending pages.

GitHub Trending has no official API. We scrape the HTML at
https://github.com/trending and filter to repos matching the AI keyword set.
Each repo gets stored with its "stars today / week" number as a velocity proxy.

Usage:
    python -m pipeline.scripts.ingest.github_trending
    python -m pipeline.scripts.ingest.github_trending --window weekly
"""

import argparse
import json
import re
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, optional_env

UA = "Mozilla/5.0 (X11; Linux x86_64) trend-radar/0.2"


def github_stargazers(repo_path: str) -> int | None:
    """Authoritative total star count from the GitHub API. The trending page
    HTML markup for the total-stars badge changes often and the regex scrape
    is unreliable (it had silently been returning 0 for every repo). The API
    is the source of truth. Uses GITHUB_TOKEN if available (5000/hr) else the
    unauthenticated limit (60/hr). Returns None on failure."""
    token = optional_env("GITHUB_TOKEN")
    headers = {"User-Agent": "trend-radar/0.2", "Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo_path}", headers=headers
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        return int(data.get("stargazers_count", 0))
    except Exception:
        return None


def fetch_trending(since: str = "daily") -> str:
    url = f"https://github.com/trending?since={since}"
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode()


def parse_trending(html: str) -> list[dict]:
    rows = re.findall(r'<article class="Box-row">(.+?)</article>', html, flags=re.DOTALL)
    out = []
    for row in rows:
        m = re.search(r'<h2[^>]*>\s*<a[^>]*href="/([^"]+)"', row)
        if not m:
            continue
        path = m.group(1).strip()
        if "/" not in path:
            continue
        owner, name = path.split("/", 1)
        desc_m = re.search(r'<p[^>]*class="col-9[^"]*"[^>]*>(.*?)</p>', row, flags=re.DOTALL)
        description = ""
        if desc_m:
            description = re.sub(r"<[^>]+>", "", desc_m.group(1)).strip()
            description = re.sub(r"\s+", " ", description)
        lang_m = re.search(r'<span[^>]*itemprop="programmingLanguage">([^<]+)</span>', row)
        language = lang_m.group(1) if lang_m else ""
        stars_m = re.search(r'(\d[\d,]*)\s+stars?\s+(?:today|this)', row, flags=re.IGNORECASE)
        stars_period = int(stars_m.group(1).replace(",", "")) if stars_m else 0
        # stars_total comes from the GitHub API in main() - the HTML badge
        # for it is unreliable to scrape.
        out.append({
            "owner": owner, "name": name, "description": description,
            "language": language, "stars_period": stars_period, "stars_total": 0,
        })
    return out


def matches_keywords(text: str, keywords: list[str]) -> bool:
    lower = text.lower()
    return any(k in lower for k in keywords)


def event_id(repo: str, snapshot_date: str) -> str:
    return f"gh_trending:{repo}:{snapshot_date}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--window", choices=["daily", "weekly", "monthly"], default="daily")
    args = ap.parse_args()

    print(f"[{datetime.now(timezone.utc).isoformat()}] github_trending window={args.window}", file=sys.stderr)

    keywords = json.loads(config_path("rss_feeds.json").read_text()).get("keyword_filter", [])
    html = fetch_trending(args.window)
    repos = parse_trending(html)
    print(f"  Scraped {len(repos)} repos from /trending?since={args.window}", file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    inserted = 0
    for r in repos:
        repo_path = f"{r['owner']}/{r['name']}"
        haystack = f"{repo_path} {r['description']} {r['language']}"
        if not matches_keywords(haystack, keywords):
            continue
        eid = event_id(repo_path, today)
        if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
            continue
        # Authoritative total star count from the API (the HTML scrape for
        # this was silently returning 0 for every repo).
        stars_total = github_stargazers(repo_path)
        if stars_total is not None:
            r["stars_total"] = stars_total
        engagement = {**r, "window": args.window, "snapshot_date": today}
        con.execute(
            """INSERT INTO raw_events
               (id, source, source_subtype, url, title, body_excerpt, author,
                ingested_at, published_at, engagement_raw)
               VALUES (?, 'github_trending', ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                eid, args.window, f"https://github.com/{repo_path}",
                repo_path, r["description"][:2000], r["owner"],
                datetime.now(timezone.utc).isoformat(),
                datetime.now(timezone.utc).isoformat(),
                json.dumps(engagement),
            ),
        )
        inserted += 1
        print(f"  + {repo_path}  ({r['stars_period']} stars {args.window})", file=sys.stderr)
    con.commit()
    con.close()
    print(f"Done. Inserted {inserted} trending repos matching AI keywords.", file=sys.stderr)


if __name__ == "__main__":
    main()
