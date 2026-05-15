#!/usr/bin/env python3
"""cluster.py - cross-source convergence via HDBSCAN over Gemini embeddings.

Density-based clustering (HDBSCAN) replaces the previous fixed-threshold
cosine union-find. Per the NotebookLM research, a static cosine threshold
(0.82) imposes a "global density" assumption that streaming text doesn't
honour - HDBSCAN's mutual reachability distance + core distance adapt to
local density, which means:

  - Clusters of varying tightness can co-exist (a tight "Claude Code" cluster
    next to a loose "AI agent" cluster, both extracted correctly)
  - Outliers stay as outliers instead of being force-joined to the nearest
    cluster the way union-find does
  - No threshold to hand-tune

We L2-normalize each embedding so the default euclidean metric is
equivalent to cosine similarity (dist = sqrt(2 - 2*cos_sim)). Then HDBSCAN
runs in milliseconds even at thousands of points.

Cluster scoring (unchanged):
  cluster_score = max(member_composites) * ln(1 + member_count)

Usage:
    python -m pipeline.scripts.cluster
    python -m pipeline.scripts.cluster --window-hours 96 --min-cluster-size 2
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

import numpy as np
import hdbscan

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, require_env

EMBED_MODEL = "gemini-embedding-2"
EMBED_ENDPOINT = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBED_MODEL}:embedContent"
EMBED_SLEEP = 0.3


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


def l2_normalize(vec: list[float]) -> np.ndarray:
    arr = np.array(vec, dtype=np.float32)
    n = np.linalg.norm(arr)
    return arr / n if n > 0 else arr


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--window-hours", type=int, default=96)
    ap.add_argument(
        "--min-cluster-size",
        type=int,
        default=2,
        help="Minimum events to form a cluster (default 2)",
    )
    ap.add_argument(
        "--min-samples",
        type=int,
        default=1,
        help="HDBSCAN min_samples (lower = more clusters, more permissive)",
    )
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    key = require_env("GOOGLE_API_KEY")
    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    rows = con.execute(
        "SELECT id, title, source, composite_score, published_at, ingested_at "
        "FROM raw_events "
        "WHERE composite_score IS NOT NULL "
        "AND (status IS NULL OR status != 'unavailable') "
        "AND datetime(ingested_at) > datetime('now', ?) "
        "ORDER BY composite_score DESC",
        (f"-{args.window_hours} hours",),
    ).fetchall()
    items = [dict(r) for r in rows]
    if args.limit:
        items = items[: args.limit]

    print(f"Clustering {len(items)} scored events (window={args.window_hours}h, "
          f"min_cluster_size={args.min_cluster_size}, HDBSCAN)", file=sys.stderr)

    # Embed each title
    embeddings: dict[str, np.ndarray] = {}
    for i, item in enumerate(items, 1):
        emb = embed_one(item["title"], key)
        if emb:
            embeddings[item["id"]] = l2_normalize(emb)
        if i % 20 == 0:
            print(f"  embedded {i}/{len(items)}", file=sys.stderr)
        time.sleep(EMBED_SLEEP)

    # Build the matrix in the order of items that have embeddings
    have_emb = [it for it in items if it["id"] in embeddings]
    if not have_emb:
        print("No embeddings - aborting cluster.", file=sys.stderr)
        return
    X = np.stack([embeddings[it["id"]] for it in have_emb])

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=args.min_cluster_size,
        min_samples=args.min_samples,
        metric="euclidean",  # equivalent to cosine on L2-normalized vectors
        cluster_selection_method="eom",
        allow_single_cluster=False,
    )
    labels = clusterer.fit_predict(X)
    # label -1 = noise; non-negative ints = cluster ids
    print(f"HDBSCAN: {(labels >= 0).sum()} clustered, {(labels == -1).sum()} noise",
          file=sys.stderr)

    # Group events by cluster label
    by_cluster: dict[int, list[dict]] = {}
    for it, lab in zip(have_emb, labels):
        if lab == -1:
            continue
        by_cluster.setdefault(int(lab), []).append(it)

    # Wipe and rewrite the clusters table for this window
    con.execute("DELETE FROM clusters")
    multi_source_count = 0
    for lab, members in by_cluster.items():
        composite_max = max(m["composite_score"] for m in members)
        sources = sorted({m["source"] for m in members})
        score = round(composite_max * math.log1p(len(members)), 2)
        first_seen = min(m["ingested_at"] for m in members)
        last_seen = max(m["ingested_at"] for m in members)
        centroid_title = max(members, key=lambda m: m["composite_score"])["title"]
        if len(sources) >= 2:
            multi_source_count += 1
        cid = f"hdb_{uuid.uuid4().hex[:10]}"
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

    print(f"Done. {len(by_cluster)} clusters, {multi_source_count} spanning 2+ sources.",
          file=sys.stderr)


if __name__ == "__main__":
    main()
