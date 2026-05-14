"use client";

/**
 * Small circular avatar pinned to the bottom-left corner of a preview tile.
 * Client component because it needs an onError handler - avatars come from
 * many hosts (github.com, yt3.ggpht.com, unavatar.io) and any one can 404;
 * we hide the badge rather than show a broken-image glyph.
 *
 * Plain <img> (not next/image) on purpose: these are tiny, from many hosts,
 * and unavatar needs to pass through un-transformed.
 */
export function AvatarBadge({ src, size }: { src: string; size: "lg" | "sm" }) {
  const px = size === "lg" ? 30 : 22;
  return (
    <span
      className="absolute left-1.5 bottom-1.5 overflow-hidden rounded-full"
      style={{
        width: px,
        height: px,
        border: "2px solid var(--canvas)",
        background: "var(--surface-3)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        width={px}
        height={px}
        className="size-full object-cover"
        onError={(e) => {
          const parent = e.currentTarget.parentElement;
          if (parent) parent.style.display = "none";
        }}
      />
    </span>
  );
}
