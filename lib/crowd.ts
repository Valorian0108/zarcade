/**
 * The Crowd (D-074, amended by D-076, D-092 and D-093): the record book,
 * the challenge judges, and every word this machine says.
 *
 * The book is the arcade's own verified transaction history. Each record
 * carries two things that never mix on screen: the ground truth the house
 * knows because it paid (amount, kind), and what a stranger can read off
 * the chain (the `readable` list). A row shows only public metadata until
 * its challenge reveals more, so the game can never leak its own answer.
 *
 * Where the book comes from (D-093): the page asks the wallet for the
 * payments it really broadcast (`readSendHistory` in lib/zcash/sidecar.ts)
 * and `buildBook` composes the freshest honest rows it can from them. Where
 * live history is thin or the wallet is unreachable, the curated rows below
 * are the fallback and the game never breaks. Every row, curated or fresh,
 * is a real transaction with its canonical explorer link: that is the
 * honesty line from ARCHITECTURE.md, and no simulated row may ever enter
 * this book.
 *
 * Positions (D-092): the client component shuffles the book and the
 * challenge-three answers once per visit with `shuffled`, so a replay is a
 * reading test again instead of a memory test. The judges decide by id,
 * never by position, so the shuffle changes nothing about scoring.
 *
 * Copy follows the Layer 4 voice (D-018): plain words, short sentences, no
 * em dashes, grandma-readable.
 */

export type CrowdKind = "shielded" | "open";

export interface CrowdRecord {
  /** Stable id for the UI and the tests. Curated rows keep their names;
   *  live rows are identified by their txid. */
  id: string;
  txid: string;
  kind: CrowdKind;
  /** The block the record landed in, or null where the book states none. */
  block: number | null;
  url: string;
  /** Ground truth from the house wallet. Never shown before its reveal. */
  amountZatoshis: number;
  /** What a stranger can read about this record from the chain, plainly. */
  readable: readonly string[];
}

const EXPLORER = "https://testnet.zecblock.com/tx/";

/** What a stranger can read off a sealed payment: counts and times, never
 *  the facts. True of any shielded transaction, curated or fresh. */
const SEALED_READABLE: readonly string[] = [
  "when it landed",
  "how many sealed notes it carried",
];

/** What a stranger can read off an open payment: two of four facts, on
 *  D-041's accounting. The sender is never among them: the coins come out
 *  of the private pool unnamed. */
const OPEN_READABLE: readonly string[] = [
  "the amount",
  "the open address it paid",
  "when it landed",
];

export const CROWD_RECORDS: readonly CrowdRecord[] = [
  {
    // The first verified hidden self-send (D-028), mined in block 4,488,884.
    id: "hidden-first",
    txid: "952a1959f26c0f405e52de225239cb51bc0bb0696357f669d7449480f3299c77",
    kind: "shielded",
    block: 4488884,
    url: `${EXPLORER}952a1959f26c0f405e52de225239cb51bc0bb0696357f669d7449480f3299c77`,
    amountZatoshis: 1000,
    readable: SEALED_READABLE,
  },
  {
    // Made on the day the book was curated, watched into block 4,498,206,
    // so the game always holds a payment mined the same day (D-074).
    id: "hidden-today",
    txid: "272053001cc90d05c659861b892e1a3e769a064ace722bb3bd9ba35abbe37dc2",
    kind: "shielded",
    block: 4498206,
    url: `${EXPLORER}272053001cc90d05c659861b892e1a3e769a064ace722bb3bd9ba35abbe37dc2`,
    amountZatoshis: 1000,
    readable: SEALED_READABLE,
  },
  {
    // The open round D-041 read line by line on the explorer: the amount and
    // the open address in the clear, the sender named only as Ironwood Pool.
    // Block 4,490,780 filled in after the owner caught that a missing block
    // made this row stand out by shape (D-077).
    id: "open-round",
    txid: "c97af9530f49e1760ee7368f46ed3b8940d0095a30230a3bba244863624fa7e5",
    kind: "open",
    block: 4490780,
    url: `${EXPLORER}c97af9530f49e1760ee7368f46ed3b8940d0095a30230a3bba244863624fa7e5`,
    amountZatoshis: 1000,
    readable: OPEN_READABLE,
  },
];

