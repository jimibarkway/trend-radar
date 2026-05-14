import type { ActivityBucket } from "@/lib/snapshot";
import { sourceColor, sourceLabel } from "@/lib/format";

/**
 * Stacked area chart of hourly ingest activity over the last 48h, one
 * coloured layer per source. Pure SVG, server-rendered.
 *
 * Headline stats + a marked peak make it clear what the chart is saying:
 * "this is the pulse of the radar - how many signals it pulled in, per
 * hour, by source."
 */
const STACK_ORDER = [
  "rss",
  "github_trending",
  "github_release",
  "youtube_upload",
  "youtube_search",
  "reddit",
  "x",
];

export function TrendChart({ timeline }: { timeline: ActivityBucket[] | undefined }) {
  if (!timeline || timeline.length < 2) {
    return (
      <p className="t-supporting p-2">
        Activity timeline builds as the hourly pipeline runs.
      </p>
    );
  }

  const present = STACK_ORDER.filter((s) =>
    timeline.some((b) => Number(b[s] ?? 0) > 0),
  );

  const W = 1000;
  const H = 220;
  const padB = 22;
  const n = timeline.length;
  const totals = timeline.map((b) => b.total);
  const maxTotal = Math.max(1, ...totals);
  const sum48 = totals.reduce((a, c) => a + c, 0);
  const peakIdx = totals.indexOf(maxTotal);
  const peakHoursAgo = n - 1 - peakIdx;

  const xAt = (i: number) => (i / (n - 1)) * W;
  const yAt = (v: number) => H - padB - (v / maxTotal) * (H - padB - 8);

  // Build the stacked layers from the bottom up.
  let cumulative = timeline.map(() => 0);
  const layers = present.map((src) => {
    const lower = [...cumulative];
    cumulative = cumulative.map((c, i) => c + Number(timeline[i][src] ?? 0));
    const upper = [...cumulative];
    const top = upper.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
    const bot = lower
      .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
      .reverse();
    return { src, d: `M ${top.join(" L ")} L ${bot.join(" L ")} Z` };
  });

  const ticks = [0, 12, 24, 36, 48]
    .map((hoursAgo) => {
      const idx = n - 1 - hoursAgo;
      if (idx < 0) return null;
      return { x: xAt(idx), label: hoursAgo === 0 ? "now" : `${hoursAgo}h ago` };
    })
    .filter((t): t is { x: number; label: string } => t !== null);

  return (
    <div className="flex h-full flex-col">
      {/* Headline - says plainly what the chart shows */}
      <div className="mb-3 flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span style={{ fontSize: "13px", color: "var(--ink-muted)" }}>
          <span
            className="font-semibold"
            style={{ color: "var(--ink)", fontSize: "20px", letterSpacing: "-0.02em" }}
          >
            {sum48.toLocaleString()}
          </span>{" "}
          signals pulled in over 48h
        </span>
        <span className="t-supporting" style={{ fontSize: "12px", color: "var(--ink-tertiary)" }}>
          peak{" "}
          <span style={{ color: "var(--accent)" }}>{maxTotal}/hr</span>
          {peakHoursAgo === 0 ? " right now" : ` ${peakHoursAgo}h ago`}
        </span>
        <span className="t-supporting" style={{ fontSize: "12px", color: "var(--ink-tertiary)" }}>
          each band = one source
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* y-axis max marker */}
        <span
          className="t-mono absolute left-0 top-0"
          style={{ fontSize: "10px", color: "var(--ink-tertiary)" }}
        >
          {maxTotal}/hr
        </span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: "100%", minHeight: 110 }}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={yAt(maxTotal * f)}
              y2={yAt(maxTotal * f)}
              stroke="var(--hairline)"
              strokeWidth="1"
            />
          ))}
          {layers.map((l) => (
            <path
              key={l.src}
              d={l.d}
              fill={sourceColor(l.src)}
              fillOpacity="0.7"
              stroke={sourceColor(l.src)}
              strokeOpacity="1"
              strokeWidth="1.25"
            />
          ))}
          {/* peak marker */}
          <line
            x1={xAt(peakIdx)}
            x2={xAt(peakIdx)}
            y1={yAt(maxTotal)}
            y2={H - padB}
            stroke="var(--accent)"
            strokeWidth="1"
            strokeDasharray="3 3"
            opacity="0.7"
          />
          <circle cx={xAt(peakIdx)} cy={yAt(maxTotal)} r="3.5" fill="var(--accent)" />
          {ticks.map((t) => (
            <line
              key={t.label}
              x1={t.x}
              x2={t.x}
              y1={H - padB}
              y2={H - padB + 4}
              stroke="var(--ink-tertiary)"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>

      {/* x-axis labels + legend */}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {present.map((s) => (
            <span
              key={s}
              className="t-supporting inline-flex items-center gap-1"
              style={{ color: "var(--ink-muted)", fontSize: "10px" }}
            >
              <span
                className="inline-block size-2 rounded-sm"
                style={{ background: sourceColor(s) }}
              />
              {sourceLabel(s)}
            </span>
          ))}
        </div>
        <div className="flex gap-3">
          {ticks.map((t) => (
            <span
              key={t.label}
              className="t-supporting"
              style={{ color: "var(--ink-tertiary)", fontSize: "10px" }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
