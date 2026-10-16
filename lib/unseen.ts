/**
 * The rules of Unseen, written down as plain data (B5).
 *
 * Keeping the rounds here instead of inside the component does three things. The
 * copy can be read in one place and checked against the grandma rule. The
 * scoring can be tested without a browser. And the component is left doing only
 * what a component should: show the current state and talk to the network.
 *
 * One honesty rule runs through all of it. Nothing in this file states what a
 * payment revealed. The leak number is computed from facts the server read back
 * off the chain, so the meter can only ever report what really happened. That is
 * the difference between a lesson and a decoration.
 */

import type { Branch } from "@/lib/zcash/guardrails";

export type { Branch };

export type RoundId = "keep-private" | "prove-it" | "open-only";

export type Round = {
  id: RoundId;
  /** Shown as "Round 1 of 3". */
  label: string;
  title: string;
  /** What this round asks for, in a sentence or two. */
  brief: string;
  /** What doing it well means. Shown next to the result so the player can check. */
  goal: string;
  /** Which of the two controls are live. The last round has only one. */
  allows: readonly Branch[];
  /** Why a control is greyed out, or null when nothing is. */
  lockedWhy: string | null;
  /** The choice that meets the goal. */
  correct: Branch;
  /** Said after the payment lands, worded for the choice actually made. */
  teachHidden: string | null;
  teachOpen: string;
};

/**
 * The three rounds (D-039).
 *
 * They are not three variations on "hide it". Each one asks for something
 * different, and the third takes the choice away entirely, because that is a real
 * property of the network rather than a rule this game invented. A player who
 * finishes has learned when hiding helps, when it gets in the way, and when it is
 * simply impossible.
 *
 * Both destinations belong to the arcade. The screen says so in plain words
 * (D-040), and no character stands in for a recipient, so nothing here implies a
 * stranger is being paid.
 */
export const ROUNDS: readonly Round[] = [
  {
    id: "keep-private",
    label: "Round 1 of 3",
    title: "Keep it to yourself",
    brief:
      "You are sending a small practice payment. Nobody else needs to know about it. Choose how much of it the network gets to see.",
    goal: "The network learns nothing about this payment.",
    allows: ["hide", "open"],
    lockedWhy: null,
    correct: "hide",
    teachHidden:
      "You put the payment into the private pool. The network ran a math check to be sure the coins are real. That check is what a proof means here, and it never shows who paid, who got paid, or how much.",
    teachOpen:
      "You left it on the public list. Anyone can read where it went and how much. Nothing went wrong. This round just did not ask for that.",
  },
  {
    id: "prove-it",
    label: "Round 2 of 3",
    title: "Prove you paid",
    brief:
      "Someone asks you to show that the payment happened. They intend to look it up on the public record themselves.",
    goal: "A stranger can find this payment on the public list and read where it went and how much.",
    allows: ["hide", "open"],
    lockedWhy: null,
    correct: "open",
    teachHidden:
      "You hid it, so now nobody can check it. The payment is real, but you cannot point at the public list and prove it. This round needed the other choice.",
    teachOpen:
      "You left it open on purpose, and that was the right call. A hidden payment cannot be shown to someone who needs to check it. Now look at the one row that stayed sealed anyway: who sent it. The coins came out of the private pool, and the pool never says which of its users they came from. Going open gave away the destination and the amount. It did not give away the sender.",
  },
  {
    id: "open-only",
    label: "Round 3 of 3",
    title: "An address with no choice",
    brief: "This payment goes to an address that can only be reached in the open.",
    goal: "Just send it. Hiding is not even an option here, and that is not a rule this game made up. It is how the network works.",
    allows: ["open"],
    lockedWhy:
      "The address on the other end is an open address. It has nowhere to put a hidden payment, so the network cannot build one. That is true of the real address the arcade pays, not only inside this game.",
    correct: "open",
    teachHidden: null,
    teachOpen:
      "You paid an address that can only be reached in the open, so where it went and how much are public whether or not you wanted them to be. Hiding only works when both ends of a payment can hide. If the address on the other end cannot take a hidden payment, then the payment cannot be hidden.",
  },
];

/** The four things a stranger could possibly learn about one payment. */
export const LEAK_PARTS = ["who paid", "who got paid", "how much", "the note"] as const;

/** What the server reads back from the chain about one payment. */
export type PublicFacts = {
  amountVisible: boolean;
  recipientVisible: boolean;
  recipient: string | null;
  senderVisible: boolean;
  notePossible: boolean;
  noteSecret: boolean;
};

/**
 * Which of the four things are actually on show, in a fixed order.
 *
 * Worked out from the real facts every time, never assumed from the branch. The
 * note only counts when a note was possible and is not secret. An open payment
 * cannot carry a note at all, so there is nothing there to leak, and counting it
 * anyway would overstate what the network learned.
 */
