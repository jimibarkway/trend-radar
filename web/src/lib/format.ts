import type { Source } from "./snapshot";

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 4) return `${diffWk}w ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export const SOURCE_COLORS: Record<string, string> = {
  github_release: "var(--src-github)",
  github_trending: "var(--src-github)",
  youtube_upload: "var(--src-youtube)",
  youtube_search: "var(--src-youtube)",
  reddit: "var(--src-reddit)",
  rss: "var(--src-rss)",
  x: "var(--src-x)",
};

export const SOURCE_LABELS: Record<string, string> = {
  github_release: "GitHub release",
  github_trending: "GitHub trending",
  youtube_upload: "YouTube",
  youtube_search: "YouTube search",
  reddit: "Reddit",
  rss: "RSS",
  x: "X",
};

export function sourceLabel(s: Source | string): string {
  return SOURCE_LABELS[s] ?? s;
}

export function sourceColor(s: Source | string): string {
  return SOURCE_COLORS[s] ?? "var(--ink-subtle)";
}

export function formatScore(n: number | undefined | null): string {
  if (n == null) return "-";
  return n.toFixed(0);
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function gemReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "small_repo": return "Small repo · under 1k stars";
    case "small_channel": return "Small channel outlier · overperforming";
    case "small_account": return "Small account";
    case "fresh_fast": return "Fresh & accelerating";
    default: return "Hidden gem";
  }
}