/**
 * The amount challenge two names. Every round the arcade plays moves
 * exactly this, and D-094 made that a rule the wallet itself enforces, so
 * every live row in any future book matches it.
 */
export const C2_TARGET_ZATOSHIS = 1000;

/** A payment from the wallet's live ledger (D-093), in facts the chain
 *  shows anyone. Arrives newest first. */
export interface LiveRow {
  txid: string;
  kind: CrowdKind;
  zatoshis: number;
  /** Null until the network has mined it; such a row never enters the book. */
  block: number | null;
}

const TXID_SHAPE = /^[0-9a-f]{64}$/;

/**
 * Turn one live ledger row into a book row, or null when the row cannot be
 * shown honestly: not mined yet (D-077: every displayed row states its
 * block, so no row ever stands out by shape), a malformed txid, or a sealed
 * amount that would make challenge two's reveal claim false.
 */
function liveToRecord(row: LiveRow): CrowdRecord | null {
  if (!TXID_SHAPE.test(row.txid)) return null;
  if (row.block === null) return null;
  if (row.kind === "shielded" && row.zatoshis !== C2_TARGET_ZATOSHIS) return null;
  return {
    id: row.txid,
    txid: row.txid,
    kind: row.kind,
    block: row.block,
    url: `${EXPLORER}${row.txid}`,
    amountZatoshis: row.zatoshis,
    readable: row.kind === "open" ? OPEN_READABLE : SEALED_READABLE,
  };
}

/**
 * Compose the book (D-093): the newest mined open payment plus the two
 * newest mined sealed payments from the live ledger, topped up from the
 * curated rows where history is thin. The result always holds exactly one
 * open row and two sealed rows, every row states its block, and no txid
 * appears twice. Anything malformed in the input is skipped, never trusted.
 */
export function buildBook(live: readonly LiveRow[]): readonly CrowdRecord[] {
  const curatedOpen = CROWD_RECORDS.find((r) => r.kind === "open");
  const curatedSealed = CROWD_RECORDS.filter((r) => r.kind === "shielded");
  // Unreachable in practice (the curated book's shape is tested), but the
  // fallback must never be able to throw.
  if (!curatedOpen) return CROWD_RECORDS;

  const usable = live
    .map(liveToRecord)
    .filter((r): r is CrowdRecord => r !== null);
  // Nothing honest to serve: hand back the canonical curated book verbatim,
  // so an empty or unusable ledger changes nothing about the game.
  if (usable.length === 0) return CROWD_RECORDS;

  const rows: CrowdRecord[] = [];
  const used = new Set<string>();

  const open = usable.find((r) => r.kind === "open") ?? curatedOpen;
  used.add(open.txid);
  rows.push(open);

  const sealedCount = () => rows.filter((r) => r.kind === "shielded").length;
  for (const r of usable) {
    if (sealedCount() >= 2) break;
    if (r.kind !== "shielded" || used.has(r.txid)) continue;
    used.add(r.txid);
    rows.push(r);
  }
  for (const r of curatedSealed) {
    if (sealedCount() >= 2) break;
    if (used.has(r.txid)) continue;
    used.add(r.txid);
    rows.push(r);
  }
  if (sealedCount() < 2) return CROWD_RECORDS;
  return rows;
}

