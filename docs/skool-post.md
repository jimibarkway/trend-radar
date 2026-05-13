# Skool submission post

Drafted for posting under the "May Comp" tag. Tweak as needed before hitting publish.

---

🛰️ Trend Radar — finds AI topics before they hit mainstream

Most trend trackers show you what's already big. By the time something hits your feed, the early window has closed.

Trend Radar inverts that. It scores velocity and cross-source convergence across six signal sources every hour, so the things that are *about to be* big surface first.

Real proof from the live feed: it caught Voker's Launch HN 90 minutes after they posted, scored niche 9, surfaced it as a hidden gem - hours before it showed up in any mainstream AI newsletter.

🔗 Live: https://trendradar.jimibarkway.com
🔗 Code: https://github.com/jimibarkway/trend-radar
🎥 60-second tour: [INSERT LOOM URL]

What makes it different:

- **Six sources, not one** - GitHub releases + trending, YouTube uploads + searches, Reddit (via Tavily), RSS, X (via Apify). Each scored on niche fit + velocity + freshness.
- **Cross-source convergence as a second-order signal** - when GitHub + Reddit + YouTube all mention the same topic in a 48h window, it bubbles. Right now "Claude Code Just Got a Dashboard" has 16 signals across 3 sources.
- **Hidden gems filter** - small repo (under 1k stars), small channel (under 50k subs), or fresh-and-accelerating (under 72h with velocity ≥ 7). This is where the next viral idea hides before everyone else sees it.
- **"Tomorrow's Videos" panel** - top 5 opportunities passed through Gemini 3 Pro using my voice rules. Returns ready-to-record drafts: title, alt titles, hook, 30s outline. Most trackers stop at "here's what's hot." This one hands you the script.
- **Built free-tier** - Gemini for scoring + embedding + angle gen, SQLite for storage, Vercel for hosting. Runs on ~£0.20/month. Open source under MIT.

The whole pipeline ingests, scores, clusters, and exports to a dashboard every hour. Clean machine to working pipeline in five commands.

Built for the Trend Finder competition. Feedback welcome 🟢
