import type { ActivityBucket } from "@/lib/snapshot";
import { sourceColor, sourceLabel } from "@/lib/format";

/**
 * Stacked area chart of hourly ingest activity over the last 48h, one
 * coloured layer per source. Pure SVG, server-rendered - no chart library,
 * matches the hand-built aesthetic of the rest of the dashboard.
 *
 * This is the trend line a "Trend Radar" needs: it shows movement over
 * time, built off real ingested_at history the hourly cron accumulates.
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
  const H = 240;
  const padB = 22;
  const n = timeline.length;
  const maxTotal = Math.max(1, ...timeline.map((b) => b.total));

  const xAt = (i: number) => (i / (n - 1)) * W;
  const yAt = (v: number) => H - padB - (v / maxTotal) * (H - padB - 6);

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
    return {
      src,
      d: `M ${top.join(" L ")} L ${bot.join(" L ")} Z`,
    };
  });

  // A few time ticks along the x axis: now, -12h, -24h, -36h, -48h
  const ticks = [0, 12, 24, 36, 48]
    .map((hoursAgo) => {
      const idx = n - 1 - hoursAgo;
      if (idx < 0) return null;
      return {
        x: xAt(idx),
        label: hoursAgo === 0 ? "now" : `-${hoursAgo}h`,
      };
    })
    .filter((t): t is { x: number; label: string } => t !== null);

  return (
    <div className="flex h-full flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: "calc(100% - 28px)", minHeight: 120 }}
      >
        {/* Faint horizontal gridlines */}
        {[0.25, 0.5, 0.75].map((f) => (
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
        {/* Stacked source areas */}
        {layers.map((l) => (
          <path
            key={l.src}
            d={l.d}
            fill={sourceColor(l.src)}
            fillOpacity="0.55"
            stroke={sourceColor(l.src)}
            strokeOpacity="0.9"
            strokeWidth="1"
          />
        ))}
        {/* x-axis tick marks */}
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

      {/* x-axis labels + legend share the bottom strip */}
      <div className="flex items-center justify-between pt-1.5">
        <div className="flex gap-3">
          {present.map((s) => (
            <span
              key={s}
              className="t-supporting inline-flex items-center gap-1"
              style={{ color: "var(--ink-tertiary)", fontSize: "10px" }}
            >
              <span
                className="inline-block size-2 rounded-sm"
                style={{ background: sourceColor(s) }}
              />
              {sourceLabel(s)}
            </span>
          ))}
        </div>
        <span className="t-supporting" style={{ color: "var(--ink-tertiary)", fontSize: "10px" }}>
          last 48h · ingest/hr
        </span>
      </div>
    </div>
  );
}
