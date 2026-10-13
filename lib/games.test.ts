import { describe, expect, it } from "vitest";

import { GAMES } from "./games";

/**
 * The hub list and its rooms (D-019, D-078). The floor and the rooms both
 * render from this one list, so these tests guard the promises the rooms
 * make: every playable game has a room with real copy, sealed games stay
 * sealed with no room to wander into, and no room line spills an answer.
 */

describe("the hub list", () => {
  it("gives every playable game a room: about, teaches, sees and a machine", () => {
    for (const game of GAMES.filter((g) => g.status === "playable")) {
      expect(game.about?.length).toBeGreaterThan(0);
      expect(game.teaches?.length).toBeGreaterThan(0);
      expect(game.sees?.length).toBeGreaterThan(0);
      expect(game.href?.length).toBeGreaterThan(0);
    }
  });

  it("keeps sealed games sealed: no room copy until they are playable", () => {
    for (const game of GAMES.filter((g) => g.status !== "playable")) {
      expect(game.about).toBeUndefined();
    }
  });

  it("says room copy in the house voice and never spills an answer", () => {
    for (const game of GAMES) {
      for (const line of [game.about, game.teaches, game.sees]) {
        if (!line) continue;
        expect(line).not.toMatch(/[—–]/);
        expect(line).not.toMatch(/cannot be known/i);
      }
    }
  });

  it("lights cabinet two for The Crowd after the owner's verdict", () => {
    const crowd = GAMES.find((g) => g.id === "crowd");
    expect(crowd?.status).toBe("playable");
    expect(crowd?.href).toBe("/games/crowd");
    expect(crowd?.glyph).toBe("crowd");
    expect(crowd?.cast).toBe("crowd");
    const unseen = GAMES.find((g) => g.id === "unseen");
    expect(unseen?.status).toBe("playable");
    expect(unseen?.href).toBe("/games/unseen");
  });
});
