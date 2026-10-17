import { describe, expect, it } from "vitest";

import {
  AFTER_HIDDEN_LINE,
  leakFromFacts,
  leakLabelFor,
  leakedParts,
  metGoal,
  parseProgressOutcome,
  parseSendOutcome,
  POOL_FIRST_MENTION,
  POOL_LATER,
  ROUNDS,
  scoreGame,
  sentenceCase,
  summaryLine,
  waitInWords,
  type PublicFacts,
  type RoundOutcome,
} from "@/lib/unseen";

/** Exactly what the server reports for a hidden payment. */
const HIDDEN: PublicFacts = {
  amountVisible: false,
  recipientVisible: false,
  recipient: null,
  senderVisible: false,
  notePossible: true,
  noteSecret: true,
};

/**
 * Exactly what the server reports for an open payment.
 *
 * `senderVisible` is false, which is not obvious and was got wrong the first time.
 * The house coins sit in the shielded pool, so an open payment unshields rather
 * than starting transparent: the destination and the amount are public, but the
 * notes that paid for them stay shielded and reveal no address. Verified against
 * real tx c97af9530f49e1760ee7368f46ed3b8940d0095a30230a3bba244863624fa7e5 on
 * testnet block 4490780, where the explorer names the source only as "Ironwood
 * Pool" and its Blend Check scores the privacy risk 0/100.
 */
const OPEN: PublicFacts = {
  amountVisible: true,
  recipientVisible: true,
  recipient: "tmXbq7ghCfNyszcBFT9sYiWvKZoHjt3Kfub",
  senderVisible: false,
  notePossible: false,
  noteSecret: false,
};

const TXID = "a".repeat(64);
const EXPLORER = `https://testnet.zecblock.com/tx/${TXID}`;

function okBody(facts: PublicFacts, branch: "hide" | "open") {
  return JSON.stringify({
    ok: true,
    branch,
    txid: TXID,
    explorerUrl: EXPLORER,
    amountZatoshis: 1000,
    amountTaz: "0.00001000",
    publicFacts: facts,
  });
}

describe("the rounds as written down", () => {
  it("has three, in order, with the labels a player reads", () => {
    expect(ROUNDS.map((r) => r.label)).toEqual([
      "Round 1 of 3",
      "Round 2 of 3",
      "Round 3 of 3",
    ]);
  });

  it("never asks for a choice it does not offer", () => {
    for (const round of ROUNDS) {
      expect(round.allows).toContain(round.correct);
    }
  });

  it("takes the choice away in round three, and says why", () => {
    const third = ROUNDS[2];
    expect(third.allows).toEqual(["open"]);
    expect(third.lockedWhy).not.toBeNull();
    // A teaching line for a choice that cannot be made would be dead copy.
    expect(third.teachHidden).toBeNull();
  });

  it("explains both outcomes wherever both are possible", () => {
    for (const round of ROUNDS.slice(0, 2)) {
      expect(round.teachHidden).not.toBeNull();
      expect(round.teachOpen.length).toBeGreaterThan(0);
    }
  });

  it("asks for three genuinely different things", () => {
    // The whole lesson. Round one wants hiding, round two wants showing, round
    // three offers no choice at all.
    expect(ROUNDS.map((r) => r.correct)).toEqual(["hide", "open", "open"]);
  });
});

describe("scoring", () => {
  it("matches the choice against what the round asked for", () => {
    expect(metGoal(ROUNDS[0], "hide")).toBe(true);
    expect(metGoal(ROUNDS[0], "open")).toBe(false);
    expect(metGoal(ROUNDS[1], "open")).toBe(true);
    expect(metGoal(ROUNDS[1], "hide")).toBe(false);
  });

  const outcome = (roundId: RoundOutcome["roundId"], choice: "hide" | "open", metGoalFlag: boolean): RoundOutcome => ({
    roundId,
    choice,
    metGoal: metGoalFlag,
    leak: 0,
    txid: TXID,
    explorerUrl: EXPLORER,
    block: 4490655,
  });

  it("passes only when all three matched", () => {
    const all = [
      outcome("keep-private", "hide", true),
      outcome("prove-it", "open", true),
      outcome("open-only", "open", true),
    ];
    expect(scoreGame(all)).toEqual({ met: 3, total: 3, passed: true });
  });

  it("does not pass on two out of three", () => {
    const two = [
      outcome("keep-private", "hide", true),
      outcome("prove-it", "hide", false),
      outcome("open-only", "open", true),
    ];
    const score = scoreGame(two);
    expect(score.passed).toBe(false);
    expect(score.met).toBe(2);
    expect(summaryLine(score)).toContain("2 of 3");
  });

  it("has a distinct line for none, some, and all", () => {
    const none = summaryLine({ met: 0, total: 3, passed: false });
    const some = summaryLine({ met: 1, total: 3, passed: false });
    const all = summaryLine({ met: 3, total: 3, passed: true });
    expect(new Set([none, some, all]).size).toBe(3);
  });
});

