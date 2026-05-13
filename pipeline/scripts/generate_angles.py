#!/usr/bin/env python3
"""generate_angles.py - turn top opportunities into ready-to-record drafts.

For each of the top-N composite-scored events that does NOT yet have an
angle, ask Gemini Pro to produce:
  - 1 primary title
  - 4 alt titles
  - first 2 sentences of the spoken hook (the visceral-enemy hook is rule #1)
  - a 30-second outline (4-6 beats)

Writes to opportunity_angles. This is what powers the dashboard's "Tomorrow's
Videos" panel - the creative wow-moment of the entry.

Usage:
    python -m pipeline.scripts.generate_angles
    python -m pipeline.scripts.generate_angles --top 5 --model gemini-2.5-pro
"""

import argparse
import json
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from pipeline.lib.env import db_path, config_path, require_env

DEFAULT_MODEL = "gemini-2.5-pro"

VOICE_RULES = """VOICE RULES (these are non-negotiable):

1. Casual-professional, second-person dominant. The voice of someone who
   uses these tools daily and translates them into plain language. Confident
   without being stiff or academic.

2. The first sentence is the HOOK. Lead with a capability or transformation
   statement. The SECOND sentence MUST name a pain the viewer feels in their
   body or wallet right now: cost, privacy, lost weekend, vendor lock-in,
   broken setup. Abstract criticism of how people behave does not land.

3. State with certainty. No hedging language ("I think", "this could be useful").

4. Include a "you don't need X" line widening the audience ("even if you have
   no coding experience").

5. Banned words/phrases (these signal AI-written content):
   - em dash (`-` U+2014) or en dash (`-` U+2013). Use ` - ` (hyphen + spaces)
     or a full stop instead.
   - "tasty", "juicy", "delicious" framings
   - "smash that like button", "let's dive in", "without further ado"
   - hype slop: "INSANE", "MIND-BLOWING", "GAME-CHANGING" (UNLESS the title
     uses one ALL-CAPS power word - that is acceptable in titles only, not in
     spoken hooks)

6. Title formula that works: "Tool A + Tool B = $X Outcome", or "How to
   [outcome] with [tool]". Dollar amounts and "FREE" land. One power word in
   caps, not more.

7. Length: 30-second outline = 4-6 beats. Each beat one short sentence.
"""

PROMPT_TEMPLATE = """You are a YouTube title and hook writer for a creator in this niche:

{niche_description}

{voice_rules}

The trending signal:
- Source: {source}
- Title: {title}
- Author: {author}
- URL: {url}
- Published: {published}
- Body excerpt: {body}
- Composite score: {composite} (LLM-judged niche fit + velocity + freshness, 0-100)

Produce a ready-to-record video draft. Return strict JSON ONLY:

{{
  "primary_title": "60-70 chars, one ALL-CAPS power word allowed",
  "alt_titles": ["alt 1", "alt 2", "alt 3", "alt 4"],
  "hook_first_2_sentences": "Sentence one is the capability/transformation. Sentence two names a felt pain (cost, privacy, lost time, broken setup).",
  "outline_30s": [
    "Beat 1 - the hook",
    "Beat 2 - the problem this kills",
    "Beat 3 - the demo or proof",
    "Beat 4 - the so-what / business outcome",
    "Beat 5 (optional) - the catch / caveat",
    "Beat 6 (optional) - the call to action"
  ]
}}"""


def ask_gemini(prompt: str, key: str, model: str, max_retries: int = 4) -> dict | None:
    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.7,
        },
    }
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                f"{endpoint}?key={key}",
                data=json.dumps(payload).encode(),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=60) as r:
                body = json.loads(r.read().decode())
            text = body["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep((attempt + 1) * 8)
                continue
            print(f"  ! Gemini HTTP {e.code}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"  ! Gemini error: {e}", file=sys.stderr)
            return None
    return None


def clean_dashes(text: str) -> str:
    """Hard guarantee: no em or en dashes ship from this generator."""
    return text.replace("—", " - ").replace("–", " - ")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--force", action="store_true",
                    help="Regenerate even if angles already exist")
    args = ap.parse_args()

    key = require_env("GOOGLE_API_KEY")
    niche = json.loads(config_path("niche.json").read_text())["description"]
    con = sqlite3.connect(str(db_path()))
    con.row_factory = sqlite3.Row

    if args.force:
        rows = con.execute(
            "SELECT * FROM raw_events WHERE composite_score IS NOT NULL "
            "ORDER BY composite_score DESC LIMIT ?", (args.top,)
        ).fetchall()
    else:
        rows = con.execute(
            "SELECT e.* FROM raw_events e "
            "LEFT JOIN opportunity_angles a ON a.event_id = e.id "
            "WHERE e.composite_score IS NOT NULL AND a.event_id IS NULL "
            "ORDER BY e.composite_score DESC LIMIT ?", (args.top,)
        ).fetchall()

    print(f"Generating angles for {len(rows)} opportunities via {args.model}",
          file=sys.stderr)

    generated = 0
    for row in rows:
        event = dict(row)
        prompt = PROMPT_TEMPLATE.format(
            niche_description=niche,
            voice_rules=VOICE_RULES,
            source=event["source"],
            title=event["title"],
            author=event.get("author") or "",
            url=event["url"],
            published=event.get("published_at") or "?",
            body=(event.get("body_excerpt") or "")[:1000],
            composite=event["composite_score"],
        )
        result = ask_gemini(prompt, key, args.model)
        if not result:
            print(f"  ! skip: {event['title'][:60]}", file=sys.stderr)
            continue

        primary = clean_dashes(result.get("primary_title", ""))
        alts = [clean_dashes(t) for t in result.get("alt_titles", [])]
        hook = clean_dashes(result.get("hook_first_2_sentences", ""))
        outline = [clean_dashes(b) for b in result.get("outline_30s", [])]

        con.execute(
            "INSERT OR REPLACE INTO opportunity_angles "
            "(event_id, primary_title, alt_titles, hook_first_2_sentences, "
            " outline_30s, generated_at, model) VALUES (?,?,?,?,?,?,?)",
            (event["id"], primary, json.dumps(alts), hook, json.dumps(outline),
             datetime.now(timezone.utc).isoformat(), args.model),
        )
        con.commit()
        generated += 1
        print(f"  + {primary}", file=sys.stderr)
        time.sleep(1.5)  # Pace Pro tier
    con.close()
    print(f"Generated angles for {generated} opportunities.", file=sys.stderr)


if __name__ == "__main__":
    main()
