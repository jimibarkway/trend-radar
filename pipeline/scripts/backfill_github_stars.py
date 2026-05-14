#!/usr/bin/env python3
"""backfill_github_stars.py - one-shot fix for github_trending events whose
stars_total was 0 (the HTML scrape for the total-star badge was broken and
silently returned 0 for every repo, which mislabelled large repos as
"small repo, under 1k stars" in the hidden_gems view).

Fetches the authoritative stargazers_count from the GitHub API for every
github_trending event and rewrites engagement_raw.stars_total.

Usage:
    python -m pipeline.scripts.backfill_github_stars
"""

import json
import sqlite3
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, optional_env


def stargazers(repo_path: str, token: str | None) -> int | None:
    headers = {
        "User-Agent": "trend-radar/0.2",
        "Accept": "application/vnd.github+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo_path}", headers=headers
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        return int(data.get("stargazers_count", 0))
    except Exception as e:
        print(f"  ! {repo_path}: {str(e)[:70]}", file=sys.stderr)
        return None


def main():
    token = optional_env("GITHUB_TOKEN")
    if not token:
        print("(no GITHUB_TOKEN - using unauthenticated limit, 60/hr)", file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row
    rows = list(con.execute(
        "SELECT id, title, engagement_raw FROM raw_events WHERE source='github_trending'"
    ))
    print(f"Backfilling stars_total for {len(rows)} github_trending events",
          file=sys.stderr)

    fixed = 0
    for r in rows:
        repo_path = r["title"]  # github_trending title is "owner/repo"
        if "/" not in repo_path:
            continue
        stars = stargazers(repo_path, token)
        if stars is None:
            continue
        eng = json.loads(r["engagement_raw"] or "{}")
        eng["stars_total"] = stars
        con.execute(
            "UPDATE raw_events SET engagement_raw = ? WHERE id = ?",
            (json.dumps(eng), r["id"]),
        )
        fixed += 1
        if fixed % 10 == 0:
            print(f"  ...{fixed}/{len(rows)}", file=sys.stderr)
        time.sleep(0.1)
    con.commit()
    con.close()
    print(f"Done. Backfilled stars_total on {fixed} events.", file=sys.stderr)


if __name__ == "__main__":
    main()
