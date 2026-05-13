import { sourceColor } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";
import type { RawEvent } from "@/lib/snapshot";

/**
 * Per-source visual preview rendered on the left side of each feed card.
 * Adds the variety that turns a monotonous list into a scannable grid.
 *
 * - YouTube items use the real thumbnail (stored in engagement_raw.thumbnail_url)
 * - GitHub items show the source icon at large size, brand-tinted
 * - Reddit/X items show the source icon
 * - RSS items show the feed name
 *
 * Box dimensions are fixed so card heights stay consistent.
 */
export function SourcePreview({ event }: { event: RawEvent }) {
  const eng = (event.engagement as Record<string, unknown> | null) || {};
  const colour = sourceColor(event.source);

  // YouTube preview - use the real thumbnail if we have one
  if (event.source === "youtube_upload" || event.source === "youtube_search") {
    const thumb = (eng.thumbnail_url as string) || "";
    if (thumb) {
      return (
        <div
          className="shrink-0 relative overflow-hidden rounded-md"
          style={{
            width: 144,
            height: 81,
            background: "var(--surface-3)",
            border: `1px solid ${colour}33`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
          <span
            className="absolute right-1.5 bottom-1.5 t-mono rounded px-1.5 py-0.5"
            style={{
              fontSize: "10px",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
            }}
          >
            {fmtViews(eng.views)}
          </span>
        </div>
      );
    }
  }

  // GitHub trending - show language colour + repo stars
  if (event.source === "github_trending") {
    return (
      <IconTile colour={colour} source={event.source}>
        <span className="t-mono" style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
          ★ {fmtNum((eng.stars_total as number) || (eng.stars_period as number) || 0)}
        </span>
      </IconTile>
    );
  }

  // GitHub release - show release tag if any
  if (event.source === "github_release") {
    return (
      <IconTile colour={colour} source={event.source}>
        <span className="t-mono" style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
          release
        </span>
      </IconTile>
    );
  }

  // Reddit - show subreddit
  if (event.source === "reddit") {
    return (
      <IconTile colour={colour} source={event.source}>
        <span className="t-mono" style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
          r/{(eng.subreddit as string) || "?"}
        </span>
      </IconTile>
    );
  }

  // X - show likes + replies
  if (event.source === "x") {
    return (
      <IconTile colour={colour} source={event.source}>
        <span className="t-mono" style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
          ♥ {fmtNum((eng.likes as number) || 0)}
        </span>
      </IconTile>
    );
  }

  // RSS - show feed name
  if (event.source === "rss") {
    const feed = (eng.feed as string) || event.source_subtype || "feed";
    return (
      <IconTile colour={colour} source={event.source}>
        <span
          className="t-mono"
          style={{ fontSize: "9px", color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.2 }}
        >
          {feed.length > 12 ? feed.slice(0, 11) + "…" : feed}
        </span>
      </IconTile>
    );
  }

  return <IconTile colour={colour} source={event.source} />;
}

function IconTile({
  colour,
  source,
  children,
}: {
  colour: string;
  source: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-md"
      style={{
        width: 144,
        height: 81,
        background: `linear-gradient(135deg, ${colour}1a, ${colour}05)`,
        border: `1px solid ${colour}33`,
      }}
    >
      <div style={{ color: colour }}>
        <SourceIcon source={source} size={28} />
      </div>
      {children}
    </div>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
function fmtViews(v: unknown): string {
  const n = typeof v === "number" ? v : 0;
  if (!n) return "";
  return `${fmtNum(n)} views`;
}
