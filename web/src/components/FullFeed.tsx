"use client";

import { useMemo, useState } from "react";
import type { RawEvent, Snapshot } from "@/lib/snapshot";
import { sourceLabel, sourceColor, relativeTime, formatScore } from "@/lib/format";

const SOURCES = [
  "all",
  "github_release",
  "github_trending",
  "youtube_upload",
  "youtube_search",
  "reddit",
  "rss",
  "x",
] as const;

export function FullFeed({ snapshot }: { snapshot: Snapshot | null }) {
  const opportunities = snapshot?.top_opportunities ?? [];
  const [source, setSource] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);
  const [query, setQuery] = useState<string>("");

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (source !== "all" && o.source !== source) return false;
      if ((o.composite_score ?? 0) < minScore) return false;
      if (query && !o.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [opportunities, source, minScore, query]);

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-6 py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-4" style={{ color: "var(--accent)" }}>
        The full feed
      </p>
      <h2 className="t-headline mb-3">All scored signals, filterable</h2>
      <p className="t-supporting mb-8 max-w-[60ch]">
        Composite = (niche × 5) + (velocity × 3) + (freshness × 2). Click any row
        to open the source.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="t-supporting" style={{ color: "var(--ink-muted)" }}>
          Source{" "}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="ml-2 rounded border px-2 py-1 t-mono"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--hairline)",
              color: "var(--ink)",
            }}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "all sources" : sourceLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="t-supporting" style={{ color: "var(--ink-muted)" }}>
          Min composite{" "}
          <input
            type="number"
            value={minScore}
            min={0}
            max={100}
            step={5}
            onChange={(e) => setMinScore(Number(e.target.value) || 0)}
            className="ml-2 w-20 rounded border px-2 py-1 t-mono"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--hairline)",
              color: "var(--ink)",
            }}
          />
        </label>

        <input
          type="search"
          placeholder="Filter by title..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md rounded border px-3 py-1 t-body"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--hairline)",
            color: "var(--ink)",
            fontSize: "14px",
          }}
        />

        <span className="ml-auto t-supporting" style={{ color: "var(--ink-tertiary)" }}>
          {filtered.length} of {opportunities.length}
        </span>
      </div>

      {opportunities.length === 0 ? (
        <div
          className="rounded-lg p-10"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <p className="t-supporting">No scored signals yet. Run <code className="t-mono">make pipeline</code>.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid var(--hairline)" }}>
          <table className="w-full t-body">
            <thead style={{ background: "var(--surface-2)" }}>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                <Th>Source</Th>
                <Th>Title</Th>
                <Th align="right">Composite</Th>
                <Th align="right">Niche</Th>
                <Th align="right">Velocity</Th>
                <Th align="right">Published</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <Row key={o.id} event={o} stripe={i % 2 === 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-3 t-micro-label font-medium"
      style={{ textAlign: align, color: "var(--ink-tertiary)" }}
    >
      {children}
    </th>
  );
}

function Row({ event, stripe }: { event: RawEvent; stripe: boolean }) {
  return (
    <tr
      style={{
        borderBottom: "1px solid var(--hairline)",
        background: stripe ? "var(--surface-2)" : "transparent",
      }}
    >
      <td className="px-4 py-3 align-top">
        <span
          className="t-micro-label rounded px-2 py-1"
          style={{
            background: sourceColor(event.source) + "22",
            color: sourceColor(event.source),
            border: `1px solid ${sourceColor(event.source)}44`,
            whiteSpace: "nowrap",
          }}
        >
          {sourceLabel(event.source)}
        </span>
      </td>
      <td className="px-4 py-3 align-top max-w-[600px]">
        <a
          href={event.url}
          target="_blank"
          rel="noopener noreferrer"
          className="line-clamp-2 hover:underline"
          style={{ color: "var(--ink)" }}
        >
          {event.title}
        </a>
        {event.author && (
          <span className="t-supporting mt-1 block" style={{ color: "var(--ink-tertiary)" }}>
            {event.author}
          </span>
        )}
      </td>
      <td className="px-4 py-3 align-top text-right t-mono" style={{ color: "var(--accent)" }}>
        {formatScore(event.composite_score)}
      </td>
      <td className="px-4 py-3 align-top text-right t-mono" style={{ color: "var(--ink-muted)" }}>
        {event.niche_score?.toFixed(1) ?? "-"}
      </td>
      <td className="px-4 py-3 align-top text-right t-mono" style={{ color: "var(--ink-muted)" }}>
        {event.velocity_score?.toFixed(1) ?? "-"}
      </td>
      <td className="px-4 py-3 align-top text-right t-supporting whitespace-nowrap">
        {relativeTime(event.published_at)}
      </td>
    </tr>
  );
}
