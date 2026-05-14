#!/usr/bin/env python3
"""export_snapshot.py - read SQLite, write snapshot.json.

Snapshot has the everything the dashboard needs in one fetch:
  - meta: counts, last_ingest, last_score, sources tracked
  - top_opportunities: top 50 by composite_score
  - top_clusters: top 10 multi-source clusters
  - hidden_gems: top 20 from the hidden_gems view
  - tomorrows_videos: top 5 with angle_json (if generate_angles.py has run)
  - sample_velocity: per-source velocity samples (for HowItWorks transparency)

Writes to:
  - <repo_root>/web/public/snapshot.json (local dev / docker-compose path)
  - Vercel Blob, if BLOB_READ_WRITE_TOKEN is set (production)

Usage:
    python -m pipeline.scripts.export_snapshot
    python -m pipeline.scripts.export_snapshot --no-blob   # local only
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, repo_root, optional_env


def fetch_event_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    if d.get("engagement_raw"):
        try:
            d["engagement"] = json.loads(d.pop("engagement_raw"))
        except Exception:
            d["engagement"] = None
            d.pop("engagement_raw", None)
    return d


def canonical_key(event: dict) -> str:
    """A stable identity for an event regardless of which source/day it came
    in on. Collapses 'same repo trending two days running' and 'same repo in
    trending + release' into one feed entry.

    - GitHub: owner/repo (so trending + release of the same repo dedupe)
    - YouTube: the video id
    - everything else: the URL itself
    """
    url = event.get("url", "") or ""
    m = re.search(r"github\.com/([^/]+)/([^/?#]+)", url)
    if m:
        return f"github:{m.group(1).lower()}/{m.group(2).lower().replace('.git', '')}"
    m = re.search(r"[?&]v=([A-Za-z0-9_-]+)", url)
    if m:
        return f"youtube:{m.group(1)}"
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]+)", url)
    if m:
        return f"youtube:{m.group(1)}"
    return url.rstrip("/").lower()


def dedupe_events(events: list[dict]) -> list[dict]:
    """Keep one event per canonical key - the highest composite, then the
    most recently ingested. Input is assumed sorted by composite desc."""
    seen: dict[str, dict] = {}
    for ev in events:
        key = canonical_key(ev)
        existing = seen.get(key)
        if existing is None:
            seen[key] = ev
            continue
        # Prefer higher composite; tie-break on more recent ingest
        ev_score = ev.get("composite_score") or 0
        ex_score = existing.get("composite_score") or 0
        if ev_score > ex_score or (
            ev_score == ex_score
            and (ev.get("ingested_at") or "") > (existing.get("ingested_at") or "")
        ):
            seen[key] = ev
    # Preserve composite-desc order
    return sorted(
        seen.values(),
        key=lambda e: e.get("composite_score") or 0,
        reverse=True,
    )


def build_snapshot(con: sqlite3.Connection) -> dict:
    con.row_factory = sqlite3.Row

    counts_by_source = {
        row["source"]: row["c"]
        for row in con.execute(
            "SELECT source, COUNT(*) AS c FROM raw_events GROUP BY source"
        )
    }
    total_events = sum(counts_by_source.values())

    meta_row = con.execute(
        "SELECT MAX(ingested_at) AS last_ingest, "
        "       MAX(CASE WHEN status='scored' THEN ingested_at END) AS last_score "
        "FROM raw_events"
    ).fetchone()

    # Fetch a wide pool, dedupe by canonical key (collapses the same repo
    # trending on consecutive days, or trending + release of one repo),
    # then take the top 50.
    opp_pool = [fetch_event_row(r) for r in con.execute(
        "SELECT * FROM raw_events "
        "WHERE composite_score IS NOT NULL "
        "ORDER BY composite_score DESC LIMIT 200"
    )]
    top_opportunities = dedupe_events(opp_pool)[:50]

    top_clusters_rows = con.execute(
        "SELECT * FROM clusters WHERE source_count >= 2 "
        "ORDER BY cluster_score DESC LIMIT 10"
    ).fetchall()
    top_clusters = []
    for c in top_clusters_rows:
        cd = dict(c)
        cd["sources"] = json.loads(cd.get("sources") or "[]")
        members = con.execute(
            "SELECT id, source, title, url, composite_score, published_at "
            "FROM raw_events WHERE cluster_id = ? ORDER BY composite_score DESC LIMIT 6",
            (cd["id"],),
        ).fetchall()
        cd["members"] = [dict(m) for m in members]
        top_clusters.append(cd)

    gem_pool = [fetch_event_row(r) for r in con.execute(
        "SELECT * FROM hidden_gems LIMIT 80"
    )]
    hidden_gems = dedupe_events(gem_pool)[:20]

    # tomorrows_videos = top-5 opportunities that already have angles
    tomorrows_videos = []
    for r in con.execute(
        "SELECT e.*, a.primary_title, a.alt_titles, a.hook_first_2_sentences, "
        "       a.outline_30s, a.generated_at AS angles_generated_at "
        "FROM raw_events e "
        "JOIN opportunity_angles a ON a.event_id = e.id "
        "WHERE e.composite_score IS NOT NULL "
        "ORDER BY e.composite_score DESC LIMIT 5"
    ):
        d = fetch_event_row(r)
        for k in ("alt_titles", "outline_30s"):
            try:
                d[k] = json.loads(d.get(k) or "[]")
            except Exception:
                d[k] = []
        tomorrows_videos.append(d)

    velocity_samples = [dict(r) for r in con.execute(
        "SELECT vs.metric_used, vs.raw_value, vs.velocity, "
        "       e.source, e.title, e.url "
        "FROM velocity_snapshots vs "
        "JOIN raw_events e ON e.id = vs.event_id "
        "ORDER BY vs.velocity DESC LIMIT 12"
    )]

    # Activity timeline - hourly ingest counts per source over the last 48h.
    # This is the real time-series the dashboard's trend chart renders. The
    # hourly cron builds this history naturally via each event's ingested_at.
    activity_timeline = build_activity_timeline(con, hours=48)

    return {
        "version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "total_events": total_events,
            "counts_by_source": counts_by_source,
            "last_ingest_at": meta_row["last_ingest"],
            "last_score_at": meta_row["last_score"],
            "sources_tracked": sorted(counts_by_source.keys()),
        },
        "top_opportunities": top_opportunities,
        "top_clusters": top_clusters,
        "hidden_gems": hidden_gems,
        "tomorrows_videos": tomorrows_videos,
        "velocity_samples": velocity_samples,
        "activity_timeline": activity_timeline,
    }


def build_activity_timeline(con: sqlite3.Connection, hours: int = 48) -> list[dict]:
    """48 hourly buckets of ingest counts per source. Every bucket has an
    entry for every source (zero-filled) so the stacked area chart on the
    dashboard has a clean, gap-free series to draw."""
    from datetime import timedelta

    rows = con.execute(
        "SELECT strftime('%Y-%m-%dT%H:00', ingested_at) AS hour, "
        "       source, COUNT(*) AS c "
        "FROM raw_events "
        "WHERE ingested_at > datetime('now', ?) "
        "GROUP BY hour, source",
        (f"-{hours} hours",),
    ).fetchall()

    sources = sorted({r["source"] for r in rows})
    by_hour: dict[str, dict[str, int]] = {}
    for r in rows:
        by_hour.setdefault(r["hour"], {})[r["source"]] = r["c"]

    # Build a continuous hour axis so the chart never has gaps, even for
    # hours where nothing was ingested.
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    timeline = []
    for i in range(hours, -1, -1):
        h = (now - timedelta(hours=i)).strftime("%Y-%m-%dT%H:00")
        counts = by_hour.get(h, {})
        bucket = {"hour": h, "total": sum(counts.values())}
        for s in sources:
            bucket[s] = counts.get(s, 0)
        timeline.append(bucket)
    return timeline


def write_local(snapshot: dict) -> Path:
    out = repo_root() / "web" / "public" / "snapshot.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot, indent=2, default=str))
    return out


def upload_to_blob(snapshot: dict, token: str) -> str | None:
    """Upload snapshot.json to Vercel Blob. Returns the public URL or None."""
    # Vercel Blob upload via the documented REST API:
    # PUT https://blob.vercel-storage.com/<pathname>  with Authorization Bearer <token>
    pathname = "snapshot.json"
    url = f"https://blob.vercel-storage.com/{pathname}"
    body = json.dumps(snapshot, default=str).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "x-content-type": "application/json",
            "x-add-random-suffix": "0",   # stable filename = stable URL
            "x-access": "public",
            "x-cache-control-max-age": "300",   # 5 min edge cache (we update hourly)
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            response = json.loads(r.read().decode())
        return response.get("url")
    except Exception as e:
        print(f"  ! Vercel Blob upload failed: {e}", file=sys.stderr)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-blob", action="store_true",
                    help="Skip Vercel Blob upload even if token is set")
    args = ap.parse_args()

    con = sqlite3.connect(str(db_path()))
    snapshot = build_snapshot(con)
    con.close()

    local = write_local(snapshot)
    print(f"Wrote {local} ({len(json.dumps(snapshot, default=str))} bytes)",
          file=sys.stderr)
    print(f"  events={snapshot['meta']['total_events']} "
          f"opps={len(snapshot['top_opportunities'])} "
          f"clusters={len(snapshot['top_clusters'])} "
          f"gems={len(snapshot['hidden_gems'])} "
          f"videos={len(snapshot['tomorrows_videos'])}", file=sys.stderr)

    token = optional_env("BLOB_READ_WRITE_TOKEN")
    if token and not args.no_blob:
        public_url = upload_to_blob(snapshot, token)
        if public_url:
            print(f"  uploaded to Vercel Blob: {public_url}", file=sys.stderr)
    elif args.no_blob:
        print("  (--no-blob set, skipping upload)", file=sys.stderr)
    else:
        print("  (no BLOB_READ_WRITE_TOKEN, skipping upload - local only)",
              file=sys.stderr)


if __name__ == "__main__":
    main()
