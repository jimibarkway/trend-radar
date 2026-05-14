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
              return (
                <a
                  key={o.id}
                  href={o.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col sm:flex-row gap-3 rounded-lg p-2.5 transition-colors hover:bg-[var(--surface-3)]"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderLeft: `2px solid ${col}`,
                  }}
                >
                  <SourcePreview event={o} size="sm" />
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span style={{ color: col }}>
                          <SourceIcon source={o.source} size={11} />
                        </span>
                        <span
                          className="t-supporting"
                          style={{ color: "var(--ink-tertiary)", fontSize: "11px" }}
                        >
                          {sourceLabel(o.source)} · {relativeTime(o.published_at)}
                        </span>
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
                </a>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
