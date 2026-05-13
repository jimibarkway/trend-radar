#!/usr/bin/env python3
"""github_releases.py - poll canonical repos for new releases.

For each repo in config/github_repos.json, fetches /releases/latest and stores
any release we have not seen before as a raw_event.

Auth: optional GITHUB_TOKEN in env (env var or .env). Without it, the public
rate limit is 60 req/h per IP, so we shard (high every 5 min, med every 15).

Usage:
    python -m pipeline.scripts.ingest.github_releases
    python -m pipeline.scripts.ingest.github_releases --shard high
"""

import argparse
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path, optional_env


def gh_headers() -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "trend-radar/0.2",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = optional_env("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_latest_release(repo: str) -> dict | None:
    url = f"https://api.github.com/repos/{repo}/releases/latest"
    req = urllib.request.Request(url, headers=gh_headers())
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  ! {repo} HTTP {e.code}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ! {repo} {type(e).__name__}: {e}", file=sys.stderr)
        return None


def event_id(repo: str, tag: str) -> str:
    return f"gh_release:{repo}:{tag}"


def insert_event(con: sqlite3.Connection, repo: str, release: dict, priority: str) -> bool:
    tag = release.get("tag_name") or release.get("name", "")
    if not tag:
        return False
    eid = event_id(repo, tag)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False
    body = release.get("body") or ""
    engagement = {
        "is_prerelease": release.get("prerelease", False),
        "is_draft": release.get("draft", False),
        "asset_count": len(release.get("assets") or []),
        "priority": priority,
    }
    con.execute(
        """
        INSERT INTO raw_events
          (id, source, source_subtype, url, title, body_excerpt, author,
           ingested_at, published_at, engagement_raw)
        VALUES (?, 'github_release', ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            eid,
            release.get("name", "release"),
            release.get("html_url") or f"https://github.com/{repo}/releases/tag/{tag}",
            f"{repo} {tag}: {release.get('name','')}".strip(),
            body[:2000],
            repo,
            datetime.now(timezone.utc).isoformat(),
            release.get("published_at"),
            json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shard", choices=["all", "high", "med", "low"], default="all")
    args = ap.parse_args()

    config = json.loads(config_path("github_repos.json").read_text())
    repos = config["repos"]
    if args.shard != "all":
        repos = [r for r in repos if r.get("priority") == args.shard]

    print(f"[{datetime.now(timezone.utc).isoformat()}] github_releases shard={args.shard} repos={len(repos)}",
          file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    inserted = 0
    polled = 0
    for entry in repos:
        repo = entry["repo"]
        priority = entry.get("priority", "med")
        rel = fetch_latest_release(repo)
        polled += 1
        if rel and insert_event(con, repo, rel, priority):
            inserted += 1
            print(f"  + NEW: {repo} {rel.get('tag_name')}", file=sys.stderr)
    con.commit()
    con.close()
    print(f"Done. Polled {polled}, inserted {inserted} new.", file=sys.stderr)


if __name__ == "__main__":
    main()
