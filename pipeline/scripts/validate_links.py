#!/usr/bin/env python3
"""validate_links.py - mark YouTube events whose video is no longer
publicly viewable (creator set it private, or deleted it).

A video can be ingested while public and go private hours later. Without
this check a dead link can sit at the top of the dashboard as "Today's Top
Hidden Gem" - exactly the amateur look we want to avoid.

Runs in the hourly cron between score and export. Batch-checks the YouTube
videos.status endpoint (50 ids/call) - a private or deleted video simply is
not returned, so anything missing from the response is marked
status='unavailable' and the snapshot export then skips it.

Usage:
    python -m pipeline.scripts.validate_links
"""

import json
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, key_or_skip

YT_API = "https://www.googleapis.com/youtube/v3"


def video_id(url: str) -> str | None:
    m = re.search(r"[?&]v=([\w-]+)", url or "")
    if m:
        return m.group(1)
    m = re.search(r"youtu\.be/([\w-]+)", url or "")
    return m.group(1) if m else None


def main():
    key = key_or_skip("YOUTUBE_API_KEY", "validate_links")
    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    # Only bother validating events that could actually appear in the
    # snapshot - scored, and not already marked unavailable.
    rows = list(con.execute(
        "SELECT id, url FROM raw_events "
        "WHERE source IN ('youtube_upload','youtube_search') "
        "AND composite_score IS NOT NULL "
        "AND (status IS NULL OR status != 'unavailable')"
    ))

    id_to_events: dict[str, list[str]] = {}
    for r in rows:
        vid = video_id(r["url"])
        if vid:
            id_to_events.setdefault(vid, []).append(r["id"])

    vids = list(id_to_events.keys())
    print(f"Validating {len(vids)} unique YouTube videos", file=sys.stderr)

    alive: set[str] = set()
    for i in range(0, len(vids), 50):
        batch = vids[i : i + 50]
        url = f"{YT_API}/videos?part=status&id={','.join(batch)}&key={key}"
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            print(f"  ! batch check failed: {e}", file=sys.stderr)
            # On API failure, treat the batch as alive - don't drop events
            # just because the validation call hiccuped.
            alive.update(batch)
            continue
        for item in data.get("items", []):
            status = item.get("status", {})
            if status.get("privacyStatus") in ("public", "unlisted"):
                alive.add(item["id"])

    dead = [v for v in vids if v not in alive]
    marked = 0
    for v in dead:
        for eid in id_to_events[v]:
            con.execute(
                "UPDATE raw_events SET status = 'unavailable' WHERE id = ?",
                (eid,),
            )
            marked += 1
    con.commit()
    con.close()
    print(
        f"Done. {len(alive)} videos alive, {len(dead)} dead/private "
        f"-> marked {marked} events unavailable.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
