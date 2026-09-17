import type { MetadataRoute } from "next";

/** A private CRM: nothing here belongs in a search index. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
