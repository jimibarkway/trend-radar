import { sourceColor, sourceLabel } from "@/lib/format";
import type { Cluster } from "@/lib/snapshot";

/**
 * Static "node graph" visualisation of a single cluster. Centroid dot in the
 * middle, one source dot per member source arranged on a ring. Edge thickness
 * encodes the per-source member count for that cluster.
 *
 * Doesn't use a force-directed layout - polar positioning is more legible at
 * the small sizes we render and avoids the noisy churn of a JS physics loop.
 */
export function ClusterGraph({
  cluster,
  size = 160,
}: {
  cluster: Cluster;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const ringR = size * 0.36;

  // Count members per source so edge weight reflects how much each source
  // contributed to the cluster.
  const byCount: Record<string, number> = {};
  for (const m of cluster.members) {
    byCount[m.source] = (byCount[m.source] || 0) + 1;
  }
  // Use cluster.sources order so layout is deterministic.
  const sources = cluster.sources;
  const total = Math.max(1, sources.length);

  const nodes = sources.map((src, i) => {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const x = cx + ringR * Math.cos(angle);
    const y = cy + ringR * Math.sin(angle);
    const count = byCount[src] || 1;
    return { src, x, y, count };
  });

  const maxCount = Math.max(...nodes.map((n) => n.count), 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="cluster-graph block shrink-0"
      role="img"
      aria-label={`Cluster of ${cluster.member_count} signals across ${cluster.source_count} sources`}
    >
      <style>{`
        .cluster-graph .cg-edge {
          stroke-dasharray: 3 4;
          animation: cg-flow 4s linear infinite;
        }
        .cluster-graph .cg-node-ring {
          transform-origin: center;
          animation: cg-ping 2.4s ease-in-out infinite;
        }
        .cluster-graph .cg-centroid-ring {
          transform-origin: center;
          animation: cg-pulse 2.4s ease-in-out infinite;
        }
        @keyframes cg-flow {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -14; }
        }
        @keyframes cg-ping {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50%      { transform: scale(1.5); opacity: 0; }
        }
        @keyframes cg-pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cluster-graph .cg-edge,
          .cluster-graph .cg-node-ring,
          .cluster-graph .cg-centroid-ring { animation: none; }
        }
      `}</style>
      {/* Backdrop ring */}
      <circle
        cx={cx}
        cy={cy}
        r={ringR}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      {/* Edges - dashed with flowing offset to suggest data converging in */}
      {nodes.map((n, i) => {
        const weight = 1 + (n.count / maxCount) * 2.5;
        return (
          <line
            key={`e-${n.src}`}
            className="cg-edge"
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={sourceColor(n.src)}
            strokeWidth={weight}
            strokeOpacity="0.6"
            style={{ animationDelay: `${(i * 0.3).toFixed(1)}s` } as React.CSSProperties}
          />
        );
      })}
      {/* Source nodes - outer ping ring + solid centre */}
      {nodes.map((n, i) => (
        <g key={`n-${n.src}`}>
          <circle
            className="cg-node-ring"
            cx={n.x}
            cy={n.y}
            r="10"
            fill="none"
            stroke={sourceColor(n.src)}
            strokeWidth="1.5"
            style={{
              transformBox: "fill-box",
              transformOrigin: `${n.x}px ${n.y}px`,
              animationDelay: `${(i * 0.4).toFixed(1)}s`,
            } as React.CSSProperties}
          />
          <circle
            cx={n.x}
            cy={n.y}
            r="10"
            fill={sourceColor(n.src)}
            fillOpacity="0.15"
            stroke={sourceColor(n.src)}
            strokeWidth="1.5"
          />
          <text
            x={n.x}
            y={n.y + 3}
            fontSize="9"
            fontWeight="600"
            textAnchor="middle"
            fill={sourceColor(n.src)}
          >
            {n.count}
          </text>
        </g>
      ))}
      {/* Centroid - pulsing outer ring + solid centre */}
      <circle
        className="cg-centroid-ring"
        cx={cx}
        cy={cy}
        r="14"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
      />
      <circle cx={cx} cy={cy} r="10" fill="var(--accent)" />
      <circle cx={cx} cy={cy} r="4" fill="var(--canvas)" />
      <title>
        {cluster.member_count} signals across {cluster.source_count} sources ({sources.map(sourceLabel).join(", ")})
      </title>
    </svg>
  );
}
