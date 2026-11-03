import { describe, expect, it } from "vitest";

import { GAMES } from "@/lib/games";
import { SITE_URL } from "@/lib/site";

import robots from "./robots";
import sitemap from "./sitemap";

/**
 * The two files a crawler reads (D-135). Both are generated, so both can be
 * wrong quietly: a sitemap that lists a throwaway page, or a robots file that
 * disallows the very page carrying a noindex tag. These check the shape of
 * each without a server.
 */

/** The one rule this site writes, as an object whatever form it takes. */
function theRule() {
  const rules = robots().rules;
  return Array.isArray(rules) ? rules[0] : rules;
}

function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

describe("the sitemap", () => {
  it("lists the door, the floor, and a room and a machine per live cabinet", () => {
    const urls = sitemap().map((row) => row.url);
    const playable = GAMES.filter((game) => game.status === "playable");
    expect(urls).toHaveLength(2 + playable.length * 2);
    expect(urls[0]).toBe(SITE_URL);
    expect(urls[1]).toBe(`${SITE_URL}/arcade`);
    for (const game of playable) {
      expect(urls).toContain(`${SITE_URL}/arcade/${game.id}`);
      expect(urls).toContain(`${SITE_URL}/games/${game.id}`);
    }
  });

  it("never lists a throwaway page", () => {
    for (const row of sitemap()) {
      expect(row.url).not.toMatch(/sample|preview/);
    }
  });

  it("builds every address from the one site address, so none is relative", () => {
    for (const row of sitemap()) {
      expect(row.url.startsWith(SITE_URL)).toBe(true);
      expect(row.url).not.toBe(`${SITE_URL}/`);
    }
  });

  it("claims no modification date it cannot back up", () => {
    for (const row of sitemap()) {
      expect(row.lastModified).toBeUndefined();
    }
  });
});

describe("the robots file", () => {
  it("lets a crawler read the site and points it at the sitemap", () => {
    expect(asList(theRule()?.allow)).toEqual(["/"]);
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });

  it("keeps crawlers off the wallet's doors", () => {
    expect(asList(theRule()?.disallow)).toContain("/api/");
  });

  it("does not disallow the sample page, whose noindex tag has to be readable", () => {
    for (const path of asList(theRule()?.disallow)) {
      expect(path).not.toMatch(/sample/);
    }
  });
});
