import type { Snapshot } from "@/lib/snapshot";
import { Card } from "./Card";
import { RadarMini } from "./RadarMini";
import { CountUp } from "@/components/CountUp";
import { SourceIcon } from "@/components/SourceIcon";
import { ClusterGraph } from "@/components/ClusterGraph";
import { SourcePreview } from "@/components/SourcePreview";
import {
  relativeTime,
  sourceLabel,
  sourceColor,
  gemReasonLabel,
  formatScore,
  formatNumber,
} from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Overview - radar + the three headline counters                      */
/* ------------------------------------------------------------------ */
export function OverviewCard({ snapshot }: { snapshot: Snapshot | null }) {
  const total = snapshot?.meta.total_events ?? 0;
  const gems = snapshot?.hidden_gems.length ?? 0;
  const clusters = snapshot?.top_clusters.length ?? 0;

  return (
    <Card id="overview" className="relative" noPad>
      <RadarMini />
      <div className="relative z-10 flex h-full flex-col justify-between gap-4 p-5 md:p-6">
        <div>
          <p className="t-micro-label mb-2" style={{ color: "var(--accent)" }}>
            Trend Radar · live
          </p>
          <h1
            className="font-semibold"
            style={{
              fontSize: "clamp(20px, 2.1vw, 28px)",
              lineHeight: 1.14,
              letterSpacing: "-0.03em",
              maxWidth: "13ch",
            }}
          >
            Finds AI topics before they hit mainstream.
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <Stat value={total} label="signals" color="var(--ink)" />
          <Stat value={gems} label="hidden gems" color="var(--accent)" duration={1300} />
          <Stat value={clusters} label="converging" color="var(--rising)" duration={1500} />
        </div>
      </div>
    </Card>
  );
}

function Stat({
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
      className="rounded-lg p-2.5 md:p-3"
      style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
    >
      <div
        className="font-semibold leading-none mb-1.5"
        style={{ fontSize: "clamp(20px, 2.6vw, 34px)", letterSpacing: "-0.03em", color }}
      >
        <CountUp value={value} duration={duration} />
      </div>
      <div className="t-micro-label" style={{ fontSize: "9px" }}>
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Today's top hidden gem - the feature card                           */
/* ------------------------------------------------------------------ */
export function TopGemCard({ snapshot }: { snapshot: Snapshot | null }) {
  const gem = snapshot?.hidden_gems?.[0];

  const leadTime = (() => {
    if (!gem?.published_at || !gem?.ingested_at) return null;
    const pub = new Date(gem.published_at).getTime();
    const ing = new Date(gem.ingested_at).getTime();
    if (Number.isNaN(pub) || Number.isNaN(ing) || ing <= pub) return null;
    const mins = Math.round((ing - pub) / 60000);
    if (mins < 60) return `${mins} min`;
    if (mins < 60 * 48) return `${Math.round(mins / 60)} h`;
    return `${Math.round(mins / (60 * 24))} d`;
  })();

  return (
    <Card id="top-gem" label="Today's top hidden gem" className="min-h-0">
      {gem ? (
        <a
          href={gem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-full flex-col"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SourceBadge source={gem.source} />
            <span
              className="t-micro-label rounded px-2 py-0.5"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid rgba(89,212,153,0.3)",
              }}
            >
              {gemReasonLabel(gem.gem_reason)}
            </span>
            <span className="t-supporting" style={{ color: "var(--ink-tertiary)", fontSize: "12px" }}>
              {relativeTime(gem.published_at)}
            </span>
          </div>
          <h2
            className="font-semibold mb-3"
            style={{ fontSize: "clamp(18px, 2vw, 26px)", lineHeight: 1.22, letterSpacing: "-0.02em" }}
          >
            {gem.title}
          </h2>
          {leadTime && (
            <div
              className="inline-flex w-fit items-center gap-2 rounded-md px-2.5 py-1.5 mb-3"
              style={{ background: "var(--accent-soft)", border: "1px solid rgba(89,212,153,0.3)" }}
            >
              <span
                className="inline-block size-1.5 rounded-full"
                style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}
              />
              <span className="t-mono" style={{ color: "var(--accent)", fontSize: "12px", fontWeight: 600 }}>
                Detected {leadTime} after publish
              </span>
            </div>
          )}
          <div className="mt-auto flex items-center gap-4 t-supporting" style={{ fontSize: "12px" }}>
            <ScorePair label="niche" value={gem.niche_score} />
            <ScorePair label="velocity" value={gem.velocity_score} />
            <ScorePair label="composite" value={gem.composite_score} accent />
            <span className="ml-auto" style={{ color: "var(--accent)" }}>
              Open →
            </span>
          </div>
        </a>
      ) : (
        <p className="t-supporting">No hidden gems in the current window.</p>
      )}
    </Card>
  );
}