describe("the leak meter, driven by the real facts", () => {
  it("reports nothing for a hidden payment", () => {
    expect(leakFromFacts(HIDDEN)).toBe(0);
    expect(leakedParts(HIDDEN)).toEqual([]);
  });

  it("reports two of four for an open payment, and not the sender or the message", () => {
    // Two honest omissions. An open payment cannot carry a message at all, so there
    // is no message to leak. And the sender stays hidden because the coins leave the
    // shielded pool, which never says which of its users they came from.
    // Counting either would overstate what the network learned.
    expect(leakFromFacts(OPEN)).toBe(0.5);
    expect(leakedParts(OPEN)).toEqual(["who got paid", "how much"]);
  });

  it("keeps the sender hidden on both branches, which is the surprising part of the lesson", () => {
    expect(HIDDEN.senderVisible).toBe(false);
    expect(OPEN.senderVisible).toBe(false);
  });

  it("would count a note that was possible and not secret", () => {
    expect(leakFromFacts({ ...HIDDEN, notePossible: true, noteSecret: false })).toBe(0.25);
  });

  it("puts the leaked things into words, capitalised", () => {
    expect(leakLabelFor(HIDDEN)).toBe(
      "Nothing. The network checked the math and learned no secrets.",
    );
    expect(leakLabelFor(OPEN)).toBe("Who got paid, how much. On the public list for good.");
  });

  it("keeps the approved line word for word", () => {
    expect(AFTER_HIDDEN_LINE).toBe(
      "The crowd cannot see this. In a real wallet, not even the site could.",
    );
    // The grandma rule and the no-em-dash rule (D-018).
    expect(AFTER_HIDDEN_LINE).not.toContain("\u2014");
  });

  it("capitalises the pool name where it opens a line, and leaves it alone inside one", () => {
    // Found by playing the real game: the panel value read "the private pool."
    // at the start of a row, which looks like a typo to a judge even though the
    // name is correct for mid-sentence use (D-029).
    expect(sentenceCase(POOL_LATER)).toBe("The private pool");
    expect(POOL_LATER).toBe("the private pool");
    expect(sentenceCase(POOL_FIRST_MENTION)).toBe("Ironwood, the private pool");
    expect(sentenceCase("")).toBe("");
  });
});

