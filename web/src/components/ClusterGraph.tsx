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
      className="block shrink-0"
      role="img"
      aria-label={`Cluster of ${cluster.member_count} signals across ${cluster.source_count} sources`}
    >
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
      {/* Edges */}
      {nodes.map((n) => {
        const weight = 1 + (n.count / maxCount) * 2.5; // 1px - 3.5px
        return (
          <line
            key={`e-${n.src}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={sourceColor(n.src)}
            strokeWidth={weight}
            strokeOpacity="0.55"
          />
        );
      })}
      {/* Source nodes */}
      {nodes.map((n) => (
        <g key={`n-${n.src}`}>
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
      {/* Centroid */}
      <circle cx={cx} cy={cy} r="10" fill="var(--accent)" />
      <circle cx={cx} cy={cy} r="4" fill="var(--canvas)" />
      <title>
        {cluster.member_count} signals across {cluster.source_count} sources ({sources.map(sourceLabel).join(", ")})
      </title>
    </svg>
  );
}
