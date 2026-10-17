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
  cast?: "watcher" | "crowd" | "keylock";
}

export const GAMES: GameEntry[] = [
  {
    id: "unseen",
    name: "Unseen",
    teach: "Send money and choose how much of it the network gets to see.",
    status: "playable",
    // The real home of the game now that the shared frame (A5) exists.
    href: "/games/unseen",
    about:
      "One choice, three times over: hide a payment, or leave it open. The arcade's wallet pays real testnet money either way, and the screen then shows you what the network actually saw. Nothing here is pretend.",
    teaches:
      "When you hide a payment, the public record keeps no amount, no sender and no receiver. When you leave it open, anyone can follow where it went and how much moved.",
    sees:
      "Two buttons, a clock while the payment lands, and a panel that lists what the public can see.",
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
      "You play the stranger. The arcade hands you its whole record book, every payment it ever made, and asks you to read what you can from it. Some rows tell you plenty. Some tell you nothing at all.",
    teaches:
      "Open payments leave a trail of everything they did: the time they landed, the amount, and the address they paid. Shielded payments stay sealed. The blockchain still shows when one landed and how many sealed notes ({{coins}}) it carried, but the amount and the people on both ends stay hidden by default.",
    sees:
      "A row of hooded figures, a list of real records with links to the explorer, and a meter that counts what you managed to read.",
  },
  {
    // Cabinet three, lit after the owner scoped it (D-089).
    id: "proof",
    name: "The Proof Puzzle",
    teach: "Show a guard you know a secret, without saying it.",
    status: "playable",
    href: "/games/proof",
    glyph: "proof",
    // The owner's playtest (2026-10-17): this cabinet must not wear the
    // Watcher as its head image. Its own piece is the key and the lock.
    cast: "keylock",
    about:
      "You owe the Watcher one thousand TAZ. Your money is in a vault at the arcade, but you hit your monthly limit and the vault will not open until tomorrow. You cannot pay him now. He will not take your word for it. You set a secret three-digit code inside the safe while the Watcher closes his eyes. Then he asks the safe three questions about your code. You answer yes or no. The safe checks each answer against the code inside it and only says open or shut. If the safe opens, the payment moves. The Watcher never sees the code.",
    teaches:
      "Before the network accepts a payment, it checks that the money is real, that it has not been spent before, and that it is going where it says. It checks all three without showing who paid, who got paid, or how much. The check runs on math built from the secret itself, so nobody has to hold the secret to verify it. That is how Zcash keeps payments private while the network still agrees they are valid.",
    sees:
      "A safe with your secret code, three yes-or-no questions, and a receipt that shows only that a payment happened.",
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

/**
 * The one-word gloss convention (D-097). A teaches line may wrap a single word
 * in double braces, and the room renders that word in the house gold as its
 * own explanation: "sealed notes ({{coins}})" reads as "sealed notes (coins)"
 * with the gloss lit, so a player who has never heard the word still gets it
 * in one word. Everything outside the braces renders exactly as written.
 */
export function glossParts(text: string): Array<{ text: string; gloss: boolean }> {
  const parts: Array<{ text: string; gloss: boolean }> = [];
  const pattern = /\{\{(.+?)\}\}/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), gloss: false });
    parts.push({ text: match[1], gloss: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), gloss: false });
  return parts;
}
