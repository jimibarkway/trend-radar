"use client";

import { useMemo, useState } from "react";
import type { RawEvent, Snapshot } from "@/lib/snapshot";
import { sourceLabel, sourceColor, relativeTime, formatScore } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";
import { SourcePreview } from "./SourcePreview";

type SourceFilter = "all" | string;

const SOURCE_PILLS = [
  "github_trending",
  "github_release",
  "youtube_upload",
  "youtube_search",
  "reddit",
  "rss",
  "x",
];

export function FullFeed({ snapshot }: { snapshot: Snapshot | null }) {
  const opportunities = snapshot?.top_opportunities ?? [];
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(SOURCE_PILLS),
  );
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (!enabled.has(o.source)) return false;
      if (query && !o.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [opportunities, enabled, query]);

  const visible = view === "cards" && !showAll ? filtered.slice(0, 10) : filtered;

  function toggleSource(s: string) {
    const next = new Set(enabled);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    if (next.size === 0) {
      // Avoid no-source dead-end
      SOURCE_PILLS.forEach((p) => next.add(p));
    }
    setEnabled(next);
  }

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-16 md:py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-3" style={{ color: "var(--accent)" }}>
        Full feed
      </p>
      <h2 className="t-headline mb-8">{filtered.length} scored signals, filterable</h2>

      {/* Source pills + search + view toggle */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {SOURCE_PILLS.map((s) => {
          const on = enabled.has(s);
          const col = sourceColor(s);
          return (
            <button
              key={s}
              onClick={() => toggleSource(s)}
              className="t-micro-label inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-all"
              style={{
                background: on ? col + "22" : "transparent",
                color: on ? col : "var(--ink-tertiary)",
                borderColor: on ? col + "55" : "var(--hairline)",
                cursor: "pointer",
              }}
            >
              <SourceIcon source={s} size={11} />
              {sourceLabel(s)}
            </button>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filter by title…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] max-w-md rounded-md border px-3 py-2 t-body"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--hairline)",
            color: "var(--ink)",
            fontSize: "14px",
          }}
        />
        <div
          className="inline-flex rounded-md border overflow-hidden"
          style={{ borderColor: "var(--hairline)" }}
        >
          <ViewBtn current={view} value="cards" onClick={() => setView("cards")}>
            Cards
          </ViewBtn>
          <ViewBtn current={view} value="table" onClick={() => setView("table")}>
            Table
          </ViewBtn>
        </div>
      </div>

      {opportunities.length === 0 ? (
        <Empty />
      ) : view === "cards" ? (
        <>
          <div className="grid grid-cols-1 gap-3">
            {visible.map((o) => (
              <FeedCard key={o.id} event={o} />
            ))}
          </div>
          {filtered.length > visible.length && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-md border px-5 py-2 t-supporting transition-colors"
              style={{
                borderColor: "var(--hairline-strong)",
                color: "var(--ink-muted)",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Show {filtered.length - visible.length} more ↓
            </button>
          )}
          {showAll && filtered.length > 10 && (
            <button
              onClick={() => setShowAll(false)}
              className="mt-6 ml-3 inline-flex items-center gap-2 rounded-md px-3 py-2 t-supporting transition-colors"
              style={{ color: "var(--ink-tertiary)", cursor: "pointer" }}
            >
              Collapse
            </button>
          )}
        </>
      ) : (
        <TableView events={filtered} />
      )}
    </section>
  );
}

function ViewBtn({
  current,
  value,
  children,
  onClick,
}: {
  current: string;
  value: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className="t-micro-label px-3 py-2 transition-colors"
      style={{
        background: active ? "var(--surface-2)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-tertiary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Empty() {
  return (
    <div
      className="rounded-lg p-10"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <p className="t-supporting">
        No scored signals yet. Run <code className="t-mono">make pipeline</code>.
      </p>
    </div>
  );
}

function FeedCard({ event }: { event: RawEvent }) {
  const col = sourceColor(event.source);
  const score = event.composite_score ?? 0;
  const scoreColour =
    score >= 70 ? "var(--accent)" : score >= 50 ? "var(--rising)" : "var(--ink-subtle)";

  // Strip the redundant "owner/" prefix from GitHub titles when the author
  // field already has it (avoids "ruvnet · ruvnet/ruflo" in the meta line)
  const showAuthor = event.author && !event.title.startsWith(event.author);

  return (
    <a
      href={event.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-lg overflow-hidden transition-all hover:translate-x-px"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
        borderLeft: `3px solid ${col}`,
      }}
    >
      <div className="flex gap-5 md:gap-6 p-5 md:p-6">
        <SourcePreview event={event} />
        <div className="min-w-0 flex-1 flex flex-col justify-between gap-4">
          {/* Meta row */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="t-micro-label inline-flex items-center gap-1.5 rounded px-2.5 py-1"
                style={{
                  background: col + "22",
                  color: col,
                  border: `1px solid ${col}44`,
                }}
              >
                <SourceIcon source={event.source} size={11} />
                {sourceLabel(event.source)}
              </span>
              <span
                className="t-supporting"
                style={{ color: "var(--ink-tertiary)", fontSize: "13px" }}
              >
                {relativeTime(event.published_at)}
              </span>
              {showAuthor && (
                <span
                  className="t-supporting truncate max-w-[240px]"
                  style={{ color: "var(--ink-tertiary)", fontSize: "13px" }}
                >
                  {event.author}
                </span>
              )}
            </div>
            <h3
              className="line-clamp-2"
              style={{
                color: "var(--ink)",
                fontSize: "19px",
                fontWeight: 500,
                lineHeight: 1.32,
                letterSpacing: "-0.012em",
              }}
            >
              {event.title}
            </h3>
          </div>
          {/* Score row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div
              className="h-1.5 flex-1 min-w-[120px] max-w-[220px] rounded-full overflow-hidden"
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
              style={{ color: scoreColour, fontSize: "14px", fontWeight: 600 }}
            >
              {formatScore(event.composite_score)}
            </span>
            <span
              className="t-supporting hidden sm:inline"
              style={{ color: "var(--ink-tertiary)", fontSize: "13px" }}
            >
              niche {event.niche_score?.toFixed(1) ?? "-"} · velocity {event.velocity_score?.toFixed(1) ?? "-"}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

function TableView({ events }: { events: RawEvent[] }) {
  return (
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
          {events.map((o, i) => (
            <TableRow key={o.id} event={o} stripe={i % 2 === 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableRow({ event, stripe }: { event: RawEvent; stripe: boolean }) {
  const col = sourceColor(event.source);
  const score = event.composite_score ?? 0;
  const scoreColour = score >= 70 ? "var(--accent)" : score >= 50 ? "var(--rising)" : "var(--ink-subtle)";
  return (
    <tr style={{ borderBottom: "1px solid var(--hairline)", background: stripe ? "var(--surface-2)" : "transparent" }}>
      <td className="px-4 py-3 align-top">
        <span
          className="t-micro-label inline-flex items-center gap-1.5 rounded px-2 py-1"
          style={{
            background: col + "22",
            color: col,
            border: `1px solid ${col}44`,
            whiteSpace: "nowrap",
          }}
        >
          <SourceIcon source={event.source} size={11} />
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
      </td>
      <td className="px-4 py-3 align-top text-right t-mono" style={{ color: scoreColour }}>
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
