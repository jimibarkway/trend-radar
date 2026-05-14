"use client";

/**
 * Left icon rail. Anchors jump to the card sections within the dashboard
 * grid. Active state tracks which section is in view.
 */
import { useEffect, useState } from "react";

const ITEMS = [
  { id: "overview", label: "Overview", icon: RadarIcon },
  { id: "feed", label: "Full feed", icon: FeedIcon },
  { id: "convergence", label: "Convergence", icon: ClusterIcon },
  { id: "videos", label: "Tomorrow's videos", icon: VideoIcon },
  { id: "how", label: "How it works", icon: InfoIcon },
];

export function NavRail() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    ITEMS.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <nav
      className="flex shrink-0 flex-row md:flex-col items-center gap-1 md:gap-2 px-2 py-2 md:px-2 md:py-4"
      style={{
        background: "var(--surface-1)",
        borderRight: "1px solid var(--hairline)",
      }}
      aria-label="Dashboard sections"
    >
      {/* Brand mark */}
      <a
        href="#overview"
        className="mb-1 md:mb-3 flex size-9 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-soft)" }}
        aria-label="Trend Radar"
      >
        <RadarIcon size={18} color="var(--accent)" />
      </a>
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const isActive = active === it.id;
        return (
          <a
            key={it.id}
            href={`#${it.id}`}
            title={it.label}
            className="flex size-9 items-center justify-center rounded-lg transition-colors"
            style={{
              background: isActive ? "var(--surface-3)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--ink-tertiary)",
            }}
          >
            <Icon size={17} color="currentColor" />
          </a>
        );
      })}
    </nav>
  );
}

/* --- icons (inline, currentColor) --- */
type IconProps = { size?: number; color?: string };

function RadarIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="12" x2="20" y2="8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
    </svg>
  );
}
function FeedIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="14" y2="18" />
    </svg>
  );
}
function ClusterIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="18" r="2" />
      <line x1="10.3" y1="10.3" x2="6.3" y2="7.3" />
      <line x1="13.7" y1="10.3" x2="17.6" y2="7.4" />
      <line x1="10.5" y1="13.7" x2="7.3" y2="17.2" />
      <line x1="13.6" y1="13.5" x2="16.6" y2="16.6" />
    </svg>
  );
}
function VideoIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M10 9.5 L15 12 L10 14.5 Z" fill={color} stroke="none" />
    </svg>
  );
}
function InfoIcon({ size = 18, color = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="7.5" r="0.6" fill={color} stroke={color} />
    </svg>
  );
}
