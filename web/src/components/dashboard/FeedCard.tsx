"use client";

import { useMemo, useState } from "react";
import type { Snapshot } from "@/lib/snapshot";
import { Card } from "./Card";
import { SourceIcon } from "@/components/SourceIcon";
import { SourcePreview } from "@/components/SourcePreview";
import { sourceLabel, sourceColor, relativeTime, formatScore } from "@/lib/format";

const SOURCE_PILLS = [
  "github_trending",
  "github_release",
  "youtube_upload",
  "youtube_search",
  "reddit",
  "rss",
  "x",
  "hackernews",
  "polymarket",
  "bluesky",
];

export function FeedCard({ snapshot }: { snapshot: Snapshot | null }) {
  const opps = snapshot?.top_opportunities ?? [];
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(SOURCE_PILLS));

  // Only show pills for sources actually present in the feed
  const presentSources = useMemo(
    () => SOURCE_PILLS.filter((s) => opps.some((o) => o.source === s)),
    [opps],
  );

  const filtered = useMemo(
    () => opps.filter((o) => enabled.has(o.source)),
    [opps, enabled],
  );

  function toggle(s: string) {
    const next = new Set(enabled);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    // never let the feed go fully empty
    if (next.size === 0) SOURCE_PILLS.forEach((p) => next.add(p));
    setEnabled(next);
  }

  return (
    <Card
      id="feed"
      label={`Full feed · ${filtered.length} of ${opps.length}`}
      className="min-h-0"
      noPad
    >
      {opps.length === 0 ? (
        <p className="t-supporting p-5">No scored signals yet.</p>
      ) : (
        <div className="flex h-full flex-col">
          {/* source-pill filter - in-place, no need to leave for /classic */}
          <div
            className="flex shrink-0 flex-wrap gap-1.5 px-3 md:px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--hairline)" }}
          >
            {presentSources.map((s) => {
              const on = enabled.has(s);
              const col = sourceColor(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(s)}
                  className="t-micro-label inline-flex items-center gap-1 rounded-full border px-2 py-1 transition-all"
                  style={{
                    background: on ? col + "22" : "transparent",
                    color: on ? col : "var(--ink-tertiary)",
                    borderColor: on ? col + "55" : "var(--hairline)",
                    cursor: "pointer",
                    fontSize: "9px",
                  }}
                >
                  <SourceIcon source={s} size={9} />
                  {sourceLabel(s)}
                </button>
              );
            })}
          </div>

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto p-3 md:p-4 space-y-2.5">
            {filtered.map((o) => {
              const col = sourceColor(o.source);
              const score = o.composite_score ?? 0;
              const scoreColour =
                score >= 70
                  ? "var(--accent)"
                  : score >= 50
                    ? "var(--rising)"
                    : "var(--ink-subtle)";
              const related = o.related_signals ?? [];
              return (
                <FeedRow
                  key={o.id}
                  o={o}
                  col={col}
                  score={score}
                  scoreColour={scoreColour}
                  related={related}
                >
                  <SourcePreview event={o} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2 flex-wrap">
                        <span style={{ color: col }}>
                          <SourceIcon source={o.source} size={11} />
                        </span>
                        <span
                          className="t-supporting"
                          style={{ color: "var(--ink-tertiary)", fontSize: "11px" }}
                        >
                          {sourceLabel(o.source)} · {relativeTime(o.published_at)}
                        </span>
                        {(() => {
                          const eng = (o.engagement ?? {}) as Record<string, unknown>;
                          const ratio = Number(eng.outlier_ratio ?? 0);
                          if (!ratio || ratio < 1.5) return null;
                          const subs = Number(eng.channel_subscriber_count ?? 0);
                          const colour = ratio >= 5 ? "#FFB020"        // gold viral
                                       : ratio >= 2 ? "var(--accent)"  // electric blue
                                       : "var(--rising)";              // green nudge
                          const label = ratio >= 5 ? "🔥" : "↑";
                          return (
                            <span
                              className="t-mono inline-flex items-center gap-1 rounded-full px-1.5 py-0.5"
                              style={{
                                background: `${colour}22`,
                                color: colour,
                                border: `1px solid ${colour}55`,
                                fontSize: "10px",
                                fontWeight: 600,
                              }}
                              title={subs ? `Channel: ${subs.toLocaleString()} subs · this video is ${ratio.toFixed(1)}× the channel's own median` : `${ratio.toFixed(1)}× the channel's own median views`}
                            >
                              {label} {ratio.toFixed(1)}× channel avg
                            </span>
                          );
                        })()}
                      </div>
                      <h3
                        className="line-clamp-2"
                        style={{
                          color: "var(--ink)",
                          fontSize: "13px",
                          fontWeight: 500,
                          lineHeight: 1.3,
                        }}
                      >
                        {o.title}
                      </h3>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div
                        className="h-1 flex-1 max-w-[120px] rounded-full overflow-hidden"
                        style={{ background: "var(--surface-3)" }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, score)}%`,
                            height: "100%",
                            background: scoreColour,
                          }}
                        />
                      </div>
                      <span
                        className="t-mono"
                        style={{ color: scoreColour, fontSize: "12px", fontWeight: 600 }}
                      >
                        {formatScore(o.composite_score)}
                      </span>
                    </div>
                  </div>
                </FeedRow>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}


// ---------------------------------------------------------------------------
// FeedRow: one row in the feed. The whole row is clickable to open the
// source URL, except for the Deep Dive button which expands an inline
// multi-source brief built from related_signals (computed server-side in
// export_snapshot.py - no extra API calls at click time).
// ---------------------------------------------------------------------------
function FeedRow({
  o,
  col,
  related,
  children,
}: {
  o: import("@/lib/snapshot").RawEvent;
  col: string;
  score: number;
  scoreColour: string;
  related: import("@/lib/snapshot").RelatedSignal[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hasRelated = related.length > 0;
  return (
    <div
      className="rounded-lg transition-colors"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        borderLeft: `2px solid ${col}`,
      }}
    >
      <a
        href={o.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col sm:flex-row gap-3 p-2.5 hover:bg-[var(--surface-3)] rounded-t-lg"
      >
        {children}
      </a>
      {/* Deep Dive bar */}
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <span className="t-supporting" style={{ color: "var(--ink-tertiary)", fontSize: "10.5px" }}>
          {hasRelated
            ? `${related.length} related signal${related.length === 1 ? "" : "s"} across ${new Set(related.map((r) => r.source)).size} source${new Set(related.map((r) => r.source)).size === 1 ? "" : "s"}`
            : "No cross-source convergence (yet)"}
        </span>
        <button
          type="button"
          disabled={!hasRelated}
          onClick={() => setOpen((v) => !v)}
          className="t-micro-label inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-all"
          style={{
            background: hasRelated ? "var(--accent-soft)" : "transparent",
            color: hasRelated ? "var(--accent)" : "var(--ink-subtle)",
            border: `1px solid ${hasRelated ? "var(--accent)" : "var(--hairline)"}55`,
            cursor: hasRelated ? "pointer" : "not-allowed",
            fontSize: "10px",
            fontWeight: 600,
          }}
        >
          🔬 {open ? "Close" : "Deep Dive"}
        </button>
      </div>
      {open && hasRelated && (
        <div
          className="px-2.5 pb-2.5 space-y-1.5"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <p
            className="t-supporting pt-2"
            style={{ color: "var(--ink-tertiary)", fontSize: "10.5px" }}
          >
            Other places this story is showing up - drawn from your own
            ingested events, ranked by topic overlap.
          </p>
          {related.map((r, i) => {
            const rcol = sourceColor(r.source);
            return (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded p-1.5 hover:bg-[var(--surface-3)]"
                style={{ borderLeft: `2px solid ${rcol}`, background: "var(--surface-1)" }}
              >
                <span style={{ color: rcol, marginTop: "2px" }}>
                  <SourceIcon source={r.source} size={10} />
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="t-supporting"
                    style={{ color: "var(--ink-tertiary)", fontSize: "10px" }}
                  >
                    {sourceLabel(r.source)} · {relativeTime(r.published_at)}
                  </div>
                  <div
                    className="line-clamp-2"
                    style={{ color: "var(--ink)", fontSize: "12px", lineHeight: 1.3 }}
                  >
                    {r.title}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
