# Trend Radar Competition - Build Plan v0.1

**Target:** 1st place ($500) at Jack Roberts' Trend Finder competition. Most Creative ($300) insurance via the "Tomorrow's Videos" panel.
**Deadline:** 27 May 2026 (Tuesday). 14 days. Currently 13 remaining.
**Author:** Jimi Barkway (solo entry).
**Repo:** `/root/trend-radar-comp/` → public GitHub TBD.

---

## Locked decisions (from Jimi 2026-05-13)

| Decision | Value |
|---|---|
| Snapshot transport | **Vercel Blob** (VPS posts hourly, dashboard reads edge-cached). VPS stays private, no inbound traffic. |
| Dashboard domain | `trendradar.jimibarkway.com` (Vercel custom domain) |
| Tool branding | "Trend Radar" as product, Jimi Barkway as author |
| Accent palette | **NO purple.** Locked to whatever the 4 design repos suggest. Recommend Option A (Linear + radar-green) - pending Jimi sign-off |
| Design repo handling | Auto-cloned all 4 + extracted tokens to `docs/design-tokens.md` |
| `x_keywords.example.json` | Ships with placeholder structure, no creds |
| Loom hidden-gem example | Real one from live `events.db` (top candidate: Voker YC S24 AI Agent Analytics - caught Launch HN at +90min, niche-score 9) |
| Entry mode | Solo |

---

## Strategic frame (do not deviate)

> "Most trend trackers show you what's already big. Trend Radar finds what's about to be - by scoring **velocity and cross-source convergence** across 6 signal sources, not popularity."

Differentiator appears in: Loom 0-5s hook, README hero, dashboard hero copy.

Creative wow-moment: section 5 "Tomorrow's Videos" panel. Most Creative prize insurance. Do not let it dominate.

---

## Day-by-day plan

### Days 1-2 - Foundations (today + tomorrow)

