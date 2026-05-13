import type { Snapshot } from "@/lib/snapshot";
import { relativeTime } from "@/lib/format";

export function Footer({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <footer
      className="mx-auto w-full max-w-[1200px] px-6 py-12"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
          Built by{" "}
          <a
            href="https://www.youtube.com/@jimibarkway"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--ink-muted)" }}
          >
            Jimi Barkway
          </a>{" "}
          for Jack Roberts&apos; Trend Finder competition, May 2026. MIT licensed.
        </p>
        <div className="flex items-center gap-4 t-supporting">
          <a
            href="https://github.com/jimibarkway/trend-radar"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--ink-muted)" }}
          >
            GitHub
          </a>
          {snapshot?.generated_at && (
            <span style={{ color: "var(--ink-tertiary)" }}>
              Snapshot {relativeTime(snapshot.generated_at)}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
