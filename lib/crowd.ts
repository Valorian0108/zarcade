/**
 * The Crowd (D-074, amended by D-076): the record book, the challenge
 * judges, and every word this machine says.
 *
 * The book is the arcade's own verified transaction history. Each record
 * carries two things that never mix on screen: the ground truth the house
 * knows because it paid (amount, kind), and what a stranger can read off
 * the chain (the `readable` list). A row shows only public metadata until
 * its challenge reveals more, so the game can never leak its own answer.
 *
 * No new backend lives here (D-074): the book ships as static config and
 * every record links to the canonical explorer, so a player can check any
 * row themselves. That link is the honesty line from ARCHITECTURE.md.
 *
 * Copy follows the Layer 4 voice (D-018): plain words, short sentences, no
 * em dashes, grandma-readable.
 */

export type CrowdKind = "shielded" | "open";

export interface CrowdRecord {
  /** Stable id for the UI and the tests. */
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

export const CROWD_RECORDS: readonly CrowdRecord[] = [
  {
    // The first verified hidden self-send (D-028), mined in block 4,488,884.
    id: "hidden-first",
    txid: "952a1959f26c0f405e52de225239cb51bc0bb0696357f669d7449480f3299c77",
    kind: "shielded",
    block: 4488884,
    url: `${EXPLORER}952a1959f26c0f405e52de225239cb51bc0bb0696357f669d7449480f3299c77`,
    amountZatoshis: 1000,
    readable: ["when it landed", "how many sealed notes it carried"],
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
    readable: ["when it landed", "how many sealed notes it carried"],
  },
  {
    // The open round D-041 read line by line on the explorer: the amount and
    // the open address in the clear, the sender named only as Ironwood Pool.
    id: "open-round",
    txid: "c97af9530f49e1760ee7368f46ed3b8940d0095a30230a3bba244863624fa7e5",
    kind: "open",
    block: null,
    url: `${EXPLORER}c97af9530f49e1760ee7368f46ed3b8940d0095a30230a3bba244863624fa7e5`,
    amountZatoshis: 1000,
    readable: ["the amount", "the open address it paid", "when it landed"],
  },
];

/** The amount challenge two names. Every round the arcade plays is this. */
export const C2_TARGET_ZATOSHIS = 1000;

export type FindOpenResult =
  | { outcome: "found"; record: CrowdRecord }
  | { outcome: "sealed"; record: CrowdRecord };

/** Challenge one: pick the row that was made in the open. */
export function judgeFindOpen(recordId: string): FindOpenResult | null {
  const record = CROWD_RECORDS.find((r) => r.id === recordId);
  if (!record) return null;
  return record.kind === "open" ? { outcome: "found", record } : { outcome: "sealed", record };
}

/**
 * Challenge two has no winning pick. Every pick fails, and the failing is
 * the lesson, so the judge can only ever say pass: false for a real row.
 */
export function judgePointAtAmount(recordId: string): { pass: false } | null {
  const record = CROWD_RECORDS.find((r) => r.id === recordId);
  if (!record || record.kind !== "shielded") return null;
  return { pass: false };
}

/** The shielded rows that really moved the named amount: the reveal's proof. */
export function shieldedRowsWithAmount(zatoshis: number): CrowdRecord[] {
  return CROWD_RECORDS.filter((r) => r.kind === "shielded" && r.amountZatoshis === zatoshis);
}

export interface CrowdChoice {
  id: string;
  text: string;
  correct: boolean;
}

/** Challenge three: why the open row's amount is public. One true answer. */
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
