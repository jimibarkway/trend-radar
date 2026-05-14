#!/usr/bin/env python3
"""backfill_yt_subs.py - one-shot: add channel_subscriber_count to existing
youtube_upload events.

The hidden_gems view used to key "small channel" off channel_median_views
(median views per video), which mislabelled high-subscriber channels with
modest per-video views as "under 50k subs". The view now keys off the real
subscriber count; this backfills it onto events ingested before the fix.

Batched channels API calls (50 channel ids per call).

Usage:
    python -m pipeline.scripts.backfill_yt_subs
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
        "SELECT id, engagement_raw FROM raw_events WHERE source='youtube_upload'"
    ))

    need: dict[str, list[tuple[str, dict]]] = {}
    for r in rows:
        eng = json.loads(r["engagement_raw"] or "{}")
        if eng.get("channel_subscriber_count"):
            continue
        cid = eng.get("channel_id")
        if not cid:
            continue
        need.setdefault(cid, []).append((r["id"], eng))

    channel_ids = list(need.keys())
    print(f"{len(rows)} youtube_upload events, {len(channel_ids)} channels need sub counts",
          file=sys.stderr)

    subs: dict[str, int] = {}
    for i in range(0, len(channel_ids), 50):
        batch = channel_ids[i : i + 50]
        try:
            data = yt_get("channels", {"part": "statistics", "id": ",".join(batch)}, key)
        except Exception as e:
            print(f"  ! channels call failed: {e}", file=sys.stderr)
            continue
        for ch in data.get("items", []):
            subs[ch["id"]] = int(ch.get("statistics", {}).get("subscriberCount", 0) or 0)

    updated = 0
    for cid, events in need.items():
        sub_count = subs.get(cid)
        if sub_count is None:
            continue
        for eid, eng in events:
            eng["channel_subscriber_count"] = sub_count
            con.execute(
                "UPDATE raw_events SET engagement_raw = ? WHERE id = ?",
                (json.dumps(eng), eid),
            )
            updated += 1
    con.commit()
    con.close()
    print(f"Done. Backfilled channel_subscriber_count on {updated} events.", file=sys.stderr)


if __name__ == "__main__":
    main()