export function leakedParts(facts: PublicFacts): string[] {
  const out: string[] = [];
  if (facts.senderVisible) out.push(LEAK_PARTS[0]);
  if (facts.recipientVisible) out.push(LEAK_PARTS[1]);
  if (facts.amountVisible) out.push(LEAK_PARTS[2]);
  if (facts.notePossible && !facts.noteSecret) out.push(LEAK_PARTS[3]);
  return out;
}

/** 0 means the public learned nothing. 1 means it learned all four things. */
export function leakFromFacts(facts: PublicFacts): number {
  return leakedParts(facts).length / LEAK_PARTS.length;
}

/** The sentence under the leak meter, built from what really leaked. */
export function leakLabelFor(facts: PublicFacts): string {
  const parts = leakedParts(facts);
  if (parts.length === 0) {
    return "Nothing. The network checked the math and learned no secrets.";
  }
  const joined = parts.join(", ");
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)}. On the public list for good.`;
}

/**
 * The approved line shown after a hidden payment (D-032), word for word.
 *
 * It carries the most important idea in the whole project: real privacy means
 * nobody can look, not even the service standing in the middle. The first letter
 * is capitalised because it starts a sentence on screen. Every word is as
 * approved.
 */
export const AFTER_HIDDEN_LINE =
  "The crowd cannot see this. In a real wallet, not even the site could.";

/** First mention of the pool names it and says what it is (D-029). */
export const POOL_FIRST_MENTION = "Ironwood, the private pool";
/** Every mention after the first. */
export const POOL_LATER = "the private pool";

/**
 * Capitalises the first letter, for the places where a name opens a line instead
 * of sitting inside a sentence.
 *
 * `POOL_LATER` is deliberately written lower case because it is meant to be dropped
 * into the middle of a sentence. Anywhere it starts one, using it raw reads as a
 * typo on screen, and this is the one place that fixes it rather than hard coding
 * a second copy of the name that could drift from the first.
 */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Did the choice meet what the round asked for? */
export function metGoal(round: Round, choice: Branch): boolean {
  return choice === round.correct;
}

/** One finished round, kept so the summary can be built from what really happened. */
export type RoundOutcome = {
  roundId: RoundId;
  choice: Branch;
  metGoal: boolean;
  leak: number;
  txid: string;
  explorerUrl: string;
  block: number | null;
};

/**
 * The whole game, scored.
 *
 * Deliberately not "leak as little as possible". Two of the three rounds are
 * supposed to be open, one of them with no other option, so a lower-is-better
 * score would punish the player for doing the right thing. The score is whether
 * each choice matched what that round asked for, and the leak meter stays what it
 * always was: a readout of what the public learned, not a penalty bar.
 */
export function scoreGame(outcomes: readonly RoundOutcome[]): {
  met: number;
  total: number;
  passed: boolean;
} {
  const met = outcomes.filter((o) => o.metGoal).length;
  return { met, total: ROUNDS.length, passed: met === ROUNDS.length };
}

/**
 * The sentence that closes the game.
 *
 * It names what the player got right rather than a bare tally, because the point
 * is that the three rounds asked for three different things.
 */
export function summaryLine(score: { met: number; total: number; passed: boolean }): string {
  if (score.passed) {
    return "You read all three rounds correctly. One needed hiding, one needed showing, and one gave you no choice at all.";
  }
  if (score.met === 0) {
    return "None of the three matched what was asked. That is the hard part of this: the right answer changes every round.";
  }
  return `You got ${score.met} of ${score.total} right. Play it again and watch what each round is really asking for.`;
}

const TXID_SHAPE = /^[0-9a-f]{64}$/i;

/**
 * Reads a round answer from the server without trusting any of it.
 *
 * Fail-closed in both directions. It will not accept a success without a
 * transaction id that looks like one and a full set of facts, because showing a
 * receipt for a payment that did not happen is the worst thing this screen could
 * do. And it will not accept a half-read set of facts either, since guessing
 * "nothing leaked" from a malformed answer would quietly understate what the
 * public saw.
 */
export type SendOutcome =
  | {
      ok: true;
      branch: Branch;
      txid: string;
      explorerUrl: string;
      amountZatoshis: number;
      amountTaz: string;
      publicFacts: PublicFacts;
    }
  | {
      ok: false;
      /** Settling, refilling and limited are waits, not breakdowns. Anything else is a real failure. */
      code: "settling" | "refilling" | "limited" | "other";
      problem: string;
      retryAfterSeconds: number | null;
    };

export function parseSendOutcome(status: number, raw: string): SendOutcome {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failed("The arcade sent back an answer this screen could not read.");
  }
  if (typeof body !== "object" || body === null) {
    return failed("The arcade sent back an answer this screen could not read.");
  }
  const value = body as Record<string, unknown>;

  if (value.ok === true && status === 200) {
    const facts = parseFacts(value.publicFacts);
    const txid = typeof value.txid === "string" ? value.txid : "";
    const explorerUrl = typeof value.explorerUrl === "string" ? value.explorerUrl : "";
    const branch = value.branch === "hide" || value.branch === "open" ? value.branch : null;
    const amountZatoshis =
      typeof value.amountZatoshis === "number" && Number.isInteger(value.amountZatoshis)
        ? value.amountZatoshis
        : null;
    if (!facts || !TXID_SHAPE.test(txid) || !explorerUrl.startsWith("https://") || !branch || amountZatoshis === null) {
      return failed(
        "The payment answer was missing something this screen needs. Nothing has been shown as sent, because this screen will not guess.",
      );
    }
    return {
      ok: true,
      branch,
      txid,
      explorerUrl,
      amountZatoshis,
      amountTaz: typeof value.amountTaz === "string" ? value.amountTaz : "",
      publicFacts: facts,
    };
  }

  return {
    ok: false,
    code: parseCode(value.code),
    problem:
      typeof value.problem === "string" && value.problem !== ""
        ? value.problem
        : "The payment did not go through. Nothing has been sent.",
    retryAfterSeconds:
      typeof value.retryAfterSeconds === "number" && Number.isFinite(value.retryAfterSeconds)
        ? Math.max(0, Math.round(value.retryAfterSeconds))
        : null,
  };
}

function failed(problem: string): SendOutcome {
  return { ok: false, code: "other", problem, retryAfterSeconds: null };
}

/** Only the three codes that mean "wait" survive. Anything unknown is a failure. */
function parseCode(value: unknown): "settling" | "refilling" | "limited" | "other" {
  return value === "settling" || value === "refilling" || value === "limited" ? value : "other";
}

/**
 * Plain words for a wait.
 *
 * The server already sends how long to wait, in seconds, and throwing that away
 * leaves the player with "come back a little later" and no idea whether that means
 * one minute or one hour. Rounded up and in minutes past a minute, because "retry
 * after 613 seconds" is not how anybody talks.
 */
export function waitInWords(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `about ${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes <= 1 ? "about a minute" : `about ${minutes} minutes`;
}

