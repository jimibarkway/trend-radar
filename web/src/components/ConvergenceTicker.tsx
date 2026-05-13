import { Snapshot } from "@/lib/snapshot";
import { sourceLabel, sourceColor, relativeTime } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";
import { ClusterGraph } from "./ClusterGraph";

export function ConvergenceTicker({ snapshot }: { snapshot: Snapshot | null }) {
  const clusters = snapshot?.top_clusters ?? [];

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-16 md:py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-3" style={{ color: "var(--accent)" }}>
        Convergence
      </p>
      <h2 className="t-headline mb-8">
        {clusters.length > 0
          ? `${clusters.length} cross-source signals in the last 48 hours`
          : "Topics across multiple sources"}
      </h2>

      {clusters.length === 0 ? (
        <div
          className="rounded-lg p-10"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <p className="t-supporting">
            Clusters appear after the first <code className="t-mono">make cluster</code> run.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clusters.map((c) => (
            <div
              key={c.id}
              className="rounded-lg p-5 transition-colors"
              style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
            >
              {/* Source logos row - read at a glance which sources converged */}
              <div className="mb-4 flex items-center gap-2">
                {c.sources.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center justify-center size-7 rounded-full"
                    style={{
                      background: sourceColor(s) + "22",
                      color: sourceColor(s),
                      border: `1px solid ${sourceColor(s)}55`,
                    }}
                    title={sourceLabel(s)}
                  >
                    <SourceIcon source={s} size={14} />
                  </span>
                ))}
                <span className="ml-auto t-mono" style={{ color: "var(--accent)" }}>
                  {c.cluster_score.toFixed(0)}
                </span>
              </div>

              {/* Stack on mobile, side-by-side from md+ */}
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="hidden md:block shrink-0">
                  <ClusterGraph cluster={c} size={120} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="t-body-lead mb-2" style={{ color: "var(--ink)" }}>
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
                      Open top member →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
