import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Trend Radar - finds AI topics before mainstream";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#010102",
          color: "#f7f8f8",
          fontFamily: "Inter, system-ui",
          padding: "64px 80px",
          position: "relative",
        }}
      >
        {/* Radar visual on the right */}
        <div
          style={{
            position: "absolute",
            right: -180,
            top: -60,
            width: 780,
            height: 780,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.7,
          }}
        >
          <svg width="780" height="780" viewBox="0 0 780 780">
            <defs>
              <radialGradient id="g" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#59d499" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#59d499" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#59d499" stopOpacity="0" />
                <stop offset="100%" stopColor="#59d499" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <circle cx="390" cy="390" r="350" fill="url(#g)" />
            <circle cx="390" cy="390" r="350" fill="none" stroke="#59d499" strokeWidth="1.5" opacity="0.25" />
            <circle cx="390" cy="390" r="250" fill="none" stroke="#59d499" strokeWidth="1.5" opacity="0.35" />
            <circle cx="390" cy="390" r="150" fill="none" stroke="#59d499" strokeWidth="1.5" opacity="0.5" />
            <circle cx="390" cy="390" r="60" fill="none" stroke="#59d499" strokeWidth="1.5" opacity="0.7" />
            <line x1="390" y1="390" x2="740" y2="390" stroke="url(#sweep)" strokeWidth="3" />
            <circle cx="390" cy="390" r="6" fill="#59d499" />
            {/* Six source dots */}
            <circle cx="540" cy="240" r="8" fill="#59d499" />
            <circle cx="640" cy="390" r="8" fill="#ff2047" />
            <circle cx="540" cy="540" r="8" fill="#ff801f" />
            <circle cx="240" cy="540" r="8" fill="#3b9eff" />
            <circle cx="140" cy="390" r="8" fill="#ffc533" />
            <circle cx="240" cy="240" r="8" fill="#59d499" />
          </svg>
        </div>

        {/* Top: brand chip */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 9999,
              background: "#59d499",
              boxShadow: "0 0 16px #59d499",
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              color: "#59d499",
            }}
          >
            Trend Radar · live · 6 sources
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 760, zIndex: 1 }}>
          <h1
            style={{
              fontSize: 86,
              fontWeight: 600,
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              margin: 0,
              marginBottom: 28,
            }}
          >
            Finds AI topics before they hit mainstream.
          </h1>
          <p
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "#d0d6e0",
              margin: 0,
              maxWidth: 700,
            }}
          >
            Six sources. Velocity-scored, not popularity. Cross-source convergence in 48h windows.
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            color: "#8a8f98",
            fontSize: 22,
          }}
        >
          <span>trendradar.jimibarkway.com</span>
          <span>By Jimi Barkway · MIT</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
