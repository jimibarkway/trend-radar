"use client";

import { useState } from "react";
import type { Snapshot, TomorrowsVideo } from "@/lib/snapshot";
import { sourceLabel, sourceColor, formatScore } from "@/lib/format";
import { SourceIcon } from "./SourceIcon";

export function TomorrowsVideos({ snapshot }: { snapshot: Snapshot | null }) {
  const videos = snapshot?.tomorrows_videos ?? [];
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-16 md:py-24"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-micro-label mb-3" style={{ color: "var(--rising)" }}>
        Tomorrow&apos;s videos
      </p>
      <h2 className="t-headline mb-8">
        {videos.length > 0
          ? `${videos.length} drafts ready to record`
          : "Top opportunities as drafts"}
      </h2>

      {videos.length === 0 ? (
        <div
          className="rounded-lg p-10"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <p className="t-supporting">
            No drafts yet. Run <code className="t-mono">make angles</code> to generate the
            top 5 from the current opportunity feed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              open={openId === v.id}
              onToggle={() => setOpenId(openId === v.id ? null : v.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoCard({
  video,
  open,
  onToggle,
}: {
  video: TomorrowsVideo;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="rounded-lg overflow-hidden transition-colors"
      style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
    >
      <button
        onClick={onToggle}
        className="w-full p-6 text-left transition-colors hover:bg-[var(--surface-2)]"
      >
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span
            className="t-micro-label inline-flex items-center gap-1.5 rounded px-2 py-1"
            style={{
              background: sourceColor(video.source) + "22",
              color: sourceColor(video.source),
              border: `1px solid ${sourceColor(video.source)}44`,
            }}
          >
            <SourceIcon source={video.source} size={11} />
            from {sourceLabel(video.source)}
          </span>
          <span className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
            composite {formatScore(video.composite_score)}
          </span>
          <span className="ml-auto t-supporting" style={{ color: "var(--accent)" }}>
            {open ? "Collapse ↑" : "Expand ↓"}
          </span>
        </div>
        <h3 className="t-body-lead" style={{ color: "var(--ink)" }}>
          {video.primary_title}
        </h3>
      </button>

      {open && (
        <div
          className="space-y-6 px-6 pb-6"
          style={{ borderTop: "1px solid var(--hairline)", paddingTop: "1.5rem" }}
        >
          <Block label="Alt titles">
            <ul className="space-y-1">
              {video.alt_titles.map((t, i) => (
                <li key={i} className="t-body" style={{ color: "var(--ink-muted)" }}>
                  · {t}
                </li>
              ))}
            </ul>
          </Block>

          <Block label="Spoken hook (first 2 sentences)">
            <p className="t-body-lead" style={{ color: "var(--ink)" }}>
              {video.hook_first_2_sentences}
            </p>
          </Block>

          <Block label="30-second outline">
            <ol className="space-y-2">
              {video.outline_30s.map((b, i) => (
                <li key={i} className="t-body flex gap-3" style={{ color: "var(--ink-muted)" }}>
                  <span className="t-mono shrink-0 w-6" style={{ color: "var(--ink-tertiary)" }}>
                    {i + 1}.
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ol>
          </Block>

          <Block label="Source signal">
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="t-body line-clamp-2"
              style={{ color: "var(--accent)" }}
            >
              {video.title} →
            </a>
          </Block>
        </div>
      )}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="t-micro-label mb-2">{label}</p>
      {children}
    </div>
  );
}
