import Image from "next/image";
import { sourceColor } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";
import { AvatarBadge } from "./AvatarBadge";
import type { RawEvent } from "@/lib/snapshot";

/**
 * Per-source visual preview rendered on the left side of each feed card.
 *
 * Every external image goes through next/image so Vercel edge-resizes,
 * format-shifts (avif/webp), and caches for 30 days.
 *
 * `size`:
 *   "lg" (default) - 240x135, the classic-view feed cards
 *   "sm"           - 132x74, the compact dashboard feed rows
 */
type Size = "lg" | "sm";

const DIMS: Record<Size, { w: number; h: number; icon: number; iconBig: number }> = {
  lg: { w: 240, h: 135, icon: 72, iconBig: 42 },
  sm: { w: 132, h: 74, icon: 40, iconBig: 26 },
};

export function SourcePreview({
  event,
  size = "lg",
}: {
  event: RawEvent;
  size?: Size;
}) {
  const eng = (event.engagement as Record<string, unknown> | null) || {};
  const colour = sourceColor(event.source);
  const d = DIMS[size];

  // YouTube preview - thumbnail + channel avatar in the corner
  if (event.source === "youtube_upload" || event.source === "youtube_search") {
    const thumb = (eng.thumbnail_url as string) || "";
    if (thumb) {
      return (
        <ImageTile
          colour={colour}
          src={thumb}
          overlay={size === "lg" ? fmtViews(eng.views) : undefined}
          avatar={(eng.channel_avatar_url as string) || undefined}
          d={d}
        />
      );
    }
  }

  // GitHub - OG card + repo owner's avatar in the corner
  if (event.source === "github_trending" || event.source === "github_release") {
    const repo = githubOwnerRepo(event);
    if (repo) {
      const stars = (eng.stars_total as number) || (eng.stars_period as number) || 0;
      const overlay =
        size === "sm"
          ? undefined
          : event.source === "github_trending" && stars > 0
            ? `★ ${fmtNum(stars)}`
            : event.source === "github_release"
              ? "release"
              : "";
      return (
        <ImageTile
          colour={colour}
          src={`https://opengraph.githubassets.com/1/${repo.owner}/${repo.repo}`}
          overlay={overlay}
          avatar={`https://github.com/${repo.owner}.png?size=80`}
          d={d}
        />
      );
    }
    return (
      <IconTile colour={colour} source={event.source} d={d}>
        {size === "lg" && (
          <span className="t-mono" style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
            {event.source === "github_release" ? "release" : "trending"}
          </span>
        )}
      </IconTile>
    );
  }

  // Reddit - subreddit gradient + sub name
  if (event.source === "reddit") {
    const sub = (eng.subreddit as string) || "?";
    return (
      <div
        className="shrink-0 relative overflow-hidden rounded-md flex flex-col items-center justify-center"
        style={{
          width: d.w,
          height: d.h,
          background: `linear-gradient(135deg, ${colour}, ${colour}88)`,
          border: `1px solid ${colour}55`,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.95)" }}>
          <SourceIcon source="reddit" size={size === "lg" ? 36 : 22} />
        </div>
        <span
          className="t-mono mt-1.5"
          style={{
            fontSize: size === "lg" ? "16px" : "11px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "-0.02em",
          }}
        >
          r/{sub.length > 14 ? sub.slice(0, 13) + "…" : sub}
        </span>
      </div>
    );
  }

  // X - brand-coloured tile + author avatar (resolved via unavatar.io) + likes
  if (event.source === "x") {
    const handle = (eng.author_handle as string) || "";
    const avatar =
      handle && handle !== "?"
        ? `https://unavatar.io/twitter/${handle}`
        : undefined;
    return (
      <IconTile colour={colour} source={event.source} d={d} avatar={avatar}>
        {size === "lg" && (
          <span className="t-mono" style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
            ♥ {fmtNum((eng.likes as number) || 0)}
          </span>
        )}
      </IconTile>
    );
  }

  // RSS - the feed's actual favicon via DuckDuckGo's favicon service
  if (event.source === "rss") {
    const feed = (eng.feed as string) || event.source_subtype || "";
    const domain = RSS_DOMAINS[feed];
    if (domain) {
      return (
        <div
          className="shrink-0 relative overflow-hidden rounded-md flex items-center justify-center"
          style={{
            width: d.w,
            height: d.h,
            background: "var(--surface-2)",
            border: `1px solid ${colour}33`,
          }}
        >
          <Image
            src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
            alt=""
            width={size === "lg" ? 72 : 36}
            height={size === "lg" ? 72 : 36}
            unoptimized
            style={{ objectFit: "contain" }}
          />
          {size === "lg" && (
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
          )}
        </div>
      );
    }
    return (
      <IconTile colour={colour} source={event.source} d={d}>
        {size === "lg" && (
          <span
            className="t-mono"
            style={{ fontSize: "9px", color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.2 }}
          >
            {feed.length > 12 ? feed.slice(0, 11) + "…" : feed}
          </span>
        )}
      </IconTile>
    );
  }

  return <IconTile colour={colour} source={event.source} d={d} />;
}

type Dims = { w: number; h: number; icon: number; iconBig: number };

function ImageTile({
  colour,
  src,
  overlay,
  avatar,
  d,
}: {
  colour: string;
  src: string;
  overlay?: string;
  avatar?: string;
  d: Dims;
}) {
  return (
    <div
      className="shrink-0 relative overflow-hidden rounded-md"
      style={{
        width: d.w,
        height: d.h,
        background: "var(--surface-3)",
        border: `1px solid ${colour}33`,
      }}
    >
      <Image src={src} alt="" fill sizes={`${d.w}px`} style={{ objectFit: "cover" }} />
      {avatar && <AvatarBadge src={avatar} size={d.w > 180 ? "lg" : "sm"} />}
      {overlay && (
        <span
          className="absolute right-1.5 bottom-1.5 t-mono rounded px-1.5 py-0.5"
          style={{ fontSize: "10px", background: "rgba(0,0,0,0.7)", color: "#fff" }}
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
  avatar,
  d,
}: {
  colour: string;
  source: string;
  children?: React.ReactNode;
  avatar?: string;
  d: Dims;
}) {
  return (
    <div
      className="shrink-0 relative flex flex-col items-center justify-center gap-1 rounded-md"
      style={{
        width: d.w,
        height: d.h,
        background: `linear-gradient(135deg, ${colour}1a, ${colour}05)`,
        border: `1px solid ${colour}33`,
      }}
    >
      <div style={{ color: colour }}>
        <SourceIcon source={source} size={d.iconBig} />
      </div>
      {children}
      {avatar && <AvatarBadge src={avatar} size={d.w > 180 ? "lg" : "sm"} />}
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
