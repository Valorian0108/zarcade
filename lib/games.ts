/**
 * The hub is DATA-DRIVEN (D-019). This list is the single source of truth.
 * The lobby sorts playable games first and gives the hero (double-width) slot
 * to the FIRST playable entry. Lighting up G2 later is a one-line status flip
 * here ("soon" -> "playable" + an href), not a redesign.
 *
 * Copy follows the Layer 4 voice rule (D-018): plain words, short sentences,
 * no em dashes, grandma-readable.
 */

export type GameStatus = "playable" | "soon";
export type GlyphName = "proof" | "doublespend" | "auditor" | "vault";

export interface GameEntry {
  id: string;
  name: string;
  /** One plain line: what this game teaches. Always visible on the cabinet. */
  teach: string;
  status: GameStatus;
  /** Where a playable cabinet goes when opened. */
  href?: string;
  /** Custom vector glyph shown faintly on a dark cabinet's screen (D-010). */
  glyph?: GlyphName;
}

export const GAMES: GameEntry[] = [
  {
    id: "unseen",
    name: "Unseen",
    teach: "Send money without the whole network watching.",
    status: "playable",
    // The real home of the game now that the shared frame (A5) exists.
    href: "/games/unseen",
  },
  {
    id: "proof",
    name: "The Proof Puzzle",
    teach: "Show a guard you know a secret, without saying it.",
    status: "soon",
    glyph: "proof",
  },
  {
    id: "doublespend",
    name: "The Double-Spend Heist",
    teach: "Catch a cheater spending the same coin twice.",
    status: "soon",
    glyph: "doublespend",
  },
  {
    id: "auditor",
    name: "The Auditor's Key",
    teach: "Give a trusted person a key to look at your payments. Looking is not spending.",
    status: "soon",
    glyph: "auditor",
  },
  {
    id: "vault",
    name: "The Vault Run",
    teach: "Move coins between the public side and the private side without leaving a trail.",
    status: "soon",
    glyph: "vault",
  },
];

/** hero = first playable game (the one lit cabinet); rest = everything else. */
export function splitGames(): { hero: GameEntry | null; rest: GameEntry[] } {
  const playable = GAMES.filter((g) => g.status === "playable");
  const hero = playable[0] ?? null;
  const rest = GAMES.filter((g) => g !== hero);
  return { hero, rest };
}
