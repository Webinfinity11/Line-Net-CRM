import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // the dev-only "N" badge sits on top of the phone bottom bar and hides its first tab
  devIndicators: false,
  experimental: {
    // Railway build layers may carry a half-written .next/cache from a cancelled build,
    // which makes Turbopack panic with "Cache corruption detected". A cold build is safer.
    turbopackFileSystemCacheForBuild: false,
    // photos are shrunk in the browser first (lib/compress-image.ts); Vercel rejects any request above 4.5 MB
    serverActions: { bodySizeLimit: "4mb" },
  },
  // The deployment is reachable by anyone who has the link; keep it out of search results.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
