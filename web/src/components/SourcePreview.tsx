import Image from "next/image";
import { sourceColor } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";
import type { RawEvent } from "@/lib/snapshot";

/**
 * Per-source visual preview rendered on the left side of each feed card.
 *
 * Every external image goes through next/image so Vercel edge-resizes,
 * format-shifts (avif/webp), and caches for 30 days. This is what turns the
 * 'few seconds to load after Show More' issue (GitHub OG rate-limit at
 * 100/hr per viewer IP) into a single fast call after the first visitor.
 */
export function SourcePreview({ event }: { event: RawEvent }) {
  const eng = (event.engagement as Record<string, unknown> | null) || {};
  const colour = sourceColor(event.source);

  // YouTube preview - use the real thumbnail
  if (event.source === "youtube_upload" || event.source === "youtube_search") {
    const thumb = (eng.thumbnail_url as string) || "";
    if (thumb) {
      return (
        <ImageTile colour={colour} src={thumb} overlay={fmtViews(eng.views)} />
      );
    }
  }

  // GitHub - use the auto-generated OG card
  if (event.source === "github_trending" || event.source === "github_release") {
    const repo = githubOwnerRepo(event);
    if (repo) {
      const stars = (eng.stars_total as number) || (eng.stars_period as number) || 0;
      const overlay =
        event.source === "github_trending" && stars > 0
          ? `★ ${fmtNum(stars)}`
          : event.source === "github_release"
            ? "release"
            : "";
      return (
        <ImageTile
          colour={colour}
          src={`https://opengraph.githubassets.com/1/${repo.owner}/${repo.repo}`}
          overlay={overlay}
        />
      );
    }
    return (
      <IconTile colour={colour} source={event.source}>
        <span className="t-mono" style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
          {event.source === "github_release" ? "release" : "trending"}
        </span>
      </IconTile>
    );
  }

  // Reddit - subreddit gradient + sub name (no reliable per-post image yet)
  if (event.source === "reddit") {
    const sub = (eng.subreddit as string) || "?";
    return (
      <div
        className="shrink-0 relative overflow-hidden rounded-md flex flex-col items-center justify-center"
        style={{
          width: TILE_W,
          height: TILE_H,
          background: `linear-gradient(135deg, ${colour}, ${colour}88)`,
          border: `1px solid ${colour}55`,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.95)" }}>
          <SourceIcon source="reddit" size={24} />
        </div>
        <span
          className="t-mono mt-1"
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "-0.02em",
          }}
        >
          r/{sub}
        </span>
      </div>
    );
  }

  // X - author avatar would be ideal; the ingest doesn't store it yet, so
  // render the brand-coloured tile with likes count.
  if (event.source === "x") {
    return (
      <IconTile colour={colour} source={event.source}>
        <span className="t-mono" style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
          ♥ {fmtNum((eng.likes as number) || 0)}
        </span>
      </IconTile>
    );
  }

  // RSS - use the feed's actual favicon via DuckDuckGo's favicon service.
  // We don't have the feed URL in the event; map common feed names to a
  // canonical domain. Anything not in the map falls back to the icon tile.
  if (event.source === "rss") {
    const feed = (eng.feed as string) || event.source_subtype || "";
    const domain = RSS_DOMAINS[feed];
    if (domain) {
      return (
        <div
          className="shrink-0 relative overflow-hidden rounded-md flex items-center justify-center"
          style={{
            width: 144,
            height: 81,
            background: "var(--surface-2)",
            border: `1px solid ${colour}33`,
          }}
        >
          <Image
            src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
            alt=""
            width={48}
            height={48}
            unoptimized
            style={{ objectFit: "contain" }}
          />
          <span
            className="absolute right-1.5 bottom-1.5 t-mono rounded px-1.5 py-0.5"
            style={{
              fontSize: "9px",
              background: "rgba(0,0,0,0.6)",
              color: "rgba(255,255,255,0.9)",
              maxWidth: 130,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {feed}
          </span>
        </div>
      );
    }
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

// Card preview tile dimensions - bumped from 144x81 so OG card text is legible
const TILE_W = 184;
const TILE_H = 104;

function ImageTile({
  colour,
  src,
  overlay,
}: {
  colour: string;
  src: string;
  overlay?: string;
}) {
  return (
    <div
      className="shrink-0 relative overflow-hidden rounded-md"
      style={{
        width: TILE_W,
        height: TILE_H,
        background: "var(--surface-3)",
        border: `1px solid ${colour}33`,
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes={`${TILE_W}px`}
        style={{ objectFit: "cover" }}
      />
      {overlay && (
        <span
          className="absolute right-1.5 bottom-1.5 t-mono rounded px-1.5 py-0.5"
          style={{
            fontSize: "10px",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
          }}
        >
          {overlay}
        </span>
      )}
    </div>
  );
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
        width: TILE_W,
        height: TILE_H,
        background: `linear-gradient(135deg, ${colour}1a, ${colour}05)`,
        border: `1px solid ${colour}33`,
      }}
    >
      <div style={{ color: colour }}>
        <SourceIcon source={source} size={32} />
      </div>
      {children}
    </div>
  );
}

function githubOwnerRepo(event: RawEvent): { owner: string; repo: string } | null {
  if (event.source === "github_trending" && event.title.includes("/")) {
    const [owner, repo] = event.title.split("/", 2);
    if (owner && repo) return { owner: owner.trim(), repo: repo.trim() };
  }
  if (event.source === "github_release" && event.author && event.author.includes("/")) {
    const [owner, repo] = event.author.split("/", 2);
    if (owner && repo) return { owner: owner.trim(), repo: repo.trim() };
  }
  const m = event.url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (m) {
    return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
  }
  return null;
}

const RSS_DOMAINS: Record<string, string> = {
  "Anthropic News": "anthropic.com",
  "OpenAI Blog": "openai.com",
  "Google DeepMind": "deepmind.google",
  "GitHub Blog": "github.blog",
  "Changelog": "changelog.com",
  "Latent Space": "latent.space",
  "Every": "every.to",
  "Hacker News": "news.ycombinator.com",
  "Hacker News (front page)": "news.ycombinator.com",
  "Simon Willison": "simonwillison.net",
  "Hugging Face Blog": "huggingface.co",
  "Y Combinator Blog": "ycombinator.com",
  "Lenny's Newsletter": "lennysnewsletter.com",
  "Last Week in AI": "lastweekin.ai",
  "TechCrunch AI": "techcrunch.com",
  "arXiv cs.AI": "arxiv.org",
  "Pragmatic Engineer": "pragmaticengineer.com",
  "AI Tidbits": "aitidbits.ai",
  "Buttondown AINews": "buttondown.com",
};

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