function ScorePair({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
}) {
  return (
    <span style={{ color: "var(--ink-subtle)" }}>
      {label}{" "}
      <span
        className="t-mono"
        style={{ color: accent ? "var(--accent)" : "var(--ink)", fontWeight: 600 }}
      >
        {value != null ? value.toFixed(value < 11 ? 1 : 0) : "-"}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Per-source counts - the mini stat-card row                          */
/* ------------------------------------------------------------------ */
const SOURCE_ORDER = [
  "github_trending",
  "github_release",
  "youtube_upload",
  "youtube_search",
  "reddit",
  "rss",
  "x",
];

export function SourceStatsRow({ snapshot }: { snapshot: Snapshot | null }) {
  const counts = snapshot?.meta.counts_by_source ?? {};
  const total = snapshot?.meta.total_events ?? 0;
  const present = SOURCE_ORDER.filter((s) => counts[s]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {present.map((s) => {
        const c = counts[s] ?? 0;
        const pct = total ? Math.round((c / total) * 100) : 0;
        const col = sourceColor(s);
        return (
          <div
            key={s}
            className="rounded-xl p-3"
            style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
          >
            <div className="mb-2 flex items-center gap-1.5" style={{ color: col }}>
              <SourceIcon source={s} size={13} />
              <span className="t-micro-label" style={{ fontSize: "9px", color: col }}>
                {sourceLabel(s)}
              </span>
            </div>
            <div className="font-semibold leading-none" style={{ fontSize: "22px", letterSpacing: "-0.02em" }}>
              {formatNumber(c)}
            </div>
            <div className="t-supporting" style={{ color: "var(--ink-tertiary)", fontSize: "10px" }}>
              {pct}% of feed
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Convergence clusters - scrollable card                              */
/* ------------------------------------------------------------------ */
export function ConvergenceCard({ snapshot }: { snapshot: Snapshot | null }) {
  const clusters = snapshot?.top_clusters ?? [];
  return (
    <Card
      id="convergence"
      label={`Convergence · ${clusters.length} cross-source`}
      className="min-h-0"
      noPad
    >
      {clusters.length === 0 ? (
        <p className="t-supporting p-5">Clusters appear after the first cluster run.</p>
      ) : (
        <div className="lg:h-full lg:overflow-y-auto p-4 md:p-5 space-y-3">
          {clusters.map((c) => (
            <div
              key={c.id}
              className="flex gap-3.5 rounded-lg p-3.5"
              style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
            >
              {/* The graph already encodes which sources converged (coloured
                  nodes) - no need for a separate icon row. */}
              <div className="shrink-0">
                <ClusterGraph cluster={c} size={96} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="t-mono"
                    style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 600 }}
                  >
                    {c.cluster_score.toFixed(0)}
                  </span>
                  <span
                    className="t-supporting"
                    style={{ color: "var(--ink-tertiary)", fontSize: "11px" }}
                  >
                    {c.member_count} signals · {c.source_count} sources
                  </span>
                </div>
                <h3
                  className="line-clamp-3"
                  style={{ color: "var(--ink)", fontSize: "13.5px", fontWeight: 500, lineHeight: 1.32 }}
                >
                  {c.centroid_title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tomorrow's videos - compact list                                    */
/* ------------------------------------------------------------------ */
export function VideosCard({ snapshot }: { snapshot: Snapshot | null }) {
  const videos = snapshot?.tomorrows_videos ?? [];
  return (
    <Card id="videos" label="Tomorrow's videos" accent="var(--rising)" className="min-h-0" noPad>
      {videos.length === 0 ? (
        <p className="t-supporting p-5">Run angle generation to populate this.</p>
      ) : (
        <div className="lg:h-full lg:overflow-y-auto p-4 md:p-5 space-y-3">
          {videos.map((v) => (
            <a
              key={v.id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg p-3 transition-colors hover:bg-[var(--surface-3)]"
              style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <SourceBadge source={v.source} small />
                <span className="t-supporting" style={{ color: "var(--ink-tertiary)", fontSize: "11px" }}>
                  composite {formatScore(v.composite_score)}
                </span>
              </div>
              <h3
                style={{ color: "var(--ink)", fontSize: "14px", fontWeight: 500, lineHeight: 1.3 }}
              >
                {v.primary_title}
              </h3>
              <p
                className="line-clamp-2 mt-1"
                style={{ color: "var(--ink-subtle)", fontSize: "12px", lineHeight: 1.45 }}
              >
                {v.hook_first_2_sentences}
              </p>
            </a>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Full feed - compact, scrollable. Filtering lives on the classic view */
/* ------------------------------------------------------------------ */
export function FeedCard({ snapshot }: { snapshot: Snapshot | null }) {
  const opps = snapshot?.top_opportunities ?? [];
  return (
    <Card
      id="feed"
      label={`Full feed · ${opps.length} scored`}
      className="min-h-0"
      noPad
      action={
        <a
          href="/classic#feed"
          className="t-micro-label"
          style={{ color: "var(--ink-tertiary)" }}
        >
          Filter in classic view →
        </a>
      }
    >
      {opps.length === 0 ? (
        <p className="t-supporting p-5">No scored signals yet.</p>
      ) : (
        <div className="lg:h-full lg:overflow-y-auto p-3 md:p-4 space-y-2.5">
          {opps.map((o) => {
            const col = sourceColor(o.source);
            const score = o.composite_score ?? 0;
            const scoreColour =
              score >= 70 ? "var(--accent)" : score >= 50 ? "var(--rising)" : "var(--ink-subtle)";
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
                      style={{ color: "var(--ink)", fontSize: "13px", fontWeight: 500, lineHeight: 1.3 }}
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
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* How it works - compact                                              */
/* ------------------------------------------------------------------ */
export function HowCard() {
  const steps = [
    "ingest -> SQLite (1 row per signal)",
    "score: Gemini niche + velocity + freshness",
    "composite = (niche x 5) + (velocity x 3) + (freshness x 2)",
    "cluster: embeddings, cosine >= 0.82",
    "angles: Gemini Pro on the top 5",
    "snapshot -> Vercel Blob -> this dashboard",
  ];
  return (
    <Card id="how" label="How it works" className="min-h-0">
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5" style={{ fontSize: "12.5px", color: "var(--ink-muted)" }}>
            <span className="t-mono shrink-0" style={{ color: "var(--accent)" }}>
              {i + 1}
            </span>
            <span className="t-mono" style={{ fontSize: "11.5px" }}>
              {s}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* shared                                                              */
/* ------------------------------------------------------------------ */
function SourceBadge({ source, small }: { source: string; small?: boolean }) {
  const col = sourceColor(source);
  return (
    <span
      className="t-micro-label inline-flex items-center gap-1.5 rounded px-2 py-0.5"
      style={{
        background: col + "22",
        color: col,
        border: `1px solid ${col}44`,
        fontSize: small ? "9px" : undefined,
      }}
    >
      <SourceIcon source={source} size={small ? 9 : 10} />
      {sourceLabel(source)}
    </span>
  );
}
