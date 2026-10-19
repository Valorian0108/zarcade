import { describe, expect, it } from "vitest";

import {
  PROOF_RECORD_LABEL,
  proofRecord,
  safeReply,
  type ProofQuestion,
} from "./proof";

/**
 * The Proof Puzzle's record (D-108). The bug this guards against: the panel
 * used to print the button the player pressed, dressed as the safe's reply, so
 * a wrong answer could read open. The words must come from the match, never
 * from the button, because the panel is named The Safe and it is the safe
 * speaking. These tests hold that line without touching the chain.
 */

/** A question whose true answer for the player's own code is `answer`. */
const q = (text: string, answer: boolean): ProofQuestion => ({ text, answer });

describe("the safe's reply", () => {
  it("says open when the answer matched and shut when it did not", () => {
    expect(safeReply(true)).toBe("open");
    expect(safeReply(false)).toBe("shut");
  });
});

describe("the running record of the safe", () => {
  const questions = [
    q("Do all three digits add up to more than ten?", false),
    q("Is your second digit an even number?", true),
    q("Is your third digit smaller than four?", true),
  ];

  it("reads the match, not the button: a right No reads open", () => {
    // Truth is false, the player answers No (false). That matches, so open.
    const [first] = proofRecord(questions, [false]);
    expect(first.note).toBe("open");
  });

  it("reads the match, not the button: a wrong Yes reads shut", () => {
    // Truth is false, the player answers Yes (true). That misses, so shut.
    const [first] = proofRecord(questions, [true]);
    expect(first.note).toBe("shut");
  });

  it("never lets a wrong answer read open, whichever button was pressed", () => {
    for (const truth of [true, false]) {
      for (const pressed of [true, false]) {
        const [line] = proofRecord([q("any", truth)], [pressed]);
        const matched = truth === pressed;
        expect(line.note).toBe(matched ? "open" : "shut");
        if (!matched) expect(line.note).not.toBe("open");
      }
    }
  });

  it("shows a dash for questions not yet asked", () => {
    const lines = proofRecord(questions, [false]);
    expect(lines.map((l) => l.note)).toEqual(["open", "—", "—"]);
  });

  it("keeps the question text beside each reply", () => {
    const lines = proofRecord(questions, [false, true, true]);
    expect(lines.map((l) => l.label)).toEqual(questions.map((x) => x.text));
    expect(lines.map((l) => l.note)).toEqual(["open", "open", "open"]);
  });
});

describe("the panel name", () => {
  it("calls the record The Safe, so the reader knows who speaks", () => {
    expect(PROOF_RECORD_LABEL).toBe("The Safe");
  });
});
