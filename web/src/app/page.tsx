import { getSnapshot } from "@/lib/snapshot";
import { Hero } from "@/components/Hero";
import { TopGem } from "@/components/TopGem";
import { ConvergenceTicker } from "@/components/ConvergenceTicker";
import { FullFeed } from "@/components/FullFeed";
import { TomorrowsVideos } from "@/components/TomorrowsVideos";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

// Edge-revalidate every 5 minutes so the dashboard stays fresh without
// re-running the pipeline on every request.
export const revalidate = 300;

export default async function Home() {
  const snapshot = await getSnapshot();

  return (
    <main className="min-h-screen bg-canvas text-ink">
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
