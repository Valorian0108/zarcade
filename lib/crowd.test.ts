import { describe, expect, it } from "vitest";

import {
  buildBook,
  C2_TARGET_ZATOSHIS,
  C3_CHOICES,
  CROWD_COPY,
  CROWD_RECORDS,
  judgeFindOpen,
  judgePointAtAmount,
  judgeWhyOpen,
  LEAK_OPEN,
  LEAK_SEALED,
  shuffled,
  shieldedRowsWithAmount,
  type LiveRow,
} from "./crowd";

/**
 * The Crowd's judges, its book, its shuffle (D-092) and its live composer
 * (D-093), checked without touching the chain. The curated book is real
 * history (D-074); these tests guard the shape of it and the honesty of
 * the judges: challenge two must never acquire a winning pick, no row may
 * stand out by shape (D-077), and the copy must stay inside the house
 * voice (D-018).
 */

const TXID_SHAPE = /^[0-9a-f]{64}$/;

describe("the curated record book", () => {
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
    expect(judgeFindOpen(CROWD_RECORDS, open.id)).toMatchObject({ outcome: "found" });
    for (const sealed of CROWD_RECORDS.filter((r) => r.kind === "shielded")) {
      expect(judgeFindOpen(CROWD_RECORDS, sealed.id)).toMatchObject({ outcome: "sealed" });
    }
  });

  it("refuses unknown ids instead of guessing", () => {
    expect(judgeFindOpen(CROWD_RECORDS, "nope")).toBeNull();
  });

  it("judges by identity, never by position: a shuffled book scores the same", () => {
    // D-092: whatever order the rows print in, the same ids win and lose.
    const order = shuffled(CROWD_RECORDS, 7);
    const open = order.find((r) => r.kind === "open");
    if (!open) throw new Error("book has no open row");
    expect(judgeFindOpen(order, open.id)).toMatchObject({ outcome: "found" });
    for (const sealed of order.filter((r) => r.kind === "shielded")) {
      expect(judgeFindOpen(order, sealed.id)).toMatchObject({ outcome: "sealed" });
    }
  });
});

