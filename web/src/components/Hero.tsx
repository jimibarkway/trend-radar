import { Snapshot } from "@/lib/snapshot";
import { relativeTime } from "@/lib/format";
import { RadarSweep } from "./RadarSweep";
import { CountUp } from "./CountUp";

export function Hero({ snapshot }: { snapshot: Snapshot | null }) {
  const total = snapshot?.meta.total_events ?? 0;
  const sources = snapshot?.meta.sources_tracked.length ?? 6;
  const gemsCount = snapshot?.hidden_gems.length ?? 0;
  const clustersCount = snapshot?.top_clusters.length ?? 0;
  const lastIngest = snapshot?.meta.last_ingest_at;

  return (
    <section className="relative w-full overflow-hidden pt-24 md:pt-32 pb-12 md:pb-16">
      {/* Radar is full-bleed against the viewport right edge, not the content box */}
      <RadarSweep />
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 md:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: "var(--accent)", boxShadow: "0 0 12px var(--accent)" }}
          aria-hidden
        />
        <span className="t-micro-label" style={{ color: "var(--accent)" }}>
          Trend Radar · live · {sources} sources
        </span>
      </div>

      <h1
        className="t-display-xl mb-6 max-w-[18ch]"
        style={{ overflowWrap: "anywhere" }}
      >
        Finds AI topics before they hit mainstream.
      </h1>

      <p className="t-body-lead mb-10 max-w-[60ch]" style={{ color: "var(--ink-muted)" }}>
        Six sources. Velocity-scored, not popularity. Updated hourly.
      </p>

      {/* Stat strip - three big counters that scan in half a second */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-10">
        <StatTile
          value={total}
          label="signals tracked"
          color="var(--ink)"
        />
        <StatTile
          value={gemsCount}
          label="hidden gems"
          color="var(--accent)"
          duration={1300}
        />
        <StatTile
          value={clustersCount}
          label="converging now"
          color="var(--rising)"
          duration={1500}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href="#top-gem"
          className="inline-flex items-center gap-2 rounded-md border px-5 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
        >
          See today&apos;s top signal ↓
        </a>
        {lastIngest && (
          <span className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
            Last refresh: {relativeTime(lastIngest)}
          </span>
        )}
      </div>
      </div>
    </section>
  );
}

function StatTile({
  value,
  label,
  color,
  duration = 1100,
}: {
  value: number;
  label: string;
  color: string;
  duration?: number;
}) {
  return (
    <div
      className="rounded-lg p-3 md:p-5"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <div
        className="font-semibold leading-none mb-2"
        style={{
          fontSize: "clamp(28px, 7vw, 56px)",
          letterSpacing: "-0.03em",
          color,
        }}
      >
        <CountUp value={value} duration={duration} />
      </div>
      <div className="t-micro-label" style={{ fontSize: "10px" }}>
        {label}
      </div>
    </div>
  );
}
