import { Snapshot } from "@/lib/snapshot";
import { relativeTime } from "@/lib/format";
import { RadarSweep } from "./RadarSweep";
import { CountUp } from "./CountUp";

export function Hero({ snapshot }: { snapshot: Snapshot | null }) {
  const total = snapshot?.meta.total_events ?? 0;
  const sources = snapshot?.meta.sources_tracked.length ?? 6;
  const gemsCount = snapshot?.hidden_gems.length ?? 0;
  const lastIngest = snapshot?.meta.last_ingest_at;

  return (
    <section className="relative mx-auto w-full max-w-[1200px] px-4 md:px-6 pt-24 md:pt-32 pb-16 md:pb-20 overflow-hidden">
      <RadarSweep />
      <div className="relative z-10 mb-6 flex items-center gap-3">
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
        className="relative z-10 t-display-xl mb-6 max-w-[18ch]"
        style={{ overflowWrap: "anywhere" }}
      >
        Finds AI topics before they hit mainstream.
      </h1>

      <p className="relative z-10 t-body-lead mb-10 max-w-[60ch]" style={{ color: "var(--ink-muted)" }}>
        Six sources. Velocity-scored, not popularity. Updated hourly.
        Currently tracking{" "}
        <span style={{ color: "var(--ink)" }}>
          <CountUp value={total} /> signals
        </span>{" "}
        across {sources} sources.{" "}
        <span style={{ color: "var(--accent)" }}>
          <CountUp value={gemsCount} duration={1400} /> surfaced as hidden gems
        </span>{" "}
        right now.
      </p>

      <div className="relative z-10 flex flex-wrap items-center gap-4">
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
    </section>
  );
}
