import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Whitelist remote sources used by feed-card previews. next/image then
    // proxies, resizes, and edge-caches them via Vercel - turns the 'few
    // seconds' GitHub-OG load into a single fast call after first viewer.
    remotePatterns: [
      { protocol: "https", hostname: "opengraph.githubassets.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "icons.duckduckgo.com" },
      { protocol: "https", hostname: "www.google.com" },
      { protocol: "https", hostname: "styles.redditmedia.com" },
      { protocol: "https", hostname: "external-preview.redd.it" },
      { protocol: "https", hostname: "preview.redd.it" },
    ],
    // 30-day edge cache. Source images change rarely; we accept potential
    // staleness for the 10x speedup.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