/**
 * One visit, one order (D-092). A seeded Fisher-Yates shuffle: the same
 * seed always gives the same order, so the book holds still for a whole
 * playthrough, and a fresh seed on every mount is what stops a replay from
 * being a memory test. The seed is a UI detail, never a secret.
 */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  let s = seed >>> 0;
  const rand = () => {
    // mulberry32: small, fast, and evenly distributed enough for a book row.
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export type FindOpenResult =
  | { outcome: "found"; record: CrowdRecord }
  | { outcome: "sealed"; record: CrowdRecord };

/** Challenge one: pick the row that was made in the open. Judges by
 *  identity inside the served book, never by position (D-092). */
export function judgeFindOpen(
  book: readonly CrowdRecord[],
  recordId: string,
): FindOpenResult | null {
  const record = book.find((r) => r.id === recordId);
  if (!record) return null;
  return record.kind === "open" ? { outcome: "found", record } : { outcome: "sealed", record };
}

/**
 * Challenge two has no winning pick. Every pick fails, and the failing is
 * the lesson, so the judge can only ever say pass: false for a real sealed
 * row of the served book.
 */
export function judgePointAtAmount(
  book: readonly CrowdRecord[],
  recordId: string,
): { pass: false } | null {
  const record = book.find((r) => r.id === recordId);
  if (!record || record.kind !== "shielded") return null;
  return { pass: false };
}

/** The sealed rows of the served book that really moved the named amount:
 *  the reveal's proof. */
export function shieldedRowsWithAmount(
  book: readonly CrowdRecord[],
  zatoshis: number,
): CrowdRecord[] {
  return book.filter((r) => r.kind === "shielded" && r.amountZatoshis === zatoshis);
}

export interface CrowdChoice {
  id: string;
  text: string;
  correct: boolean;
}

/** Challenge three: why the open row's amount is public. One true answer.
 *  Shuffled per visit by the component (D-092); judged by id. */
export const C3_CHOICES: readonly CrowdChoice[] = [
  {
    id: "open-dest",
    text: "The money went to an open address, and open addresses cannot hold sealed money.",
    correct: true,
  },
  {
    id: "expire",
    text: "Shielded payments expire after a while and become public.",
    correct: false,
  },
  {
    id: "daily",
    text: "The network publishes every amount once a day.",
    correct: false,
  },
];

export function judgeWhyOpen(choiceId: string): { pass: boolean; choice: CrowdChoice } | null {
  const choice = C3_CHOICES.find((c) => c.id === choiceId);
  if (!choice) return null;
  return { pass: choice.correct, choice };
}

/**
 * Leak numbers, on D-041's accounting: an open row gives a stranger two of
 * the four facts (amount and recipient, never the sender), a sealed row
 * gives none. The meter reads facts, not verdicts.
 */
export const LEAK_OPEN = 0.5;
export const LEAK_SEALED = 0;

/** Every word the machine says, in one place so the voice never drifts. */
export const CROWD_COPY = {
  teach: "Every payment is on the record. See how much a stranger can read.",
  setup:
    "You are the stranger. This is the arcade's complete record book. Nothing here is kept from you. Your job is to read what you can.",
  setupCard:
    "Three challenges. Each one is a question about this book. Two have answers you can find. One has an answer you cannot, and that is the point of it.",
  c1Brief: "One payment in this book was made in the open. Find it.",
  c1Sealed:
    "Sealed end to end. The amount, the sender and the receiver are all hidden. Try another row.",
  c1Found:
    "You found it. The amount and the address sit right there, readable by anyone. An open payment is a trail, and anyone who holds the record book can follow it. One thing it still does not say: who sent it. The coins that paid it came out of the private pool.",
  c1FactsLabel: "What the public reads",
  c1FactsAmount: "The amount, in the clear.",
  c1FactsAddress: "The address it paid: the arcade's own open address.",
  c1FactsSender: "The sender: not named. The coins came out of the private pool.",
  c2Brief: "One of these shielded payments moved exactly 1,000 zatoshis. Point at it.",
  c2Fail: "Sealed. The amount is not in the record. Nobody's is.",
  c2Admit: "It cannot be known.",
  c2Reveal:
    "You could see when each payment landed and how many sealed notes it carried. Counts and times are public. The amount, the sender and the receiver are not. You held every record and you still could not point. That is what shielded means.",
  c2Every:
    "Every shielded row in this book moved exactly that much, and not one of them shows it.",
  c2Card: "Zero. On the sealed rows, zero is the win.",
  c3Brief: "Look at the open payment again. Its amount is public. Why?",
  c3Wrong: "Not this one. The answer lives in what an open address can hold.",
  c3Reveal:
    "This payment went to an address that cannot receive sealed money, so the network made its amount public at the exit. Privacy needs both ends. One open end and the trail shows.",
  endLine: "You held every record. You saw nothing. That is the point.",
  endProse:
    "The open row gave up two facts of four. The sealed rows gave up nothing at all. That gap is not a trick of this game. It is how the network behaves.",
  endOpen: "Open rows read: two facts of four.",
  endSealed: "Sealed rows read: nothing at all.",
} as const;
