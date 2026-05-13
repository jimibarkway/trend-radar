# Trend Radar

> Finds AI topics before they hit mainstream. Six sources. Velocity-scored, not popularity.

Most trend trackers show you what's already big. Trend Radar finds what's about to be, by scoring **velocity and cross-source convergence** across six signal sources rather than raw popularity.

Built for [Jack Roberts' Trend Finder competition](https://skool.com/) by Jimi Barkway, May 2026.

**Live dashboard:** [trendradar.jimibarkway.com](https://trendradar.jimibarkway.com)

---

## What it does

(Day 12: replace with final marketing copy + screenshots + a 30-second GIF.)

Six ingestion sources feed a SQLite event store hourly:

1. GitHub trending repos (Python, TypeScript, AI keywords)
2. YouTube channel uploads (43 AI-niche channels, monitored via uploads-playlist diffs)
3. YouTube search queries (catches viral videos outside the channel list)
4. Reddit via Tavily search (8 subs)
5. X / Twitter via Apify (21 keyword queries + 16 from:@account watches, 12-hour cadence)
6. RSS / Hacker News (18 feeds)

Every event gets scored on three axes by Gemini Flash-Lite:

- **Niche score** (0-10): how strongly it matches the AI / agentic-workflow / Claude Code lane
- **Velocity score** (0-10): stars/day, views/hour vs channel median, upvotes/hour
- **Freshness** (0-10): inverse age

Composite: `(niche × 5) + (velocity × 3) + (freshness × 2)`.

Cross-source clustering uses Gemini's `text-embedding-004` over the last 48 hours. Items with cosine similarity ≥ 0.82 form a cluster. Cluster score = `max(member composites) × log(1 + member count)`.

Hidden-gem SQL view filters for: GitHub repos under 1k stars, YouTube channels under 100k subs, X accounts under 50k followers, or anything posted in the last 72 hours with velocity ≥ 7.

The Next.js dashboard reads a JSON snapshot that the pipeline writes to Vercel Blob hourly. No public ingress on the VPS.

---

## Quick start (day 12: verify on a fresh machine)

```bash
git clone https://github.com/jimibarkway/trend-radar
cd trend-radar
cp .env.example .env   # fill in keys
docker-compose up      # pipeline + dashboard, single command
```

Open [http://localhost:3000](http://localhost:3000). First run will be empty until the pipeline ingests a cycle.

---

## Repo layout

```
trend-radar/
├── pipeline/                 Python ingestion + scoring + snapshot export
│   ├── sql/schema.sql
│   ├── scripts/
│   │   ├── ingest/*.py
│   │   ├── score.py
│   │   ├── velocity.py       per-source velocity scoring
│   │   ├── cluster.py        embedding-based convergence
│   │   ├── generate_angles.py    Gemini Pro, Jimi's voice rules
│   │   └── export_snapshot.py    SQLite -> Vercel Blob
│   └── config/
│       ├── channels.example.json
│       ├── rss_feeds.json
│       ├── github_repos.json
│       ├── reddit_subs.json
│       └── x_keywords.example.json
├── web/                      Next.js 16 + Tailwind v4 dashboard
├── docs/                     architecture, scoring, voice-rules, design-tokens
└── LOOM_SCRIPT.md            60-second product tour
```

---

## License

MIT. See [LICENSE](LICENSE).
