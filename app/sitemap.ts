import type { MetadataRoute } from "next";

import { GAMES } from "@/lib/games";
import { SITE_URL } from "@/lib/site";

/**
 * The pages worth finding (D-135).
 *
 * Built from the same GAMES list the floor and the rooms are built from
 * (D-019), so lighting up a cabinet adds its room and its machine here with
 * no second edit anywhere. `/sample` is left out on purpose: it is a
 * throwaway design page, and it asks not to be indexed.
 *
 * No `lastModified` on any row. The only honest value would be the moment the
 * server was built, and a page that tells every crawler it changed today when
 * all that happened was a restart is a small lie with a wide audience.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const rows: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/arcade`, changeFrequency: "monthly", priority: 0.9 },
  ];

  for (const game of GAMES.filter((entry) => entry.status === "playable")) {
    rows.push({
      url: `${SITE_URL}/arcade/${game.id}`,
      changeFrequency: "monthly",
      priority: 0.7,
    });
    rows.push({
      url: `${SITE_URL}/games/${game.id}`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return rows;
}
