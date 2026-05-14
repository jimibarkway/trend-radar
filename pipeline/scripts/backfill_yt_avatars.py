#!/usr/bin/env python3
"""backfill_yt_avatars.py - one-shot tool to add channel_avatar_url to
existing youtube_upload / youtube_search events that were ingested before
the ingest scripts started capturing it.

Batched channels API calls (50 channel ids per call), so the whole backfill
is a handful of requests.

Usage:
    python -m pipeline.scripts.backfill_yt_avatars
"""

import json
import sqlite3
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, require_env

YT_API = "https://www.googleapis.com/youtube/v3"


def yt_get(path: str, params: dict, key: str) -> dict:
    params = {**params, "key": key}
    url = f"{YT_API}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode())


def main():
    key = require_env("YOUTUBE_API_KEY")
    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    rows = list(con.execute(
        "SELECT id, engagement_raw FROM raw_events "
        "WHERE source IN ('youtube_upload','youtube_search')"
    ))

    # Collect the channel ids that still need an avatar
    need: dict[str, list[tuple[str, dict]]] = {}
    for r in rows:
        eng = json.loads(r["engagement_raw"] or "{}")
        if eng.get("channel_avatar_url"):
            continue
        cid = eng.get("channel_id")
        if not cid:
            continue
        need.setdefault(cid, []).append((r["id"], eng))

    channel_ids = list(need.keys())
    print(f"{len(rows)} YouTube events, {len(channel_ids)} channels need avatars",
          file=sys.stderr)

    # Batched channels lookups, 50 ids per call
    avatar: dict[str, str] = {}
    for i in range(0, len(channel_ids), 50):
        batch = channel_ids[i : i + 50]
        try:
            data = yt_get("channels", {"part": "snippet", "id": ",".join(batch)}, key)
        except Exception as e:
            print(f"  ! channels call failed: {e}", file=sys.stderr)
            continue
        for ch in data.get("items", []):
            thumbs = ch.get("snippet", {}).get("thumbnails", {})
            avatar[ch["id"]] = (
                thumbs.get("medium", {}).get("url")
                or thumbs.get("default", {}).get("url")
                or ""
            )

    updated = 0
    for cid, events in need.items():
        url = avatar.get(cid)
        if not url:
            continue
        for eid, eng in events:
            eng["channel_avatar_url"] = url
            con.execute(
                "UPDATE raw_events SET engagement_raw = ? WHERE id = ?",
                (json.dumps(eng), eid),
            )
            updated += 1
    con.commit()
    con.close()
    print(f"Done. Backfilled channel_avatar_url on {updated} events.", file=sys.stderr)


if __name__ == "__main__":
    main()
