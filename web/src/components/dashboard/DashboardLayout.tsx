import type { Snapshot } from "@/lib/snapshot";
import { TopBar } from "./TopBar";
import {
  OverviewCard,
  TopGemCard,
  SourceStatsRow,
  ConvergenceCard,
  VideosCard,
  FeedCard,
  HowCard,
} from "./cards";

/**
 * Control-panel layout: top bar + a 12-col card grid. Single-page dashboard,
 * no section nav needed. The long-scroll classic layout lives at /classic.
 *
 * Desktop: dense grid that mostly fills the viewport, cards scroll internally.
 * Mobile: collapses to a single column.
 */
export function DashboardLayout({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <TopBar snapshot={snapshot} />
      <main className="flex-1 overflow-y-auto p-4 md:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 auto-rows-min">
          {/* Row 1 - radar overview + feature gem */}
          <div className="lg:col-span-5 lg:h-[300px]">
            <OverviewCard snapshot={snapshot} />
          </div>
          <div className="lg:col-span-7 lg:h-[300px]">
            <TopGemCard snapshot={snapshot} />
          </div>

          {/* Row 2 - per-source stat strip */}
          <div className="lg:col-span-12">
            <SourceStatsRow snapshot={snapshot} />
          </div>

          {/* Row 3 - feed + convergence + videos */}
          <div className="lg:col-span-5 lg:h-[460px]">
            <FeedCard snapshot={snapshot} />
          </div>
          <div className="lg:col-span-4 lg:h-[460px]">
            <ConvergenceCard snapshot={snapshot} />
          </div>
          <div className="lg:col-span-3 lg:h-[460px]">
            <VideosCard snapshot={snapshot} />
          </div>

          {/* Row 4 - pipeline explainer */}
          <div className="lg:col-span-12">
            <HowCard />
          </div>
        </div>

        <footer
          className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1"
          style={{ color: "var(--ink-tertiary)" }}
        >
          <span className="t-supporting" style={{ fontSize: "12px" }}>
            Built by Jimi Barkway for Jack Roberts&apos; Trend Finder competition. MIT licensed.
          </span>
          {snapshot?.generated_at && (
            <span className="t-supporting" style={{ fontSize: "12px" }}>
              Snapshot {new Date(snapshot.generated_at).toISOString().slice(0, 16).replace("T", " ")} UTC
            </span>
          )}
        </footer>
      </main>
    </div>
  );
}