/** Requires all five flags and an explicit recipient. Anything less is rejected. */
function parseFacts(value: unknown): PublicFacts | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const flags = ["amountVisible", "recipientVisible", "senderVisible", "notePossible", "noteSecret"];
  for (const key of flags) {
    if (typeof v[key] !== "boolean") return null;
  }
  if (v.recipient !== null && typeof v.recipient !== "string") return null;
  return {
    amountVisible: v.amountVisible as boolean,
    recipientVisible: v.recipientVisible as boolean,
    recipient: v.recipient as string | null,
    senderVisible: v.senderVisible as boolean,
    notePossible: v.notePossible as boolean,
    noteSecret: v.noteSecret as boolean,
  };
}

/** Where a payment has got to, read off the chain rather than counted down. */
export type ProgressOutcome =
  | {
      ok: true;
      txid: string;
      landed: boolean;
      block: number | null;
      confirmations: number;
      explorerUrl: string;
    }
  | {
      ok: false;
      /**
       * "too-soon" is the brake in poll-guard.ts, not a problem. It means the
       * wallet was asked too recently, and the right response is to keep showing
       * "still landing" and ask again on the next tick. "other" is a real failure
       * worth putting on screen.
       */
      code: "too-soon" | "other";
      problem: string;
      retryAfterSeconds: number | null;
    };

export function parseProgressOutcome(status: number, raw: string): ProgressOutcome {
  if (status === 429) {
    return {
      ok: false,
      code: "too-soon",
      problem: "Asked too recently.",
      retryAfterSeconds: null,
    };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return progressFailed("The answer about this payment could not be read.");
  }
  if (typeof body !== "object" || body === null) {
    return progressFailed("The answer about this payment could not be read.");
  }
  const v = body as Record<string, unknown>;
  if (v.ok !== true) {
    return progressFailed(
      typeof v.problem === "string" && v.problem !== ""
        ? v.problem
        : "The arcade could not say where this payment has got to.",
    );
  }
  const txid = typeof v.txid === "string" ? v.txid : "";
  const explorerUrl = typeof v.explorerUrl === "string" ? v.explorerUrl : "";
  if (!TXID_SHAPE.test(txid) || !explorerUrl.startsWith("https://")) {
    return progressFailed("The answer about this payment was missing something this screen needs.");
  }
  return {
    ok: true,
    txid,
    landed: v.landed === true,
    block: typeof v.block === "number" && Number.isInteger(v.block) ? v.block : null,
    confirmations:
      typeof v.confirmations === "number" && Number.isInteger(v.confirmations)
        ? Math.max(0, v.confirmations)
        : 0,
    explorerUrl,
  };
}

function progressFailed(problem: string): ProgressOutcome {
  return { ok: false, code: "other", problem, retryAfterSeconds: null };
}
