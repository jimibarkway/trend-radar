import { Snapshot } from "@/lib/snapshot";
import { sourceLabel, sourceColor, relativeTime } from "@/lib/format";

export function ConvergenceTicker({ snapshot }: { snapshot: Snapshot | null }) {
  const clusters = snapshot?.top_clusters ?? [];

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-6 py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-4" style={{ color: "var(--accent)" }}>
        Convergence ticker
      </p>
      <h2 className="t-headline mb-3">Topics across multiple sources right now</h2>
      <p className="t-supporting mb-10 max-w-[60ch]">
        When the same topic surfaces on GitHub, X, Reddit, and a YouTube channel inside
        48 hours, that&apos;s convergence. Clustered via Gemini text-embedding-004,
        cosine ≥ 0.82.
      </p>

      {clusters.length === 0 ? (
        <div
          className="rounded-lg p-10"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <p className="t-supporting">
            Computing convergence. Clusters appear after the first{" "}
            <code className="t-mono">make cluster</code> run.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clusters.map((c) => (
            <div
              key={c.id}
              className="rounded-lg p-6 transition-colors"
              style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {c.sources.map((s) => (
                  <span
                    key={s}
                    className="t-micro-label rounded px-2 py-1"
                    style={{
                      background: sourceColor(s) + "22",
                      color: sourceColor(s),
                      border: `1px solid ${sourceColor(s)}44`,
                    }}
                  >
                    {sourceLabel(s)}
                  </span>
                ))}
                <span className="t-supporting ml-auto" style={{ color: "var(--ink-tertiary)" }}>
                  cluster {c.cluster_score.toFixed(1)}
                </span>
              </div>
              <h3 className="t-body-lead mb-3" style={{ color: "var(--ink)" }}>
                {c.centroid_title}
              </h3>
              <p className="t-supporting mb-3">
                {c.member_count} signals across {c.source_count} sources · first seen{" "}
                {relativeTime(c.first_seen)}
              </p>
              {c.members[0] && (
                <a
                  href={c.members[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="t-supporting"
                  style={{ color: "var(--accent)" }}
                >
                  See top-scoring member →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
