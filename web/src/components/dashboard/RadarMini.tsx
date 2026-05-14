/**
 * Self-contained radar visual for the dashboard overview card. Same green
 * sweep + pinging source dots as the classic hero, but centred and bounded
 * inside its card instead of bleeding off the viewport.
 */
const SOURCES = [
  { angle: 30, color: "var(--src-github)" },
  { angle: 90, color: "var(--src-youtube)" },
  { angle: 150, color: "var(--src-reddit)" },
  { angle: 210, color: "var(--src-x)" },
  { angle: 270, color: "var(--src-rss)" },
  { angle: 330, color: "var(--src-github)" },
];

function polar(deg: number, r: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [200 + r * Math.cos(rad), 200 + r * Math.sin(rad)];
}

export function RadarMini() {
  const dots = SOURCES.map(({ angle, color }) => {
    const [x, y] = polar(angle, 140);
    return { x, y, color };
  });

  return (
    <div className="radar-mini-wrap" aria-hidden>
      <svg width="100%" height="100%" viewBox="0 0 400 400" className="radar-mini-svg">
        <defs>
          <radialGradient id="rm-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="80%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rm-sweep" x1="0.5" y1="0.5" x2="1" y2="0.5">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="rm-sweep-arc" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="200" cy="200" r="195" fill="url(#rm-glow)" />
        {[60, 100, 140, 180].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="var(--accent)" strokeWidth="1" opacity={0.2} />
        ))}
        <line x1="20" y1="200" x2="380" y2="200" stroke="var(--accent)" strokeWidth="0.5" opacity="0.15" />
        <line x1="200" y1="20" x2="200" y2="380" stroke="var(--accent)" strokeWidth="0.5" opacity="0.15" />

        {dots.map((d, i) => (
          <g key={i}>
            <circle
              cx={d.x}
              cy={d.y}
              r="9"
              fill={d.color}
              opacity={0.18}
              className="radar-mini-ping"
              style={{ animationDelay: `${i * 0.5}s`, transformOrigin: `${d.x}px ${d.y}px` } as React.CSSProperties}
            />
            <circle cx={d.x} cy={d.y} r="3.5" fill={d.color} />
          </g>
        ))}

        <g className="radar-mini-sweep" style={{ transformOrigin: "200px 200px" } as React.CSSProperties}>
          <path d="M 200 200 L 380 200 A 180 180 0 0 0 290 44 Z" fill="url(#rm-sweep-arc)" />
          <line x1="200" y1="200" x2="380" y2="200" stroke="url(#rm-sweep)" strokeWidth="2" />
        </g>

        <circle cx="200" cy="200" r="6" fill="var(--accent)" />
        <circle cx="200" cy="200" r="2.5" fill="var(--surface-1)" />
      </svg>

      <style>{`
        .radar-mini-wrap {
          position: absolute;
          /* Anchored to the TOP-RIGHT corner so it sits behind the headline
             whitespace only - the stat tiles along the bottom stay clear. */
          top: -70px;
          right: -80px;
          width: 300px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          mask-image: radial-gradient(circle at center, black 56%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black 56%, transparent 80%);
          pointer-events: none;
        }
        @media (max-width: 1023px) {
          .radar-mini-wrap { right: -90px; top: -90px; width: 260px; height: 260px; opacity: 0.7; }
        }
        .radar-mini-svg { width: 100%; height: 100%; }
        .radar-mini-sweep { animation: rm-spin 6s linear infinite; }
        .radar-mini-ping { animation: rm-ping 3s ease-in-out infinite; }
        @keyframes rm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rm-ping {
          0%, 100% { transform: scale(1); opacity: 0.18; }
          50% { transform: scale(1.6); opacity: 0.4; }
        }
        @media (prefers-reduced-motion: reduce) {
          .radar-mini-sweep, .radar-mini-ping { animation: none; }
        }
      `}</style>
    </div>
  );
}
