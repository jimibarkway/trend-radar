import "server-only";

/**
 * Trend Radar snapshot - shape mirrors pipeline/scripts/export_snapshot.py.
 *
 * Production reads from Vercel Blob (set NEXT_PUBLIC_SNAPSHOT_URL).
 * Local dev / docker-compose reads from /snapshot.json under web/public/.
 */

export type Source =
  | "github_release"
  | "github_trending"
  | "youtube_upload"
  | "youtube_search"
  | "reddit"
  | "rss"
  | "x";

export type RawEvent = {
  id: string;
  source: Source | string;
  source_subtype?: string;
  url: string;
  title: string;
  body_excerpt?: string;
  author?: string;
  ingested_at: string;
  published_at?: string | null;
  niche_score?: number;
  velocity_score?: number;
  freshness_score?: number;
  composite_score?: number;
  cluster_id?: string | null;
  engagement?: Record<string, unknown> | null;
};

export type Cluster = {
  id: string;
  centroid_title: string;
  member_count: number;
  source_count: number;
  sources: string[];
  max_composite: number;
  cluster_score: number;
  first_seen: string;
  last_seen: string;
  members: Array<Pick<RawEvent, "id" | "source" | "title" | "url" | "composite_score" | "published_at">>;
};

export type HiddenGem = RawEvent & { gem_reason?: string | null };

export type TomorrowsVideo = RawEvent & {
  primary_title: string;
  alt_titles: string[];
  hook_first_2_sentences: string;
  outline_30s: string[];
  angles_generated_at: string;
};

export type VelocitySample = {
  metric_used: string;
  raw_value: number;
  velocity: number;
  source: string;
  title: string;
  url: string;
};

export type Snapshot = {
  version: number;
  generated_at: string;
  meta: {
    total_events: number;
    counts_by_source: Record<string, number>;
    last_ingest_at: string | null;
    last_score_at: string | null;
    sources_tracked: string[];
  };
  top_opportunities: RawEvent[];
  top_clusters: Cluster[];
  hidden_gems: HiddenGem[];
  tomorrows_videos: TomorrowsVideo[];
  velocity_samples: VelocitySample[];
};

const REMOTE_URL = process.env.NEXT_PUBLIC_SNAPSHOT_URL;

export async function getSnapshot(): Promise<Snapshot | null> {
  if (REMOTE_URL) {
    try {
      const res = await fetch(REMOTE_URL, {
        next: { revalidate: 300 },
      });
      if (!res.ok) {
        console.error("snapshot fetch failed", res.status, res.statusText);
        return null;
      }
      return (await res.json()) as Snapshot;
    } catch (err) {
      console.error("snapshot fetch error", err);
      return null;
    }
  }

  // Local dev / docker: read from web/public/snapshot.json on disk.
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(join(process.cwd(), "public", "snapshot.json"), "utf-8");
    return JSON.parse(buf) as Snapshot;
  } catch {
    return null;
  }
}
