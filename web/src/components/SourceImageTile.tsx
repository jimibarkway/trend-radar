"use client";

import { useState } from "react";
import Image from "next/image";
import { SourceIcon } from "./SourceIcon";

/**
 * Image preview tile with a guaranteed fallback. If the remote image fails
 * to load for ANY reason - rate limit on the GitHub OG endpoint, a timeout,
 * a 404, a slow network - the tile swaps to the branded icon design instead
 * of rendering blank.
 *
 * This is the quality-control guarantee: a feed card never shows an empty
 * preview box. Client component because it needs onError.
 */
export function SourceImageTile({
  src,
  colour,
  source,
  overlay,
  fallbackLabel,
  widthClass,
}: {
  src: string;
  colour: string;
  source: string;
  overlay?: string;
  fallbackLabel?: string;
  widthClass: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${widthClass} aspect-video shrink-0 flex flex-col items-center justify-center gap-1 rounded-md`}
        style={{
          background: `linear-gradient(135deg, ${colour}1a, ${colour}05)`,
          border: `1px solid ${colour}33`,
        }}
      >
        <div style={{ color: colour }}>
          <SourceIcon source={source} size={40} />
        </div>
        {fallbackLabel && (
          <span className="t-mono" style={{ fontSize: "10px", color: "var(--ink-muted)" }}>
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${widthClass} aspect-video shrink-0 relative overflow-hidden rounded-md`}
      style={{ background: "var(--surface-3)", border: `1px solid ${colour}33` }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 260px"
        style={{ objectFit: "cover" }}
        onError={() => setFailed(true)}
      />
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
