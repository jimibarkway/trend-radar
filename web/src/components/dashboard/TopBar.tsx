import Link from "next/link";
import type { Snapshot } from "@/lib/snapshot";
import { relativeTime } from "@/lib/format";

export function TopBar({ snapshot }: { snapshot: Snapshot | null }) {
  const sources = snapshot?.meta.sources_tracked.length ?? 6;
  const lastIngest = snapshot?.meta.last_ingest_at;

  return (
    <header
      className="flex shrink-0 items-center gap-4 px-4 md:px-6 py-3"
      style={{
        background: "var(--surface-1)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: "var(--accent)", boxShadow: "0 0 10px var(--accent)" }}
          aria-hidden
        />
        <span className="t-micro-label" style={{ color: "var(--accent)" }}>
          Trend Radar
        </span>
        <span className="t-supporting hidden sm:inline" style={{ color: "var(--ink-tertiary)", fontSize: "12px" }}>
          live · {sources} sources
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3 md:gap-4">
        {lastIngest && (
          <span
            className="t-supporting hidden md:inline"
            style={{ color: "var(--ink-tertiary)", fontSize: "12px" }}
          >
            Refreshed {relativeTime(lastIngest)}
          </span>
        )}
        <Link
          href="/classic"
          className="t-micro-label rounded-md border px-3 py-1.5 transition-colors hover:border-accent"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-muted)" }}
        >
          Classic view
        </Link>
        <a
          href="https://github.com/jimibarkway/trend-radar"
          target="_blank"
          rel="noopener noreferrer"
          className="t-micro-label hidden sm:inline"
          style={{ color: "var(--ink-tertiary)" }}
        >
          GitHub
        </a>
      </div>
    </header>
  );
}
