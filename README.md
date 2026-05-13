# Trend Radar

> Finds AI topics before they hit mainstream. Six sources. Velocity-scored, not popularity.

Most trend trackers show what's already big. By the time a topic is trending on a feed, the window to be early has closed. Trend Radar inverts that: it scores **velocity and cross-source convergence** across six signal sources, so the things that are *about to be* big surface first.

Built as a competition entry for [Jack Roberts' Trend Finder competition](https://github.com/Itssssss-Jack), May 2026.

**Live dashboard:** [trendradar.jimibarkway.com](https://trendradar.jimibarkway.com)

---

## The proof

`Launch HN: Voker (YC S24) - Analytics for AI Agents` was posted to Hacker News at **2026-05-12 15:45 UTC**.

Trend Radar ingested it at **2026-05-12 17:15 UTC**, scored it niche 9, composite 76, and surfaced it on the hidden-gems feed.

That's **90 minutes after launch** - hours before it would have shown up on Twitter For You, Reddit's r/MachineLearning, or anyone's morning newsletter. That's the window. That's the product.

---

## What it actually does

Six ingestion sources hit a SQLite event store hourly:

1. **GitHub releases** - canonical AI repos (Anthropic, OpenAI, n8n, LangChain, MCP, Ollama, Hermes, CrewAI, AutoGen). Polled every 5 min for new releases.
2. **GitHub trending** - daily scrape, filtered to AI keywords.
3. **YouTube uploads** - 43 AI-niche channels. Each video gets views-per-hour velocity *and* an outlier ratio against that channel's median, so a small channel posting a 10x outlier wins over a big channel posting an average video.
4. **YouTube search** - discovery queries to catch breakout creators who are not yet on the channel list.
5. **Reddit via Tavily** - 8 subs, ~240 searches/month on the free tier.
6. **RSS** - 18 feeds: Anthropic, OpenAI, DeepMind, HN, Latent Space, Simon Willison, Y Combinator, Hugging Face, more.
7. **X / Twitter via Apify** - keyword + `from:@account` watches, polled every 12h to stay cheap.

Every signal is scored by Gemini Flash-Lite on three axes:

- **Niche score** (0-10): how directly it sits in the creator's lane
- **Velocity score** (0-10): per-source - stars/day, views/hour vs channel median, upvotes/hour, comment velocity
- **Freshness score** (0-10): inverse of age

Composite = `(niche × 5) + (velocity × 3) + (freshness × 2)`. The velocity weighting is deliberately higher than popularity-based feeds - that's the bet.

### Convergence (the second-order signal)

When the same topic surfaces on GitHub *and* X *and* a YouTube channel inside a 48-hour window, that's meaningfully different from a single mention. Trend Radar clusters via Gemini `text-embedding-004` with cosine similarity ≥ 0.82, then scores each cluster:

`cluster_score = max(member_composites) × ln(1 + member_count)`

Multi-source clusters bubble to the top of the **Convergence Ticker**.

### Hidden gems (the unique filter)

A `hidden_gems` SQL view filters for the small-but-fast signals that mainstream trackers miss:

- GitHub repos under 1k stars
- YouTube channels under 50k subs
- X accounts under 50k followers
- Anything posted in the last 72 hours with velocity ≥ 7

This is where the Voker example came from.

### Tomorrow's Videos (the creative beat)

The dashboard has a "Tomorrow's Videos" panel: the top-5 opportunities passed through Gemini 2.5 Pro using the creator's voice rules to produce a primary title, 4 alt titles, the first 2 sentences of the spoken hook, and a 30-second outline. The voice prompt enforces a visceral-enemy hook in sentence two ("cost", "lost weekend", "broken setup", not abstract criticism) and bans em dashes / hype slop.

---

## Quick start

You need: Python 3.11+, Node 20+, a free [Google AI Studio key](https://aistudio.google.com/apikey) for scoring (and embeddings + angle generation if you want the wow features). Optional: a YouTube Data API key, a Tavily key for Reddit, an Apify token for X.

```bash
git clone https://github.com/jimibarkway/trend-radar
cd trend-radar
cp .env.example .env   # fill in at least GOOGLE_API_KEY

make install           # python + npm deps
make pipeline          # full run: init -> ingest -> score -> cluster -> angles -> snapshot
make dev               # http://localhost:3000
```

The dashboard reads `web/public/snapshot.json` locally and the Vercel Blob URL in production (set `NEXT_PUBLIC_SNAPSHOT_URL` and `BLOB_READ_WRITE_TOKEN`).

A seed snapshot ships with 495 real signals so the dashboard renders something on the first paint, before the pipeline has run.

---

## Repo layout

```
trend-radar/
├── pipeline/                Python ingestion + scoring + snapshot export
│   ├── sql/schema.sql
│   ├── lib/env.py
│   ├── config/              7 source configs + niche.json + x_keywords.example.json
│   └── scripts/
│       ├── init_db.py
│       ├── ingest/          (7 sources)
│       ├── score.py         Gemini Flash-Lite niche + velocity + composite
│       ├── cluster.py       text-embedding-004 cosine convergence
│       ├── generate_angles.py   Gemini 2.5 Pro voice-rules angle drafts
│       └── export_snapshot.py
├── web/                     Next.js 16 + Tailwind v4 dashboard
│   ├── src/lib/snapshot.ts
│   ├── src/components/      Hero, TopGem, ConvergenceTicker, FullFeed,
│   │                        TomorrowsVideos, HowItWorks, Footer
│   └── public/snapshot.json
├── docs/design-tokens.md    Locked Option A (Linear + radar-green) palette
├── PLAN.md                  13-day build plan with locked decisions
├── LOOM_SCRIPT.md           60-second product tour
├── Makefile                 install / init / pipeline / dev / build
├── .env.example
└── LICENSE
```

---

## Design notes

The dashboard is built around a single chromatic accent (radar-green `#59d499`) on a Linear-style dark canvas, with Raycast's saturated source-icon palette reserved strictly for source badges. No gradients, no drop shadows, no rounded-full CTAs, no em dashes - the anti-slop rules are documented in `docs/design-tokens.md` and enforced through every component.

Typography: Inter Display for headlines (80px / -3px tracking on the hero), Inter for body, Geist Mono for data.

---

## Why this should win

1. **It catches things early, provably.** The Voker 90-minute example is reproducible from the seed DB. No other trend tracker in this niche surfaces small-channel YouTube outliers or pre-mainstream HN launches in one feed.
2. **Convergence is a second-order signal nobody else scores.** Single-source mentions are noise; the same topic across GitHub, X, and Reddit inside 48 hours is meaningful. The cluster score makes that visible.
3. **The "Tomorrow's Videos" panel is a creative beat that turns the tracker into a production tool.** Most trackers stop at "here's what's hot." Trend Radar takes the next step and hands you a draft.
4. **It looks like a launch page, not a dashboard.** The aesthetic doesn't apologise for the data.
5. **Clean machine to working pipeline in 5 commands.** `make install && make pipeline && make dev`.

---

## License

MIT. See [LICENSE](LICENSE).
