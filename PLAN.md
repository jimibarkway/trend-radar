# Trend Radar Competition — Build Plan v0.1

**Target:** 1st place ($500) at Jack Roberts' Trend Finder competition. Most Creative ($300) insurance via the "Tomorrow's Videos" panel.
**Deadline:** 27 May 2026 (Tuesday). 14 days. Currently 13 remaining.
**Author:** Jimi Barkway (solo entry).
**Repo:** `/root/trend-radar-comp/` → public GitHub TBD.

---

## Locked decisions (from Jimi 2026-05-13)

| Decision | Value |
|---|---|
| Snapshot transport | VPS public endpoint `trend-radar-api.jimibarkway.com` (via Caddy reverse-proxy) |
| Dashboard domain | `trendradar.jimibarkway.com` (Vercel custom domain) |
| Tool branding | "Trend Radar" as product, Jimi Barkway as author |
| Accent palette | **NO purple.** Locked to whatever the 4 design repos suggest. Recommend Option A (Linear + radar-green) — pending Jimi sign-off |
| Design repo handling | Auto-cloned all 4 + extracted tokens to `docs/design-tokens.md` |
| `x_keywords.example.json` | Ships with placeholder structure, no creds |
| Loom hidden-gem example | Real one from live `events.db` (top candidate: Voker YC S24 AI Agent Analytics — caught Launch HN at +90min, niche-score 9) |
| Entry mode | Solo |

---

## Strategic frame (do not deviate)

> "Most trend trackers show you what's already big. Trend Radar finds what's about to be — by scoring **velocity and cross-source convergence** across 6 signal sources, not popularity."

Differentiator appears in: Loom 0-5s hook, README hero, dashboard hero copy.

Creative wow-moment: section 5 "Tomorrow's Videos" panel. Most Creative prize insurance. Do not let it dominate.

---

## Day-by-day plan

### Days 1-2 — Foundations (today + tomorrow)

**Day 1 (today, 2026-05-13):**
- [x] Project skeleton at `/root/trend-radar-comp/`
- [x] Clone the 4 design repos into `design-research/`
- [x] Extract design tokens to `docs/design-tokens.md` (3 options + recommendation)
- [x] Write `PLAN.md` (this file)
- [x] Query `events.db` for real caught-early example (Voker confirmed)
- [ ] **Awaiting Jimi sign-off on Option A vs B vs C from `docs/design-tokens.md`**
- [ ] Once approved: scaffold Next.js 15 + Tailwind + shadcn in `web/`
- [ ] Sanitised `.env.example`, `.gitignore`, MIT `LICENSE`
- [ ] `README.md` skeleton (sections only, copy comes day 12)

**Day 2:**
- [ ] Stand up Caddy reverse-proxy on VPS for `trend-radar-api.jimibarkway.com`
- [ ] Write `pipeline/scripts/export_snapshot.py` — reads SQLite, writes `snapshot.json` to `/var/www/trend-radar-api/snapshot.json`
- [ ] Cron: hourly snapshot generation
- [ ] Test snapshot accessible at the public URL with CORS for Vercel origin
- [ ] Sanitised `pipeline/` mirror of `/root/trend-radar/` — strip any creds/Skool/Notion/Apify refs, audit every file

### Days 3-5 — Backend additions

**Day 3:**
- [ ] `pipeline/scripts/velocity.py` — formalise per-source velocity columns:
  - GitHub: stars/day delta (need to snapshot star counts daily)
  - YouTube: views_per_hour × outlier_ratio
  - Reddit: upvotes/hour in first 6h
  - RSS/HN: comment velocity if available
- [ ] Composite formula update: `composite = (niche × 5) + (velocity × 3) + (freshness × 2)` (was `niche × 6 + freshness × 2 + velocity × 2`). Velocity becomes a bigger lever — fits the "hidden gem" frame.

**Day 4:**
- [ ] `pipeline/scripts/cluster.py` — convergence scoring:
  - Pull last 48h of scored events
  - Embed each title via Gemini `text-embedding-004`
  - Pairwise cosine similarity ≥ 0.82 → same cluster
  - Cluster score = max(member composites) × log(1 + member_count)
  - Write to new `clusters` SQLite table

