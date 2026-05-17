#!/usr/bin/env python3
"""polymarket.py - real-money prediction markets via Polymarket's free Gamma API.

Polymarket's Gamma API (gamma-api.polymarket.com) is free and unauthenticated.
We pull active, AI-tagged markets sorted by 24h volume - the volume is *real
money on the line*, which is the strongest non-vanity signal of attention
nobody else in the trend-tracker space has.

A market like 'Will GPT-5 launch in 2026?' with $50k volume at 65% YES is a
much stronger signal than a viral tweet, because traders have stake.

Usage:
    python -m pipeline.scripts.ingest.polymarket
"""

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent.parent))
from pipeline.lib.env import db_path, config_path

GAMMA_API = "https://gamma-api.polymarket.com/markets"

# AI keyword set used to filter the (mostly politics/sports) Polymarket
# catalogue down to AI-relevant markets. The scorer's LLM does precision
# filtering downstream, so we cast wide here.
AI_TOKENS = re.compile(
    r"\b(ai|llm|gpt|chatgpt|claude|anthropic|openai|gemini|"
    r"agi|deepmind|grok|meta ai|llama|ollama|mistral|hugging ?face|"
    r"perplexity|cursor|copilot|midjourney|sora|stable diffusion)\b",
    re.IGNORECASE,
)


def fetch_markets(limit: int = 200) -> list[dict]:
    """Pull active, non-closed markets sorted by 24h volume desc."""
    qs = urllib.parse.urlencode({
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false",
        "limit": limit,
    })
    req = urllib.request.Request(
        f"{GAMMA_API}?{qs}",
        headers={"User-Agent": "trend-radar/0.3", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            data = json.loads(r.read().decode())
        # Gamma returns a list directly (no envelope)
        return data if isinstance(data, list) else data.get("markets", [])
    except Exception as e:
        print(f"  ! Polymarket fetch err: {e}", file=sys.stderr)
        return []


def is_ai_market(m: dict) -> bool:
    text = " ".join(str(m.get(k, "")) for k in ("question", "description", "slug"))
    return bool(AI_TOKENS.search(text))


def event_id(market: dict) -> str:
    return f"polymarket:{market.get('id') or hashlib.sha256(str(market.get('slug','')).encode()).hexdigest()[:16]}"


def insert_market(con: sqlite3.Connection, m: dict) -> bool:
    eid = event_id(m)
    if con.execute("SELECT 1 FROM raw_events WHERE id = ?", (eid,)).fetchone():
        return False

    question = m.get("question") or ""
    if not question:
        return False
    slug = m.get("slug") or ""
    url = f"https://polymarket.com/event/{slug}" if slug else m.get("url", "")

    # Outcomes & prices come as JSON strings in some responses, raw arrays in
    # others. Normalise.
    def _parse(maybe_str):
        if isinstance(maybe_str, str):
            try:
                return json.loads(maybe_str)
            except Exception:
                return []
        return maybe_str or []

    outcomes = _parse(m.get("outcomes"))
    prices = _parse(m.get("outcomePrices"))
    # Build "YES 0.62 / NO 0.38" style summary
    odds = []
    for i, o in enumerate(outcomes):
        if i < len(prices):
            try:
                odds.append(f"{o} {float(prices[i]):.2f}")
            except Exception:
                pass
    odds_str = " / ".join(odds)

    engagement = {
        "volume_24hr": float(m.get("volume24hr") or 0),
        "volume_total": float(m.get("volume") or 0),
        "liquidity": float(m.get("liquidity") or 0),
        "odds": odds_str,
        "outcomes": outcomes,
        "outcome_prices": [float(p) for p in prices if str(p).replace(".", "", 1).isdigit()],
        "end_date": m.get("endDate"),
        "category": m.get("category"),
        "tags": m.get("tags"),
    }
    body = (m.get("description") or "")[:2000]
    con.execute(
        """INSERT INTO raw_events
             (id, source, source_subtype, url, title, body_excerpt, author,
              ingested_at, published_at, engagement_raw)
           VALUES (?, 'polymarket', ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            eid, (m.get("category") or "ai")[:50], url, question[:300],
            body, "polymarket",
            datetime.now(timezone.utc).isoformat(),
            m.get("startDate") or m.get("createdAt"),
            json.dumps(engagement),
        ),
    )
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200, help="Markets to scan")
    ap.add_argument("--min-volume-24h", type=float, default=500,
                    help="Drop markets with <$X 24h volume (signal threshold).")
    args = ap.parse_args()

    print(f"[{datetime.now(timezone.utc).isoformat()}] polymarket limit={args.limit}",
          file=sys.stderr)
    markets = fetch_markets(limit=args.limit)
    ai_markets = [m for m in markets if is_ai_market(m) and float(m.get("volume24hr") or 0) >= args.min_volume_24h]
    print(f"  fetched {len(markets)} active markets, {len(ai_markets)} AI-relevant", file=sys.stderr)

    con = sqlite3.connect(str(db_path()))
    inserted = sum(1 for m in ai_markets if insert_market(con, m))
    con.commit()
    con.close()
    print(f"Done. Inserted {inserted} new Polymarket markets.", file=sys.stderr)


if __name__ == "__main__":
    main()
