/**
 * Background radar visual for the hero. Server-rendered SVG; the sweep + ping
 * animations run pure-CSS. Six fixed source dots circle a centroid, each in
 * its brand colour to subtly preview the source palette.
 */

const SOURCES = [
  { angle: 30, color: "var(--src-github)" },     // GitHub
  { angle: 90, color: "var(--src-youtube)" },    // YouTube
  { angle: 150, color: "var(--src-reddit)" },    // Reddit
  { angle: 210, color: "var(--src-x)" },          // X
  { angle: 270, color: "var(--src-rss)" },        // RSS
  { angle: 330, color: "var(--src-github)" },     // (placeholder for HN/search)
];

function polar(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [400 + r * Math.cos(rad), 400 + r * Math.sin(rad)];
}

export function RadarSweep() {
  const sourceDots = SOURCES.map(({ angle, color }) => {
    const [x, y] = polar(angle, 280);
    return { x, y, color, angle };
  });

  return (
    <div className="pointer-events-none absolute inset-0 -z-0 flex items-center justify-end overflow-hidden">
      <div className="radar-wrap" aria-hidden>
        <svg
          width="800"
          height="800"
          viewBox="0 0 800 800"
          className="radar-svg"
        >
          <defs>
            <radialGradient id="rg-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
              <stop offset="80%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rg-sweep" x1="0.5" y1="0.5" x2="1" y2="0.5">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
            </linearGradient>
            <radialGradient id="rg-sweep-arc" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="var(--accent)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.18" />
            </radialGradient>
          </defs>

          <circle cx="400" cy="400" r="380" fill="url(#rg-glow)" />

          {/* Concentric rings */}
          {[120, 200, 280, 360].map((r) => (
            <circle
              key={r}
              cx="400"
              cy="400"
              r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1"
              opacity={0.22}
            />
          ))}

          {/* Crosshairs */}
          <line x1="40" y1="400" x2="760" y2="400" stroke="var(--accent)" strokeWidth="0.5" opacity="0.18" />
          <line x1="400" y1="40" x2="400" y2="760" stroke="var(--accent)" strokeWidth="0.5" opacity="0.18" />

          {/* Source dots */}
          {sourceDots.map((d, i) => (
            <g key={i}>
              <circle
                cx={d.x}
                cy={d.y}
                r="14"
                fill={d.color}
                opacity={0.18}
                className="radar-ping"
                style={{ animationDelay: `${i * 0.5}s`, transformOrigin: `${d.x}px ${d.y}px` } as React.CSSProperties}
              />
              <circle cx={d.x} cy={d.y} r="5" fill={d.color} />
            </g>
          ))}

          {/* Centroid */}
          <circle cx="400" cy="400" r="8" fill="var(--accent)" />
          <circle cx="400" cy="400" r="3" fill="var(--canvas)" />

          {/* Rotating sweep group */}
          <g className="radar-sweep" style={{ transformOrigin: "400px 400px" } as React.CSSProperties}>
            <line
              x1="400"
              y1="400"
              x2="760"
              y2="400"
              stroke="url(#rg-sweep)"
              strokeWidth="2"
            />
            <path
              d="M 400 400 L 760 400 A 360 360 0 0 0 660 156 Z"
              fill="url(#rg-sweep-arc)"
            />
          </g>
        </svg>
      </div>

      <style>{`
        .radar-wrap {
          position: absolute;
          right: -260px;
          top: 50%;
          transform: translateY(-50%);
          width: 800px;
          height: 800px;
          mask-image: radial-gradient(circle at center, black 60%, transparent 85%);
          -webkit-mask-image: radial-gradient(circle at center, black 60%, transparent 85%);
        }
        @media (max-width: 768px) {
          .radar-wrap {
            right: -380px;
            opacity: 0.6;
          }
        }
        .radar-svg {
          width: 100%;
          height: 100%;
        }
        .radar-sweep {
          animation: radarSpin 6s linear infinite;
        }
        .radar-ping {
          animation: radarPing 3s ease-in-out infinite;
        }
        @keyframes radarSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes radarPing {
          0%, 100% { transform: scale(1); opacity: 0.18; }
          50%      { transform: scale(1.6); opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          .radar-sweep,
          .radar-ping {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
