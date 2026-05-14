import Image from "next/image";
import { sourceColor } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";
import { SourceImageTile } from "./SourceImageTile";
import type { RawEvent } from "@/lib/snapshot";

/**
 * Per-source visual preview on the left/top of each feed card.
 *
 * Responsive: full-width (16:9) on mobile where the card stacks, fixed-width
 * from sm+ where it sits beside the content. All external images go through
 * next/image (Vercel edge-resize + 30-day cache).
 *
 * `size`:
 *   "lg" (default) - up to 260px wide, classic-view feed cards
 *   "sm"           - up to 150px wide, compact dashboard feed rows
 */
type Size = "lg" | "sm";

// w-full on mobile (the card stacks), a fixed cap from sm+. aspect-video
// keeps the 16:9 box shape at any width.
const WIDTH_CLASS: Record<Size, string> = {
  lg: "w-full sm:w-[260px]",
  sm: "w-full sm:w-[150px]",
};
const ICON_PX: Record<Size, number> = { lg: 44, sm: 30 };

export function SourcePreview({
  event,
  size = "lg",
}: {
  event: RawEvent;
  size?: Size;
}) {
  const eng = (event.engagement as Record<string, unknown> | null) || {};
  const colour = sourceColor(event.source);

  // YouTube - real thumbnail (falls back to the branded icon tile on error)
  if (event.source === "youtube_upload" || event.source === "youtube_search") {
    const thumb = (eng.thumbnail_url as string) || "";
    if (thumb) {
      return (
        <SourceImageTile
          src={thumb}
          colour={colour}
          source={event.source}
          overlay={size === "lg" ? fmtViews(eng.views) : undefined}
          widthClass={WIDTH_CLASS[size]}
        />
      );
    }
  }

  // GitHub - auto-generated OG card (falls back to the branded icon tile if
  // the OG endpoint is rate-limited / slow / missing - never blank)
  if (event.source === "github_trending" || event.source === "github_release") {
    const repo = githubOwnerRepo(event);
    if (repo) {
      const stars = (eng.stars_total as number) || 0;
      const overlay =
        size === "sm"
          ? undefined
          : event.source === "github_trending" && stars > 0
            ? `★ ${fmtNum(stars)}`
            : event.source === "github_release"
              ? "release"
              : "";
      return (
        <SourceImageTile
          src={`https://opengraph.githubassets.com/1/${repo.owner}/${repo.repo}`}
          colour={colour}
          source={event.source}
          overlay={overlay}
          fallbackLabel={event.source === "github_release" ? "release" : "trending"}
          widthClass={WIDTH_CLASS[size]}
        />
      );
    }
    return (
      <IconTile colour={colour} source={event.source} size={size}>
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
        className={`${WIDTH_CLASS[size]} aspect-video shrink-0 relative overflow-hidden rounded-md flex flex-col items-center justify-center`}
        style={{
          background: `linear-gradient(135deg, ${colour}, ${colour}88)`,
          border: `1px solid ${colour}55`,
        }}
      >
        <div style={{ color: "rgba(255,255,255,0.95)" }}>
          <SourceIcon source="reddit" size={size === "lg" ? 34 : 24} />
        </div>
        <span
          className="t-mono mt-1.5"
          style={{
            fontSize: size === "lg" ? "15px" : "12px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
            letterSpacing: "-0.02em",
          }}
        >
          r/{sub.length > 16 ? sub.slice(0, 15) + "…" : sub}
        </span>
      </div>
    );
  }

  // X - brand-coloured tile + likes count
  if (event.source === "x") {
    return (
      <IconTile colour={colour} source={event.source} size={size}>
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
          className={`${WIDTH_CLASS[size]} aspect-video shrink-0 relative overflow-hidden rounded-md flex items-center justify-center`}
          style={{ background: "var(--surface-2)", border: `1px solid ${colour}33` }}
        >
          <Image
            src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
            alt=""
            width={size === "lg" ? 64 : 40}
            height={size === "lg" ? 64 : 40}
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
                maxWidth: "85%",
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
      <IconTile colour={colour} source={event.source} size={size}>
        {size === "lg" && (
          <span
            className="t-mono"
            style={{ fontSize: "9px", color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.2 }}
          >
            {feed.length > 14 ? feed.slice(0, 13) + "…" : feed}
          </span>
        )}
      </IconTile>
    );
  }

  return <IconTile colour={colour} source={event.source} size={size} />;
}

function IconTile({
  colour,
  source,
  children,
  size,
}: {
  colour: string;
  source: string;
  children?: React.ReactNode;
  size: Size;
}) {
  return (
    <div
      className={`${WIDTH_CLASS[size]} aspect-video shrink-0 flex flex-col items-center justify-center gap-1 rounded-md`}
      style={{
        background: `linear-gradient(135deg, ${colour}1a, ${colour}05)`,
        border: `1px solid ${colour}33`,
      }}
    >
      <div style={{ color: colour }}>
        <SourceIcon source={source} size={ICON_PX[size]} />
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
