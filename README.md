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

### See it in 60 seconds (no API keys)

The repo ships a seed `snapshot.json` with real data, so you can see the full dashboard before touching a single key:

```bash
git clone https://github.com/jimibarkway/trend-radar
cd trend-radar
make demo            # npm install + dev server -> http://localhost:3000
```

That's it. Real signals, real clusters, real angle drafts - the bundled snapshot.

### Run your own pipeline

When you want it pulling live data for your niche, you need Python 3.11+, Node 20+, and at minimum a free [Google AI Studio key](https://aistudio.google.com/apikey) (Gemini does the scoring, clustering, and angle generation).

```bash
cp .env.example .env   # paste in GOOGLE_API_KEY - that alone is enough to start

make install           # python + npm deps
make pipeline          # init -> ingest -> score -> cluster -> angles -> snapshot
make dev               # http://localhost:3000
```

`make pipeline` works with **only** `GOOGLE_API_KEY`. Sources whose key you haven't set (YouTube, Reddit, X) skip themselves cleanly and the run continues - you'll still get GitHub releases, GitHub trending, and RSS scored and clustered. Add the other keys when you want those sources too (see the table below).

The dashboard reads `web/public/snapshot.json` locally and the Vercel Blob URL in production (set `NEXT_PUBLIC_SNAPSHOT_URL` and `BLOB_READ_WRITE_TOKEN`).

### Optional TweetClaw source review

If you already use Xquik or OpenClaw, [TweetClaw](https://github.com/Xquik-dev/tweetclaw)
can review X/Twitter search exports, account lists, or monitor results before
they become `x_keywords.json` watches. Keep Trend Radar responsible for
ingestion, scoring, convergence clustering, hidden-gem filters, and angle
generation; use TweetClaw only to make the X/Twitter source packet easier to
inspect before a scheduled pipeline run.

---

## Fork it for your niche

This repo is wired for AI / agentic-workflow content. To point it at your niche:

### 1. Get the keys

| Key | Required? | Where to get it | What it does |
|---|---|---|---|
| `GOOGLE_API_KEY` | **Required** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Gemini Flash-Lite scoring, embeddings, angle generation. Free tier is enough. |
| `YOUTUBE_API_KEY` | Recommended | [console.cloud.google.com](https://console.cloud.google.com) → enable "YouTube Data API v3" | YouTube channel + search ingestion |
| `TAVILY_API_KEY` | Optional | [tavily.com](https://tavily.com) | Reddit ingestion. 1000 searches/mo free. |
| `APIFY_TOKEN` | Optional | [console.apify.com](https://console.apify.com) | X / Twitter ingestion. Paid, ~£0.20/mo at 12h cadence. |
| `BLOB_READ_WRITE_TOKEN` | Production only | Vercel project → Storage → Blob → Create | Hosts the live snapshot.json. Free hobby tier. |

Copy `.env.example` to `.env` and paste them in. `.env` is gitignored.

### 2. Tell the LLM what your niche is

Edit `pipeline/config/niche.json` and rewrite the `description` field for your creator focus. This is the system prompt the scoring LLM uses to rate every signal 0-10 for relevance. Be specific about what counts and what doesn't.

### 3. Tell the pipeline where to look

Each source has its own config in `pipeline/config/`:

- `channels.json` - YouTube channels in your niche (need `channel_id`, get from the channel's About page → ⚙️ Share → Channel ID)
- `github_repos.json` - canonical repos to poll for releases (`owner/repo` format, priority high/med/low)
- `rss_feeds.json` - RSS feeds + the keyword filter for "filter_required: true" feeds
- `reddit_subs.json` - subreddits to query via Tavily
- `youtube_searches.json` - generic search queries that catch viral videos outside your channel list
- `x_keywords.example.json` - copy to `x_keywords.json` and add your keywords + `from:@account` watches

### 4. Rebrand the dashboard

The repo currently ships with Jimi Barkway's name on the public dashboard. For your fork:

- `LICENSE` - swap the copyright line to your name
- `web/src/components/Footer.tsx` - update the byline + YouTube link
- `web/src/app/opengraph-image.tsx` - update the footer text in the dynamic OG image
- `web/src/app/layout.tsx` - update the page metadata title / description / OG title
- `web/src/components/Hero.tsx` - the headline copy ("Finds AI topics before they hit mainstream") if your niche isn't AI

### 5. Run it

```bash
make install
make pipeline   # first full run (5-10 min depending on Gemini RPM)
make dev        # http://localhost:3000
```

### 6. Schedule it

For an always-live dashboard, install the cron entries on a server / VPS:

```cron
# Hourly light pipeline
0 * * * * /path/to/trend-radar/scripts/run_hourly.sh
# 12-hourly heavy pipeline (X + angles)
30 2,14 * * * /path/to/trend-radar/scripts/run_daily.sh
```

Logs land in `logs/pipeline.log`.

### 7. Deploy the dashboard

Trend Radar is set up for Vercel out of the box. Steps:

1. Create a Vercel project from your fork. Set "Root Directory" to `web`.
2. Add env vars to the project: `NEXT_PUBLIC_SNAPSHOT_URL` (the public Vercel Blob URL of your snapshot.json) and `BLOB_READ_WRITE_TOKEN`.
3. Push to your default branch. Vercel auto-deploys on every push.
4. Optional: add a custom domain at `vercel.com → Project → Settings → Domains`.

Your pipeline cron uploads a fresh snapshot.json to the Blob URL every hour, and the dashboard re-fetches it at the edge every 5 minutes via Next.js ISR.

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
