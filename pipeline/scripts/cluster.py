#!/usr/bin/env python3
"""cluster.py - cross-source convergence scoring via embedding clustering.

Pulls the last N hours of scored events, embeds each title with Gemini
text-embedding-004, and groups them by cosine similarity >= threshold. A
cluster spanning multiple sources scores higher than a single-source signal,
which is the core "convergence" insight: when GitHub, X, and Reddit all
mention the same topic in a 48-hour window, that is meaningfully different
from one off post.

Cluster score = max(member_composites) * ln(1 + member_count).

Writes to the `clusters` table and updates raw_events.cluster_id.

Usage:
    python -m pipeline.scripts.cluster
    python -m pipeline.scripts.cluster --window-hours 48 --threshold 0.82
"""

import argparse
import json
import math
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, require_env

EMBED_MODEL = "gemini-embedding-2"
EMBED_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:embedContent"
EMBED_SLEEP = 0.3  # ~200 RPM headroom


def embed_one(text: str, key: str, max_retries: int = 4) -> list[float] | None:
    payload = {"content": {"parts": [{"text": text[:500]}]}}
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                f"{EMBED_ENDPOINT}?key={key}",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=20) as r:
                body = json.loads(r.read().decode())
            return body["embedding"]["values"]
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep((attempt + 1) * 4)
                continue
            return None
        except Exception:
            return None
    return None


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def union_find_cluster(items: list[dict], embeddings: dict[str, list[float]],
                       threshold: float) -> dict[str, str]:
    """Greedy union-find. For each item, link it to an existing cluster
    centroid if cosine >= threshold; otherwise it becomes a new cluster."""
    cluster_of: dict[str, str] = {}
    centroids: list[tuple[str, list[float]]] = []  # (cluster_id, centroid_vec)
    for item in items:
        eid = item["id"]
        emb = embeddings.get(eid)
        if not emb:
            continue
        assigned = None
        for cid, centroid in centroids:
            if cosine(emb, centroid) >= threshold:
                assigned = cid
                break
        if assigned is None:
            assigned = f"cluster_{uuid.uuid4().hex[:10]}"
            centroids.append((assigned, emb))
        cluster_of[eid] = assigned
    return cluster_of


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--window-hours", type=int, default=48)
    ap.add_argument("--threshold", type=float, default=0.82)
    ap.add_argument("--limit", type=int, help="Cap items processed (dev)")
    args = ap.parse_args()

    key = require_env("GOOGLE_API_KEY")
    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    rows = con.execute(
        "SELECT id, title, source, composite_score, published_at, ingested_at "
        "FROM raw_events "
        "WHERE composite_score IS NOT NULL "
        "AND ingested_at > datetime('now', ?) "
        "ORDER BY composite_score DESC",
        (f"-{args.window_hours} hours",),
    ).fetchall()
    items = [dict(r) for r in rows]
    if args.limit:
        items = items[: args.limit]

    print(f"Clustering {len(items)} scored events (window={args.window_hours}h, "
          f"cosine>={args.threshold})", file=sys.stderr)

    # Embed each title (paced to stay under free-tier RPM).
    embeddings: dict[str, list[float]] = {}
    for i, item in enumerate(items, 1):
        emb = embed_one(item["title"], key)
        if emb:
            embeddings[item["id"]] = emb
        if i % 20 == 0:
            print(f"  embedded {i}/{len(items)}", file=sys.stderr)
        time.sleep(EMBED_SLEEP)

    cluster_of = union_find_cluster(items, embeddings, args.threshold)

    # Aggregate cluster stats
    by_cluster: dict[str, list[dict]] = {}
    for item in items:
        cid = cluster_of.get(item["id"])
        if not cid:
            continue
        by_cluster.setdefault(cid, []).append(item)

    # Wipe and rewrite the clusters table for this window
    con.execute("DELETE FROM clusters")
    multi_source_count = 0
    for cid, members in by_cluster.items():
        composite_max = max(m["composite_score"] for m in members)
        sources = sorted({m["source"] for m in members})
        score = round(composite_max * math.log1p(len(members)), 2)
        first_seen = min(m["ingested_at"] for m in members)
        last_seen = max(m["ingested_at"] for m in members)
        centroid_title = max(members, key=lambda m: m["composite_score"])["title"]
        if len(sources) >= 2:
            multi_source_count += 1
        con.execute(
            "INSERT INTO clusters "
            "(id, centroid_title, member_count, source_count, sources, "
            " max_composite, cluster_score, first_seen, last_seen, computed_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                cid, centroid_title[:200], len(members), len(sources),
                json.dumps(sources), composite_max, score,
                first_seen, last_seen,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        for m in members:
            con.execute("UPDATE raw_events SET cluster_id=? WHERE id=?", (cid, m["id"]))
    con.commit()
    con.close()

    print(f"Done. {len(by_cluster)} clusters total, "
          f"{multi_source_count} spanning 2+ sources.", file=sys.stderr)


if __name__ == "__main__":
    main()
