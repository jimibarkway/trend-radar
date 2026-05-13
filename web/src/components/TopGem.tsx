import { Snapshot } from "@/lib/snapshot";
import { relativeTime, sourceLabel, sourceColor, gemReasonLabel, formatScore } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";

export function TopGem({ snapshot }: { snapshot: Snapshot | null }) {
  const gem = snapshot?.hidden_gems?.[0];

  // Compute the "caught early" lead time - how long after publish we
  // ingested it. This is the system's reason-for-being and deserves visual
  // prominence. Returns null if we don't have both timestamps.
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
    <section
      id="top-gem"
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-16 md:py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-3" style={{ color: "var(--accent)" }}>
        Today&apos;s top hidden gem
      </p>

      {gem ? (
        <a
          href={gem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg p-6 md:p-10 transition-colors"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span
              className="t-micro-label inline-flex items-center gap-1.5 rounded px-2 py-1"
              style={{
                background: sourceColor(gem.source) + "22",
                color: sourceColor(gem.source),
                border: `1px solid ${sourceColor(gem.source)}44`,
              }}
            >
              <SourceIcon source={gem.source} size={11} />
              {sourceLabel(gem.source)}
            </span>
            <span
              className="t-micro-label rounded px-2 py-1"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid rgba(89,212,153,0.3)",
              }}
            >
              {gemReasonLabel(gem.gem_reason)}
            </span>
            <span className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
              {relativeTime(gem.published_at)} · composite {formatScore(gem.composite_score)}
            </span>
          </div>

          <h2 className="t-display-md mb-4" style={{ color: "var(--ink)" }}>
            {gem.title}
          </h2>

          {gem.body_excerpt && (
            <p className="t-body line-clamp-2 mb-5" style={{ color: "var(--ink-muted)" }}>
              {gem.body_excerpt}
            </p>
          )}

          {leadTime && (
            <div
              className="inline-flex items-center gap-3 rounded-md px-3 py-2 mb-5"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid rgba(89,212,153,0.3)",
              }}
            >
              <span
                className="inline-block size-1.5 rounded-full"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 0 8px var(--accent)",
                }}
                aria-hidden
              />
              <span
                className="t-mono"
                style={{ color: "var(--accent)", fontSize: "13px", fontWeight: 600 }}
              >
                Detected {leadTime} after publish
              </span>
              <span
                className="t-supporting"
                style={{ color: "var(--ink-tertiary)", fontSize: "12px" }}
              >
                before mainstream feeds noticed
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 t-supporting">
            <ScoreCell label="Niche" value={gem.niche_score} />
            <ScoreCell label="Velocity" value={gem.velocity_score} />
            <ScoreCell label="Freshness" value={gem.freshness_score} />
            <span style={{ color: "var(--accent)" }}>Open on {sourceLabel(gem.source)} →</span>
          </div>
        </a>
      ) : (
        <div
          className="rounded-lg p-10"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <p className="t-supporting">No hidden gems in the current window. Run the pipeline.</p>
        </div>
      )}
    </section>
  );
}

function ScoreCell({ label, value }: { label: string; value: number | undefined }) {
  return (
    <span style={{ color: "var(--ink-subtle)" }}>
      {label}{" "}
      <span className="t-mono" style={{ color: "var(--ink)" }}>
        {value != null ? value.toFixed(1) : "-"}
      </span>
    </span>
  );
}