describe("challenge two: point at the amount", () => {
  it("fails every real pick, because that is the lesson", () => {
    for (const sealed of CROWD_RECORDS.filter((r) => r.kind === "shielded")) {
      expect(judgePointAtAmount(CROWD_RECORDS, sealed.id)).toEqual({ pass: false });
    }
  });

  it("refuses the open row and unknown ids", () => {
    const open = CROWD_RECORDS.find((r) => r.kind === "open");
    if (!open) throw new Error("book has no open row");
    expect(judgePointAtAmount(CROWD_RECORDS, open.id)).toBeNull();
    expect(judgePointAtAmount(CROWD_RECORDS, "nope")).toBeNull();
  });

  it("keeps the reveal's claim true: every sealed row moved the named amount", () => {
    const sealed = CROWD_RECORDS.filter((r) => r.kind === "shielded");
    expect(shieldedRowsWithAmount(CROWD_RECORDS, C2_TARGET_ZATOSHIS)).toHaveLength(sealed.length);
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

  it("survives the shuffle: order changes, truth does not (D-092)", () => {
    for (const seed of [1, 99, 12345]) {
      const order = shuffled(C3_CHOICES, seed);
      expect(order).toHaveLength(C3_CHOICES.length);
      expect(order.filter((c) => c.correct)).toHaveLength(1);
      expect(judgeWhyOpen(order.find((c) => c.correct)!.id)).toMatchObject({ pass: true });
    }
  });
});

describe("the trap and the grounded answers (D-096)", () => {
  it("keeps hope alive on the first sealed pick, then springs the gotcha", () => {
    // The first beat must not admit the answer is unknowable, or the trap
    // dies before the player tries the second row.
    expect(CROWD_COPY.c2First).not.toMatch(/nobody|cannot|impossible|unknowable/i);
    expect(CROWD_COPY.c2Gotcha).toMatch(/both/i);
    expect(CROWD_COPY.c2Same.length).toBeGreaterThan(0);
  });

  it("refutes each wrong answer with evidence the book itself holds", () => {
    // The block answer dies on the sealed rows' own block numbers; the tiny
    // answer dies on challenge two's 1,000-zatoshi proof. A player who knows
    // nothing about crypto can check both in the record they already hold.
    const wrongIds = C3_CHOICES.filter((c) => !c.correct).map((c) => c.id);
    expect(wrongIds).toEqual(["block", "tiny"]);
    expect(CROWD_COPY.c3WrongBlock).toMatch(/block/i);
    expect(CROWD_COPY.c3WrongTiny).toMatch(/1,000/);
  });
});

describe("the shuffle (D-092)", () => {
  it("reorders without ever dropping or duplicating an item", () => {
    for (const seed of [0, 1, 7, 12345, 999999999]) {
      const out = shuffled(CROWD_RECORDS, seed);
      expect(out).toHaveLength(CROWD_RECORDS.length);
      expect(out.map((r) => r.id).sort()).toEqual(CROWD_RECORDS.map((r) => r.id).sort());
    }
  });

  it("is deterministic per seed and varies across seeds", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffled(items, 42)).toEqual(shuffled(items, 42));
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => shuffled(items, seed).join(",")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("never mutates the book it was given", () => {
    const before = CROWD_RECORDS.map((r) => r.id).join(",");
    shuffled(CROWD_RECORDS, 3);
    expect(CROWD_RECORDS.map((r) => r.id).join(",")).toBe(before);
  });
});

describe("the live book composer (D-093)", () => {
  const liveRow = (over: Partial<LiveRow> = {}): LiveRow => ({
    txid: "a".repeat(64),
    kind: "shielded",
    zatoshis: C2_TARGET_ZATOSHIS,
    block: 4500000,
    ...over,
  });

  it("falls back to the curated book when history is empty", () => {
    expect(buildBook([])).toEqual(CROWD_RECORDS);
  });

  it("serves the newest mined rows when history is rich", () => {
    const open = liveRow({ txid: "b".repeat(64), kind: "open", block: 4500003 });
    const s1 = liveRow({ txid: "c".repeat(64), block: 4500002 });
    const s2 = liveRow({ txid: "d".repeat(64), block: 4500001 });
    const book = buildBook([open, s1, s2]);
    expect(book).toHaveLength(3);
    expect(book.map((r) => r.txid)).toEqual(["b".repeat(64), "c".repeat(64), "d".repeat(64)]);
    expect(book.filter((r) => r.kind === "open")).toHaveLength(1);
    for (const r of book) {
      expect(r.block).not.toBeNull();
      expect(r.url).toBe(`https://testnet.zecblock.com/tx/${r.txid}`);
      expect(r.readable.length).toBeGreaterThan(0);
    }
  });

  it("tops up thin history from the curated rows without duplicates", () => {
    const book = buildBook([liveRow({ txid: "c".repeat(64) })]);
    expect(book).toHaveLength(3);
    expect(book.filter((r) => r.kind === "open")).toHaveLength(1);
    expect(book.filter((r) => r.kind === "shielded")).toHaveLength(2);
    expect(new Set(book.map((r) => r.txid)).size).toBe(3);
  });

  it("keeps the curated open row when history holds no open payment", () => {
    const curatedOpen = CROWD_RECORDS.find((r) => r.kind === "open");
    const book = buildBook([
      liveRow({ txid: "c".repeat(64) }),
      liveRow({ txid: "d".repeat(64), block: 4499999 }),
    ]);
    expect(book.find((r) => r.kind === "open")?.txid).toBe(curatedOpen?.txid);
  });

  it("skips rows it cannot show honestly: unmined, malformed, or off-amount", () => {
    const book = buildBook([
      liveRow({ txid: "e".repeat(64), block: null }),
      liveRow({ txid: "short" }),
      liveRow({ txid: "f".repeat(64), zatoshis: 2500 }),
    ]);
    expect(book).toEqual(CROWD_RECORDS);
  });

  it("keeps challenge two's reveal claim true for any composed book", () => {
    const book = buildBook([
      liveRow({ txid: "b".repeat(64), kind: "open" }),
      liveRow({ txid: "c".repeat(64) }),
    ]);
    const sealed = book.filter((r) => r.kind === "shielded");
    expect(shieldedRowsWithAmount(book, C2_TARGET_ZATOSHIS)).toHaveLength(sealed.length);
  });

  it("states a block on every composed row (D-077)", () => {
    const book = buildBook([
      liveRow({ txid: "b".repeat(64), kind: "open", block: 4500010 }),
      liveRow({ txid: "c".repeat(64), block: 4500009 }),
      liveRow({ txid: "d".repeat(64), block: 4500008 }),
    ]);
    for (const r of book) {
      expect(r.block).not.toBeNull();
    }
  });
});

describe("the voice a person uses (D-097)", () => {
  it("asks instead of ordering where the owner asked for an invitation", () => {
    expect(CROWD_COPY.c1Brief.trim().endsWith("?")).toBe(true);
    expect(CROWD_COPY.c2Brief.trim().endsWith("?")).toBe(true);
    expect(CROWD_COPY.c3Brief.trim().endsWith("?")).toBe(true);
  });

  it("never lets a gotcha or a reveal land without saying why", () => {
    expect(CROWD_COPY.c2Gotcha).toMatch(/shielded/);
    expect(CROWD_COPY.c2Card).toMatch(/because/);
    expect(CROWD_COPY.c3Reveal).toMatch(/the network had to/);
  });

  it("keeps the poster lines out: no compressed parallel verdicts", () => {
    for (const value of Object.values(CROWD_COPY)) {
      expect(value).not.toMatch(/zero is the win/i);
      expect(value).not.toMatch(/that is the point\.?$/i);
    }
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
