import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

/**
 * The crawler's instructions (D-135).
 *
 * Before this file existed the site answered 404 on `/robots.txt`, so a
 * crawler had nothing to read and indexed whatever it found, throwaway pages
 * included.
 *
 * Two choices worth saying out loud:
 *
 *  - The API routes are disallowed. They answer with JSON no crawler can use,
 *    and five of them make the wallet take its lock, so crawler traffic there
 *    is a cost with no benefit.
 *  - `/sample` is NOT disallowed. It carries a noindex tag instead, and a
 *    crawler told to stay away can never read that tag. Disallowing a page
 *    you want dropped is how a page stays in the index with no description
 *    against it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
