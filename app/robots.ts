import type { MetadataRoute } from "next";

/**
 * Block all search engine crawlers. This is an internal app and should not be indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
