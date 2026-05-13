/**
 * Trend Radar - single-page dashboard.
 * Sections wire up to real snapshot data over days 6-11. This file is the shell.
 */

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <Hero />
      <TopGem />
      <ConvergenceTicker />
      <FullFeed />
      <TomorrowsVideos />
      <HowItWorks />
      <Footer />
    </main>
  );
}

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto w-full max-w-[1200px] px-6 py-24 ${className}`}>
      {children}
    </section>
  );
}

function Hero() {
  return (
    <Section className="pt-32 pb-20">
      <p className="t-micro-label mb-6" style={{ color: "var(--accent)" }}>
        Trend Radar · live
      </p>
      <h1 className="t-display-xl mb-6 max-w-[18ch]">
        Finds AI topics before they hit mainstream.
      </h1>
      <p className="t-body-lead mb-10 max-w-[60ch]" style={{ color: "var(--ink-muted)" }}>
        Six sources. Velocity-scored, not popularity. Updated hourly.
        Currently tracking <span style={{ color: "var(--ink)" }}>493 signals</span> across six sources.{" "}
        <span style={{ color: "var(--accent)" }}>14 surfaced as hidden gems</span> in the last seven days.
      </p>
      <a
        href="#top-gem"
        className="inline-flex items-center gap-2 rounded-md border px-5 py-2 text-sm font-medium transition-colors"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--ink)" }}
      >
        See today&apos;s top signal ↓
      </a>
    </Section>
  );
}

function TopGem() {
  return (
    <Section id="top-gem" className="border-t" >
      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: "-1px" }}>
        <p className="t-micro-label mb-4 mt-12" style={{ color: "var(--accent)" }}>
          Today&apos;s top hidden gem
        </p>
        <div
          className="rounded-lg p-10 transition-colors"
          style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)" }}
        >
          <p className="t-supporting mb-2">Placeholder - wires up day 6</p>
          <h2 className="t-display-md mb-4">Top opportunity title goes here</h2>
          <p className="t-body" style={{ color: "var(--ink-muted)" }}>
            One-sentence why-it-matters, source convergence badges, velocity stat,
            timestamp first detected, link out.
          </p>
        </div>
      </div>
    </Section>
  );
}

function ConvergenceTicker() {
  return (
    <Section className="border-t" >
      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: "-1px" }}>
        <p className="t-micro-label mb-4 mt-12" style={{ color: "var(--accent)" }}>
          Convergence ticker
        </p>
        <h2 className="t-headline mb-6">Topics across multiple sources right now</h2>
        <p className="t-supporting">Placeholder - wires up day 7</p>
      </div>
    </Section>
  );
}

function FullFeed() {
  return (
    <Section>
      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: "-1px" }}>
        <p className="t-micro-label mb-4 mt-12" style={{ color: "var(--accent)" }}>
          The full feed
        </p>
        <h2 className="t-headline mb-6">All scored signals, filterable</h2>
        <p className="t-supporting">Placeholder - wires up day 8</p>
      </div>
    </Section>
  );
}

function TomorrowsVideos() {
  return (
    <Section>
      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: "-1px" }}>
        <p className="t-micro-label mb-4 mt-12" style={{ color: "var(--rising)" }}>
          Tomorrow&apos;s videos
        </p>
        <h2 className="t-headline mb-6">Top opportunities as ready-to-record drafts</h2>
        <p className="t-supporting">Placeholder - wires up day 11</p>
      </div>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section>
      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: "-1px" }}>
        <p className="t-micro-label mb-4 mt-12" style={{ color: "var(--accent)" }}>
          How it works
        </p>
        <h2 className="t-headline mb-6">Six sources. Velocity over popularity.</h2>
        <p className="t-supporting">Placeholder - wires up day 9</p>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer
      className="mx-auto w-full max-w-[1200px] px-6 py-12"
      style={{ borderTop: "1px solid var(--hairline)" }}
    >
      <p className="t-supporting" style={{ color: "var(--ink-tertiary)" }}>
        Built by Jimi Barkway for Jack Roberts&apos; Trend Finder competition,
        May 2026. MIT licensed.
      </p>
    </footer>
  );
}