**Day 5:**
- [ ] Hidden-gem SQL view `hidden_gems`:
  - GitHub repo `< 1k stars` OR
  - YouTube video on channel `< 100k subs` OR
  - X account `< 50k followers` OR
  - Published in last 72h AND velocity_score ≥ 7
- [ ] `pipeline/scripts/export_snapshot.py` upgrade — include `top_opportunities` (top 50 by composite) + `top_clusters` (top 10) + `hidden_gems` (top 20)

### Days 6-9 — Dashboard

**Day 6:** Hero + Today's top hidden gem (sections 1-2)
- Components: `<Hero/>`, `<TopGem/>`
- Real data wired from snapshot
- Polish until it lands

**Day 7:** Convergence ticker (section 3)
- Horizontal scrolling card row, source-icon badges, trend arrows
- Hover state for member-event list

**Day 8:** Full feed table (section 4)
- shadcn `<Table/>` with filters (source / age / min-score)
- Default sort: composite descending
- Pagination if >50 rows

**Day 9:** "How it works" + footer (sections 6, 7)
- Mermaid diagram of pipeline architecture
- Mobile pass start

### Days 10-11 — Angle generation (the wow)

**Day 10:**
- [ ] `pipeline/scripts/generate_angles.py` — Gemini 2.5 Pro
- [ ] System prompt = Jimi's voice rules verbatim from CLAUDE.md
- [ ] For each top-5 opportunity, produce: 1 primary title + 4 alt titles + first 2 sentences of hook + 30-sec script outline
- [ ] Write to `opportunities.angles_json`
- [ ] Daily cron at 07:50 UTC after scoring

**Day 11:** Section 5 "Tomorrow's Videos" panel
- 3-5 cards, expandable
- One pass refining the prompt until outputs sound like Jimi
- Manual review of 5 generations, edit-distance check

### Day 12 — Polish + Loom

- [ ] README final copy in Jimi's voice
- [ ] Screenshots / GIF of dashboard for README hero
- [ ] LOOM_SCRIPT.md final (real Voker caught-early example baked in)
- [ ] Record Loom (Jimi does this; Claudey provides script)
- [ ] Deploy to Vercel at `trendradar.jimibarkway.com`
- [ ] Clean machine smoke test of quickstart

### Day 13 — Buffer + submission

- [ ] Skool post under "May Comp" tag
- [ ] Final QA on a fresh checkout
- [ ] Push the green button

---

## Cut priority (if time slips)

In order — cut the FIRST item first if behind:

1. Mobile polish (desktop-first; Jack judges on desktop)
2. Section 5 alternate titles (keep 1 title, drop the other 4)
3. Convergence ticker becomes static instead of live-updating
4. Section 5 entirely (last resort — kills the Most Creative insurance)

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
├── design-research/                      (NOT shipped to public repo — .gitignore'd)
│   ├── impeccable/
│   ├── ui-ux-pro-max-skill/
│   ├── taste-skill/
│   └── awesome-design-md/
├── docs/
│   ├── design-tokens.md                  (DONE — awaiting sign-off)
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
- **Caddy config for `trend-radar-api.jimibarkway.com`** — needs DNS record added: `A trend-radar-api → VPS IP`. (Jimi's domain registrar.)
- **DNS for `trendradar.jimibarkway.com`** — same registrar, points to Vercel.
- **GitHub repo creation** — Jimi creates public repo `trend-radar` under his account, I push to it.

---

## What I'm doing right now (parallel to awaiting sign-off)

- Caddy + VPS reverse-proxy can be set up in advance — no blocker
- Pipeline sanitisation (audit `/root/trend-radar/` files, copy clean versions to `pipeline/`) — no blocker
- Drafting `architecture.md`, `scoring.md`, `voice-rules.md` outlines — no blocker

Once Option A/B/C signed off + DNS records added, Next.js scaffolding starts and dashboard build proceeds in parallel with pipeline polish.
