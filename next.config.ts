import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Railway build layers may carry a half-written .next/cache from a cancelled build,
    // which makes Turbopack panic with "Cache corruption detected". A cold build is safer.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