**Day 1 (today, 2026-05-13):**
- [x] Project skeleton at `/root/trend-radar-comp/`
- [x] Clone the 4 design repos into `design-research/`
- [x] Extract design tokens to `docs/design-tokens.md` (3 options + recommendation)
- [x] Write `PLAN.md` (this file)
- [x] Query `events.db` for real caught-early example (Voker confirmed)
- [x] **Option A approved by Jimi** (Linear + radar-green #59d499, no purple)
- [x] Scaffold Next.js 16 + Tailwind v4 in `web/` (turbopack, App Router, src-dir)
- [x] Apply Option A tokens to `globals.css` + 7-section page shell + Inter/Geist Mono fonts
- [x] `.env.example`, `LICENSE` (MIT), `README.md` skeleton
- [x] `next build` passes clean

**Day 2 (2026-05-13 - shipped same day as Day 1):**
- [ ] Create Vercel Blob store; capture `BLOB_READ_WRITE_TOKEN` (Jimi action)
- [x] `pipeline/scripts/export_snapshot.py` - reads SQLite, writes local + uploads to Vercel Blob
- [ ] Cron: hourly snapshot upload from VPS (Jimi action once Blob token lands)
- [x] `web/src/lib/snapshot.ts` - server-side fetch with `revalidate: 300`
- [x] Sanitised `pipeline/` mirror - all `/root/` paths replaced with `TREND_RADAR_ROOT`-aware lib/env.py, all creds via env vars
- [x] Pushed to GitHub via `gh auth login` device flow

### Days 3-5 - Backend additions (all shipped Day 1)

- [x] Velocity scoring formalised in `score.py` (per-source metric + raw value persisted to `velocity_snapshots`)
- [x] Composite formula updated: `(niche × 5) + (velocity × 3) + (freshness × 2)`
- [x] `pipeline/scripts/cluster.py` - Gemini text-embedding-004 + cosine ≥ 0.82 union-find
- [x] `clusters` SQLite table with member_count, source_count, cluster_score
- [x] `hidden_gems` SQL view filtering small repo / small channel / small account / fresh+fast
- [x] `export_snapshot.py` writes top_opportunities (50) + top_clusters (10) + hidden_gems (20) + tomorrows_videos (5) + velocity_samples (12)

### Days 6-9 - Dashboard (all shipped Day 1)

- [x] `<Hero/>` - live total + sources tracked + hidden-gems count + last-refresh
- [x] `<TopGem/>` - source + gem-reason badges, 3-axis scores, click-through
- [x] `<ConvergenceTicker/>` - multi-source clusters with member-source badges
- [x] `<FullFeed/>` - filterable table (source / min-score / title query)
- [x] `<HowItWorks/>` - per-source counts + pipeline diagram
- [x] `<Footer/>` - GitHub link + snapshot age
- [x] All wired to real seed data (495 events, 50 opps, 20 gems)

### Days 10-11 - Angle generation (shipped, awaiting Gemini key to populate seed)

**Day 10:**
- [x] `pipeline/scripts/generate_angles.py` - Gemini 2.5 Pro
- [x] System prompt = Jimi's voice rules verbatim from CLAUDE.md
- [ ] For each top-5 opportunity, produce: 1 primary title + 4 alt titles + first 2 sentences of hook + 30-sec script outline
- [ ] Write to `opportunities.angles_json`
- [ ] Daily cron at 07:50 UTC after scoring

**Day 11:** Section 5 "Tomorrow's Videos" panel
- 3-5 cards, expandable
- One pass refining the prompt until outputs sound like Jimi
- Manual review of 5 generations, edit-distance check

### Day 12 - Polish + Loom

- [ ] README final copy in Jimi's voice
- [ ] Screenshots / GIF of dashboard for README hero
- [ ] LOOM_SCRIPT.md final (real Voker caught-early example baked in)
- [ ] Record Loom (Jimi does this; Claudey provides script)
- [ ] Deploy to Vercel at `trendradar.jimibarkway.com`
- [ ] Clean machine smoke test of quickstart

### Day 13 - Buffer + submission

- [ ] Skool post under "May Comp" tag
- [ ] Final QA on a fresh checkout
- [ ] Push the green button

---

## Cut priority (if time slips)

In order - cut the FIRST item first if behind:

1. Mobile polish (desktop-first; Jack judges on desktop)
2. Section 5 alternate titles (keep 1 title, drop the other 4)
3. Convergence ticker becomes static instead of live-updating
4. Section 5 entirely (last resort - kills the Most Creative insurance)

---

## Files / structure (target)

```
trend-radar-comp/                         (renames to trend-radar in public repo)
├── PLAN.md                               (this file)
├── README.md                             (day 12)
├── LOOM_SCRIPT.md                        (day 12)
├── LICENSE                               (MIT)
├── .env.example
├── .gitignore
├── docker-compose.yml                    (one-command judge run)
├── design-research/                      (NOT shipped to public repo - .gitignore'd)
│   ├── impeccable/
│   ├── ui-ux-pro-max-skill/
│   ├── taste-skill/
│   └── awesome-design-md/
├── docs/
│   ├── design-tokens.md                  (DONE - awaiting sign-off)
│   ├── architecture.md
│   ├── scoring.md
│   └── voice-rules.md
├── pipeline/                             (sanitised mirror of /root/trend-radar/)
│   ├── sql/schema.sql
│   ├── scripts/
│   │   ├── ingest/*.py
│   │   ├── score.py
│   │   ├── velocity.py                   (NEW)
│   │   ├── cluster.py                    (NEW)
│   │   ├── generate_angles.py            (NEW)
│   │   └── export_snapshot.py            (NEW)
│   └── config/
│       ├── channels.example.json
│       ├── rss_feeds.json
│       ├── github_repos.json
│       ├── reddit_subs.json
│       └── x_keywords.example.json
└── web/                                  (Next.js 15)
    ├── app/page.tsx                      (single-page dashboard)
    ├── components/
    ├── lib/
    │   └── snapshot.ts                   (fetch + cache snapshot.json)
    └── public/
```

---

## Success criteria (re-checking at end of day 12)

1. Clean-machine clone → `docker-compose up` → working pipeline + dashboard in <10 min
2. Dashboard at `trendradar.jimibarkway.com` renders real data, looks like a launch page
3. Loom script clocks at 58s spoken at natural pace
4. README hero paragraph could be screenshotted and posted as a tweet
5. ≥1 verifiable "we caught this X hours before mainstream" example with timestamps
6. "Tomorrow's Videos" panel angles sound like Jimi, not like an LLM
7. Zero real credentials in git history

---

## Blocked on / pending Jimi

- **Sign-off on design-tokens.md Option A / B / C** (Option A recommended)
- **Caddy config for `trend-radar-api.jimibarkway.com`** - needs DNS record added: `A trend-radar-api → VPS IP`. (Jimi's domain registrar.)
- **DNS for `trendradar.jimibarkway.com`** - same registrar, points to Vercel.
- **GitHub repo creation** - Jimi creates public repo `trend-radar` under his account, I push to it.

---

## What I'm doing right now (parallel to awaiting sign-off)

- Caddy + VPS reverse-proxy can be set up in advance - no blocker
- Pipeline sanitisation (audit `/root/trend-radar/` files, copy clean versions to `pipeline/`) - no blocker
- Drafting `architecture.md`, `scoring.md`, `voice-rules.md` outlines - no blocker

Once Option A/B/C signed off + DNS records added, Next.js scaffolding starts and dashboard build proceeds in parallel with pipeline polish.
