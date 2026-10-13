/**
 * The hub is DATA-DRIVEN (D-019). This list is the single source of truth.
 * The lobby sorts playable games first and gives the hero (double-width) slot
 * to the FIRST playable entry. Lighting up G2 later is a one-line status flip
 * here ("soon" -> "playable" + an href), not a redesign.
 *
 * Copy follows the Layer 4 voice rule (D-018): plain words, short sentences,
 * no em dashes, grandma-readable.
 */

import { CROWD_COPY } from "@/lib/crowd";

export type GameStatus = "playable" | "soon";
export type GlyphName = "proof" | "doublespend" | "auditor" | "vault" | "crowd";

export interface GameEntry {
  id: string;
  name: string;
  /** One plain line: what this game teaches. Always visible on the cabinet. */
  teach: string;
  status: GameStatus;
  /** Where the machine lives. The room links here; cabinets open the room. */
  href?: string;
  /** Custom vector glyph shown faintly on a dark cabinet's screen (D-010). */
  glyph?: GlyphName;
  /** The room (D-078): plain prose about the fiction and what you do. No hints. */
  about?: string;
  /** The room (D-078): the lesson, in plain words. */
  teaches?: string;
  /** The room (D-078): the objects on screen. Never the choices or answers. */
  sees?: string;
  /** Who stands on a lit cabinet's screen (D-079): one Watcher, or a crowd. */
  cast?: "watcher" | "crowd";
}

export const GAMES: GameEntry[] = [
  {
    id: "unseen",
    name: "Unseen",
    teach: "Send money without the whole network watching.",
    status: "playable",
    // The real home of the game now that the shared frame (A5) exists.
    href: "/games/unseen",
    about:
      "You stand at a window with one choice to make: hide a payment, or leave it open. The house wallet pays real testnet money either way, and the screen then shows what the network actually saw. Nothing here is simulated.",
    teaches:
      "A shielded payment leaves no amount, no sender and no receiver in the public record. An open payment leaves a trail anyone can follow.",
    sees:
      "You will see two choices, a waiting clock, and a panel that reads what the public can see.",
  },
  {
    // Cabinet two, lit after the owner's playtest verdict ("this is dope,
    // keep her") and the rooms build (D-078).
    id: "crowd",
    name: "The Crowd",
    teach: CROWD_COPY.teach,
    status: "playable",
    href: "/games/crowd",
    glyph: "crowd",
    cast: "crowd",
    about:
      "You play the stranger. The arcade hands you its complete record book, every payment it ever made, and asks you to read what you can. Some rows give up their facts. Some give up nothing at all.",
    teaches:
      "Open payments are trails. Shielded payments are sealed: when they landed and how many notes they carried are public, amounts and people are not.",
    sees:
      "You will see a row of hooded figures, a list of records with explorer links, and a meter that reads what you pinned down.",
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
