import Link from "next/link";
import { getSnapshot } from "@/lib/snapshot";
import { Hero } from "@/components/Hero";
import { TopGem } from "@/components/TopGem";
import { ConvergenceTicker } from "@/components/ConvergenceTicker";
import { FullFeed } from "@/components/FullFeed";
import { TomorrowsVideos } from "@/components/TomorrowsVideos";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

// The original long-scroll "launch page" layout. The dashboard at / is the
// default; this route is kept so the scroll layout is one click away.
export const revalidate = 300;

export default async function ClassicPage() {
  const snapshot = await getSnapshot();

  return (
    <main className="min-h-screen bg-canvas text-ink">
      <div
        className="mx-auto flex w-full max-w-[1200px] items-center justify-end px-4 md:px-6 pt-4"
      >
        <Link
          href="/"
          className="t-micro-label rounded-md border px-3 py-1.5 transition-colors hover:border-accent"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--ink-muted)" }}
        >
          Dashboard view →
        </Link>
      </div>
      <Hero snapshot={snapshot} />
      <TopGem snapshot={snapshot} />
      <ConvergenceTicker snapshot={snapshot} />
      <FullFeed snapshot={snapshot} />
      <TomorrowsVideos snapshot={snapshot} />
      <HowItWorks snapshot={snapshot} />
      <Footer snapshot={snapshot} />
    </main>
  );
}