describe("reading a round answer without trusting it", () => {
  it("accepts a complete success", () => {
    const result = parseSendOutcome(200, okBody(HIDDEN, "hide"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.txid).toBe(TXID);
      expect(result.amountZatoshis).toBe(1000);
      expect(result.publicFacts).toEqual(HIDDEN);
    }
  });

  it("refuses a success with no usable transaction id", () => {
    const body = JSON.stringify({ ...JSON.parse(okBody(HIDDEN, "hide")), txid: "not-a-txid" });
    const result = parseSendOutcome(200, body);
    expect(result.ok).toBe(false);
  });

  it("refuses to guess when the facts are half missing", () => {
    // The dangerous case. A malformed answer must not be read as "nothing
    // leaked", which would quietly understate what the public saw.
    const body = JSON.stringify({
      ok: true,
      branch: "hide",
      txid: TXID,
      explorerUrl: EXPLORER,
      amountZatoshis: 1000,
      amountTaz: "0.00001000",
      publicFacts: { amountVisible: false, recipientVisible: false, recipient: null },
    });
    const result = parseSendOutcome(200, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("other");
  });

  it("refuses a success claimed on an error status", () => {
    const result = parseSendOutcome(500, okBody(OPEN, "open"));
    expect(result.ok).toBe(false);
  });

  it("names a settling wait as a wait, not a breakdown", () => {
    const result = parseSendOutcome(
      409,
      JSON.stringify({ ok: false, code: "settling", problem: "Still landing.", retryAfterSeconds: 60 }),
    );
    expect(result).toMatchObject({ ok: false, code: "settling", retryAfterSeconds: 60 });
  });

  it("names a refill as a refill", () => {
    const result = parseSendOutcome(
      503,
      JSON.stringify({ ok: false, code: "refilling", problem: "Refilling.", retryAfterSeconds: 480 }),
    );
    expect(result).toMatchObject({ ok: false, code: "refilling", retryAfterSeconds: 480 });
  });

  it("names a used-up allowance as a wait rather than a breakdown", () => {
    // Found by playing the real game: the hourly limit arrived with no code at
    // all, so the screen painted a friendly "come back later" in the red reserved
    // for errors. A limit is a wait, like settling and refilling (D-035).
    const result = parseSendOutcome(
      429,
      JSON.stringify({
        ok: false,
        code: "limited",
        problem: "That is your share of rounds for this hour.",
        retryAfterSeconds: 613,
      }),
    );
    expect(result).toMatchObject({ ok: false, code: "limited", retryAfterSeconds: 613 });
  });

  it("says a wait in words people use", () => {
    expect(waitInWords(null)).toBeNull();
    expect(waitInWords(0)).toBeNull();
    expect(waitInWords(8)).toBe("about 8 seconds");
    expect(waitInWords(59)).toBe("about 59 seconds");
    expect(waitInWords(60)).toBe("about a minute");
    expect(waitInWords(613)).toBe("about 11 minutes");
    expect(waitInWords(3600)).toBe("about 60 minutes");
  });

  it("survives an answer that is not JSON at all", () => {
    const result = parseSendOutcome(502, "<html>bad gateway</html>");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem.length).toBeGreaterThan(0);
      expect(result.code).toBe("other");
    }
  });
});

describe("reading where a payment has got to", () => {
  it("accepts a landed payment with a real block", () => {
    const result = parseProgressOutcome(
      200,
      JSON.stringify({
        ok: true,
        txid: TXID,
        landed: true,
        block: 4490655,
        confirmations: 2,
        explorerUrl: EXPLORER,
      }),
    );
    expect(result).toMatchObject({ ok: true, landed: true, block: 4490655, confirmations: 2 });
  });

  it("treats the brake as a wait rather than an error", () => {
    const result = parseProgressOutcome(429, JSON.stringify({ ok: false, code: "too-soon" }));
    expect(result).toMatchObject({ ok: false, code: "too-soon" });
  });

  it("refuses an answer with no usable transaction id", () => {
    const result = parseProgressOutcome(
      200,
      JSON.stringify({ ok: true, txid: "nope", landed: true, explorerUrl: EXPLORER }),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a payment that has not landed yet", () => {
    const result = parseProgressOutcome(
      200,
      JSON.stringify({
        ok: true,
        txid: TXID,
        landed: false,
        block: null,
        confirmations: 0,
        explorerUrl: EXPLORER,
      }),
    );
    expect(result).toMatchObject({ ok: true, landed: false, block: null });
  });
});

describe("every sentence a player reads", () => {
  const sentences: string[] = [];
  for (const round of ROUNDS) {
    sentences.push(round.title, round.brief, round.goal, round.teachOpen);
    if (round.lockedWhy) sentences.push(round.lockedWhy);
    if (round.teachHidden) sentences.push(round.teachHidden);
  }
  sentences.push(AFTER_HIDDEN_LINE, summaryLine({ met: 3, total: 3, passed: true }));
  sentences.push(leakLabelFor(HIDDEN), leakLabelFor(OPEN));

  it("contains no em dash anywhere", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toContain("\u2014");
    }
  });

  it("bans the buzzwords by name (Layer 4, D-018)", () => {
    const banned = [
      "seamless",
      "robust",
      "leverage",
      "empower",
      "unlock",
      "delve",
      "dive deep",
      "landscape",
      "ecosystem",
      "in today's world",
      "elevate",
      "cutting-edge",
      "state-of-the-art",
      "game-changer",
      "revolutionize",
      "streamline",
      "holistic",
      "journey",
      "look no further",
      "rest assured",
      "it's important to note",
      "tapestry",
      "realm",
      "foster",
      "facilitate",
      "utilize",
    ];
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      for (const word of banned) {
        expect(lower, `${word} in: ${sentence}`).not.toContain(word);
      }
    }
  });

  it("says nothing empty", () => {
    for (const sentence of sentences) {
      expect(sentence.trim().length).toBeGreaterThan(10);
    }
  });
});
