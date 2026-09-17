import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Railway build layers may carry a half-written .next/cache from a cancelled build,
    // which makes Turbopack panic with "Cache corruption detected". A cold build is safer.
    turbopackFileSystemCacheForBuild: false,
  },
  // The deployment is reachable by anyone who has the link; keep it out of search results.
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
