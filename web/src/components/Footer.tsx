import type { Snapshot } from "@/lib/snapshot";
import { relativeTime } from "@/lib/format";

const STACK = [
  { name: "Next.js 16", url: "https://nextjs.org" },
  { name: "Tailwind v4", url: "https://tailwindcss.com" },
  { name: "Gemini 3 Pro", url: "https://ai.google.dev" },
  { name: "Vercel Blob", url: "https://vercel.com/storage/blob" },
  { name: "SQLite", url: "https://sqlite.org" },
  { name: "Tavily", url: "https://tavily.com" },
];

export function Footer({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <footer
      className="mx-auto w-full max-w-[1200px] px-4 md:px-6 py-12"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-md">
          <p className="t-supporting mb-2" style={{ color: "var(--ink-muted)" }}>
            Built by{" "}
            <a
              href="https://www.youtube.com/@jimibarkway"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--ink)" }}
            >
              Jimi Barkway
            </a>{" "}
            for Jack Roberts&apos; Trend Finder competition.
          </p>
          <p className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
            MIT licensed. Open source. Runs on free tiers.
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
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
          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="t-supporting" style={{ color: "var(--ink-tertiary)", fontSize: "11px" }}>
              Powered by:
            </span>
            {STACK.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="t-micro-label rounded px-2 py-0.5 transition-colors hover:opacity-80"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  color: "var(--ink-muted)",
                  fontSize: "10px",
                }}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
