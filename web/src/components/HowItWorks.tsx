import type { Snapshot } from "@/lib/snapshot";
import { sourceLabel, sourceColor, formatNumber } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";

export function HowItWorks({ snapshot }: { snapshot: Snapshot | null }) {
  const counts = snapshot?.meta.counts_by_source ?? {};
  const total = snapshot?.meta.total_events ?? 0;

  const sources = [
    { id: "github_release", note: "Canonical AI repos, polled every 5 min for new releases." },
    { id: "github_trending", note: "Scraped daily; filtered by AI keyword set." },
    { id: "youtube_upload", note: "AI-niche channel uploads, views-per-hour vs channel median." },
    { id: "youtube_search", note: "Discovery queries to catch breakout creators." },
    { id: "reddit", note: "Tavily search restricted to chosen subreddits." },
    { id: "rss", note: "Anthropic, OpenAI, DeepMind, HN, Latent Space, and 12 more." },
    { id: "x", note: "Keyword + from:@account watches via Apify, every 12h." },
  ];

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-16 md:py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-3" style={{ color: "var(--accent)" }}>
        How it works
      </p>
      <h2 className="t-headline mb-8">Six sources. Velocity over popularity.</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {sources.map((s) => {
          const count = counts[s.id] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div
              key={s.id}
              className="rounded-lg p-5"
              style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <span
                  className="t-body-lead inline-flex items-center gap-2"
                  style={{ color: sourceColor(s.id) }}
                >
                  <SourceIcon source={s.id} size={18} />
                  {sourceLabel(s.id)}
                </span>
                <span className="t-mono" style={{ color: "var(--ink-muted)" }}>
                  {formatNumber(count)}{" "}
                  <span className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
                    ({pct}%)
                  </span>
                </span>
              </div>
              <p className="t-supporting" style={{ color: "var(--ink-muted)" }}>
                {s.note}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-12">
        <h3 className="t-headline mb-4" style={{ fontSize: "20px" }}>
          The pipeline
        </h3>
        <div
          className="rounded-lg p-6 t-mono leading-relaxed"
          style={{
            background: "var(--surface-1)",
            border: "1px solid var(--hairline)",
            fontSize: "13px",
            color: "var(--ink-muted)",
          }}
        >
          <Pipe>ingest -&gt; SQLite raw_events (1 row per signal)</Pipe>
          <Pipe>score: Gemini Flash-Lite niche 0-10, then velocity + freshness</Pipe>
          <Pipe>composite = (niche × 5) + (velocity × 3) + (freshness × 2)</Pipe>
          <Pipe>cluster: Gemini text-embedding-004, cosine ≥ 0.82 union-find</Pipe>
          <Pipe>cluster_score = max(member composites) × ln(1 + member_count)</Pipe>
          <Pipe>angle: Gemini 2.5 Pro on top 5, voice rules baked in</Pipe>
          <Pipe>snapshot: SQLite -&gt; JSON -&gt; Vercel Blob -&gt; this page</Pipe>
        </div>
      </div>
    </section>
  );
}

function Pipe({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-1">
      <span style={{ color: "var(--accent)" }}>→</span> {children}
    </div>
  );
}
