import { describe, expect, it } from "vitest";

import {
  C2_TARGET_ZATOSHIS,
  C3_CHOICES,
  CROWD_COPY,
  CROWD_RECORDS,
  judgeFindOpen,
  judgePointAtAmount,
  judgeWhyOpen,
  LEAK_OPEN,
  LEAK_SEALED,
  shieldedRowsWithAmount,
} from "./crowd";

/**
 * The Crowd's judges and its book, checked without touching the chain. The
 * book itself is real history (D-074); these tests guard the shape of it and
 * the honesty of the judges: challenge two must never acquire a winning
 * pick, and the copy must stay inside the house voice (D-018).
 */

const TXID_SHAPE = /^[0-9a-f]{64}$/;

describe("the record book", () => {
  it("holds real-shaped transaction ids and matching explorer links", () => {
    for (const record of CROWD_RECORDS) {
      expect(record.txid).toMatch(TXID_SHAPE);
      expect(record.url).toBe(`https://testnet.zecblock.com/tx/${record.txid}`);
      expect(record.readable.length).toBeGreaterThan(0);
    }
  });

  it("holds exactly one open row and at least two sealed rows", () => {
    const open = CROWD_RECORDS.filter((r) => r.kind === "open");
    const sealed = CROWD_RECORDS.filter((r) => r.kind === "shielded");
    expect(open).toHaveLength(1);
    expect(sealed.length).toBeGreaterThanOrEqual(2);
  });

  it("never lists the sender as readable on any row (D-041)", () => {
    for (const record of CROWD_RECORDS) {
      expect(record.readable.join(" ")).not.toMatch(/sender|who sent/);
    }
  });

  it("states a block on every row, so no row stands out by shape (D-077)", () => {
    for (const record of CROWD_RECORDS) {
      expect(record.block).not.toBeNull();
    }
  });
});

describe("challenge one: find the open payment", () => {
  it("resolves the open row and seals the others", () => {
    const open = CROWD_RECORDS.find((r) => r.kind === "open");
    if (!open) throw new Error("book has no open row");
    expect(judgeFindOpen(open.id)).toMatchObject({ outcome: "found" });
    for (const sealed of CROWD_RECORDS.filter((r) => r.kind === "shielded")) {
      expect(judgeFindOpen(sealed.id)).toMatchObject({ outcome: "sealed" });
    }
  });

  it("refuses unknown ids instead of guessing", () => {
    expect(judgeFindOpen("nope")).toBeNull();
  });
});

describe("challenge two: point at the amount", () => {
  it("fails every real pick, because that is the lesson", () => {
    for (const sealed of CROWD_RECORDS.filter((r) => r.kind === "shielded")) {
      expect(judgePointAtAmount(sealed.id)).toEqual({ pass: false });
    }
  });

  it("refuses the open row and unknown ids", () => {
    const open = CROWD_RECORDS.find((r) => r.kind === "open");
    if (!open) throw new Error("book has no open row");
    expect(judgePointAtAmount(open.id)).toBeNull();
    expect(judgePointAtAmount("nope")).toBeNull();
  });

  it("keeps the reveal's claim true: every sealed row moved the named amount", () => {
    const sealed = CROWD_RECORDS.filter((r) => r.kind === "shielded");
    expect(shieldedRowsWithAmount(C2_TARGET_ZATOSHIS)).toHaveLength(sealed.length);
  });
});

describe("challenge three: why the open row is public", () => {
  it("has exactly one true answer and it is the destination rule", () => {
    const correct = C3_CHOICES.filter((c) => c.correct);
    expect(correct).toHaveLength(1);
    expect(judgeWhyOpen(correct[0].id)).toMatchObject({ pass: true });
    for (const wrong of C3_CHOICES.filter((c) => !c.correct)) {
      expect(judgeWhyOpen(wrong.id)).toMatchObject({ pass: false });
    }
    expect(judgeWhyOpen("nope")).toBeNull();
  });
});

describe("the meter and the voice", () => {
  it("reads an open row as two of four facts and a sealed row as none", () => {
    expect(LEAK_OPEN).toBe(0.5);
    expect(LEAK_SEALED).toBe(0);
  });

  it("says everything in the house voice: no em dashes, no empty lines", () => {
    for (const value of Object.values(CROWD_COPY)) {
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toMatch(/[—–]/);
    }
  });
});
