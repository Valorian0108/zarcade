/**
 * Tests for cabinet four's rules layer (SCOPE-CABINET-4.md, D-115 onward).
 *
 * The fixtures are not invented: both receipts are the real testnet deposits
 * the merchant account holds, read back through the incoming-only scan
 * (D-117, D-119). Testing against real values means a wrong block number or
 * a wrong amount fails here rather than quietly reaching the screen.
 *
 * The last describe block is the house copy pass: every sentence this file
 * can put in front of a player is checked for em dashes and banned
 * buzzwords (D-018), and for saying something at all.
 */

import { describe, expect, it } from "vitest";

import {
  addressInWords,
  amountInWords,
  BALANCE_ANSWER,
  blockTimeInWords,
  DEPOSIT_MEMO,
  depositReceipt,
  explorerUrl,
  failedChecks,
  memoInWords,
  proofFor,
  proofHolds,
  proofInWords,
  WHO_PAID_SEALED,
  type Proof,
  type Receipt,
} from "@/lib/merchant";

/** The first real deposit: INV-204, block 4543955, Ironwood action 1. */
const INV_204: Receipt = {
  txid: "1e829a3e7079ad20df4c9f0da5f445b557056de53338fcbd683d238dec95536a",
  outputIndex: 1,
  zatoshis: 1000,
  memo: "INV-204",
  block: 4543955,
  blockTime: 1793016580,
};

/** The second real deposit: INV-187, block 4544108, Ironwood action 0. */
const INV_187: Receipt = {
  txid: "6f68ea5be2661e8dd5a87a1c3d9aaf675f4e38daa2c914ee1f441216a1cc7c25",
  outputIndex: 0,
  zatoshis: 1000,
  memo: "INV-187",
  block: 4544108,
  blockTime: 0,
};

/** A proof where all five shipped checks passed, as the verifier returned it. */
const PASSING_PROOF: Proof = {
  txid: INV_204.txid,
  outputIndex: 1,
  zatoshis: 1000,
  memo: "INV-204",
  claimedBlock: 4543955,
  networkBlock: 4543955,
  commitment: "4c9150e1ffcddc33cb21d3401ad5cb9d00099608d157762a2d6b71f14be61829",
  checks: [
    { name: "note_decrypted", passed: true, detail: "" },
    { name: "commitment_matches", passed: true, detail: "" },
    { name: "height_confirmed", passed: true, detail: "" },
    { name: "no_key_material", passed: true, detail: "" },
    { name: "result_only", passed: true, detail: "" },
  ],
  verified: true,
};

describe("depositReceipt", () => {
  it("finds the deposit by the memo the payment really carried", () => {
    expect(depositReceipt([INV_187, INV_204])).toEqual(INV_204);
    expect(depositReceipt([INV_204, INV_187])).toEqual(INV_204);
  });

  it("returns null when no row carries the memo, and never picks a stand-in", () => {
    // The newest, the oldest and the only row are all tempting fallbacks.
    // Each would put a false label on somebody's money, so none is allowed.
    expect(depositReceipt([])).toBeNull();
    expect(depositReceipt([INV_187])).toBeNull();
    expect(depositReceipt([{ ...INV_187, memo: null }])).toBeNull();
  });

  it("matches the memo exactly, not approximately", () => {
    expect(depositReceipt([{ ...INV_204, memo: "inv-204" }])).toBeNull();
    expect(depositReceipt([{ ...INV_204, memo: "INV-2040" }])).toBeNull();
    expect(depositReceipt([{ ...INV_204, memo: DEPOSIT_MEMO }])).toEqual(INV_204);
  });
});

describe("proofFor", () => {
  it("matches a proof to its receipt on txid AND output index", () => {
    // One transaction can pay several recipients. A proof of action 1 says
    // nothing about action 0, so matching on the txid alone would let the
    // cabinet show the wrong verdict on the wrong row.
    const proofs = [PASSING_PROOF];
    expect(proofFor(proofs, INV_204)).toEqual(PASSING_PROOF);
    expect(proofFor(proofs, { ...INV_204, outputIndex: 0 })).toBeNull();
    expect(proofFor(proofs, INV_187)).toBeNull();
    expect(proofFor([], INV_204)).toBeNull();
  });

  it("finds the right proof when both receipts have one", () => {
    const second: Proof = {
      ...PASSING_PROOF,
      txid: INV_187.txid,
      outputIndex: 0,
      memo: "INV-187",
      claimedBlock: 4544108,
      networkBlock: 4544108,
    };
    expect(proofFor([PASSING_PROOF, second], INV_187)).toEqual(second);
    expect(proofFor([PASSING_PROOF, second], INV_204)).toEqual(PASSING_PROOF);
  });
});

describe("the Receipt shape", () => {
  it("has no field for who paid, on any row", () => {
    // Forbidden list item 4: a receiving-side key does not name the payer, so
    // the type must not even have somewhere to put one. This is checked on
    // the real rows rather than on a comment.
    for (const receipt of [INV_204, INV_187]) {
      const keys = Object.keys(receipt).sort();
      expect(keys).toEqual([
        "block",
        "blockTime",
        "memo",
        "outputIndex",
        "txid",
        "zatoshis",
      ]);
      expect(keys.some((k) => k.toLowerCase().includes("from"))).toBe(false);
      expect(keys.some((k) => k.toLowerCase().includes("sender"))).toBe(false);
      expect(keys.some((k) => k.toLowerCase().includes("payer"))).toBe(false);
    }
  });

  it("keeps 'who paid: still sealed' worded as the scope says", () => {
    expect(WHO_PAID_SEALED).toBe("Who paid: still sealed");
  });
});

describe("amountInWords", () => {
  it("writes the real deposit the way the explorer does", () => {
    expect(amountInWords(1000)).toBe("0.00001000 TAZ");
  });

  it("never rounds away a fraction", () => {
    expect(amountInWords(1)).toBe("0.00000001 TAZ");
    expect(amountInWords(123456789)).toBe("1.23456789 TAZ");
    expect(amountInWords(0)).toBe("0.00000000 TAZ");
  });
});

describe("addressInWords", () => {
  it("shortens the merchant's real address and keeps the ends readable", () => {
    const address =
      "utest1xk7zhcqyyv8wluyjpfqmglk2ukf4fy7n57j64lxtzty4qlwx2fssjl8rzwjfetcaf379qjwhdpx9k78fdq5743u9j30zn040kugv3elq";
    expect(addressInWords(address)).toBe("utest1...v3elq");
  });

  it("leaves a short string alone", () => {
    expect(addressInWords("short")).toBe("short");
  });
});

describe("memoInWords", () => {
  it("shows the memo the chain carried", () => {
    expect(memoInWords("INV-204")).toBe("INV-204");
    expect(memoInWords("INV-187")).toBe("INV-187");
  });

  it("says plainly when a payment carried no message", () => {
    expect(memoInWords(null)).toBe("No message on this payment");
  });
});

describe("blockTimeInWords", () => {
  it("renders the real INV-204 block time in UTC", () => {
    expect(blockTimeInWords(1793016580)).toBe("26 October 2026, 12:09 UTC");
  });

  it("says the time was not recorded instead of showing 1970", () => {
    expect(blockTimeInWords(0)).toBe("Time not recorded");
    expect(blockTimeInWords(-1)).toBe("Time not recorded");
    expect(blockTimeInWords(Number.NaN)).toBe("Time not recorded");
  });
});

describe("explorerUrl", () => {
  it("links to the explorer that indexes this chain (D-027)", () => {
    expect(explorerUrl(INV_204.txid)).toBe(
      `https://testnet.zecblock.com/tx/${INV_204.txid}`,
    );
  });
});

describe("proofHolds", () => {
  it("holds when every shipped check passed", () => {
    expect(proofHolds(PASSING_PROOF)).toBe(true);
  });

  it("fails when any single check failed, however the summary reads", () => {
    for (let i = 0; i < PASSING_PROOF.checks.length; i++) {
      const checks = PASSING_PROOF.checks.map((c, j) =>
        j === i ? { ...c, passed: false } : c,
      );
      // verified stays true on purpose: the point is that the screen does not
      // trust the flag when a check underneath it says otherwise.
      expect(proofHolds({ ...PASSING_PROOF, checks, verified: true })).toBe(false);
    }
  });

  it("fails on an empty check list even with verified true", () => {
    expect(proofHolds({ ...PASSING_PROOF, checks: [] })).toBe(false);
  });

  it("fails when the summary flag is false, however the checks read", () => {
    expect(proofHolds({ ...PASSING_PROOF, verified: false })).toBe(false);
  });
});

describe("failedChecks", () => {
  it("names the checks that did not pass, in order", () => {
    expect(failedChecks(PASSING_PROOF)).toEqual([]);
    const broken: Proof = {
      ...PASSING_PROOF,
      verified: false,
      checks: [
        { name: "note_decrypted", passed: true, detail: "" },
        { name: "commitment_matches", passed: false, detail: "" },
        { name: "height_confirmed", passed: true, detail: "" },
        { name: "no_key_material", passed: false, detail: "" },
        { name: "result_only", passed: true, detail: "" },
      ],
    };
    expect(failedChecks(broken)).toEqual(["commitment_matches", "no_key_material"]);
  });
});

describe("proofInWords", () => {
  it("says what the chain vouches for when the proof holds", () => {
    const words = proofInWords(PASSING_PROOF);
    expect(words).toContain("4543955");
    expect(words).toContain("fingerprint matches");
  });

  it("claims nothing either way when a check failed, and names what failed", () => {
    const broken: Proof = {
      ...PASSING_PROOF,
      verified: false,
      checks: PASSING_PROOF.checks.map((c) =>
        c.name === "commitment_matches" ? { ...c, passed: false } : c,
      ),
    };
    const words = proofInWords(broken);
    expect(words).toContain("did not pass");
    expect(words).toContain("commitment_matches");
    expect(words).toContain("nothing is claimed either way");
  });

  it("claims nothing when the checks never came back", () => {
    expect(proofInWords({ ...PASSING_PROOF, checks: [] })).toBe(
      "The check did not complete, so nothing is claimed either way.",
    );
  });

  it("says so when nothing has been checked yet", () => {
    expect(proofInWords(null)).toBe("Nothing has been checked yet.");
  });
});

describe("the balance answer", () => {
  it("says the key cannot answer, without giving a number", () => {
    // Beat 6's whole point: the incoming key sees money arriving, never money
    // leaving. Any digit in this sentence would be a number the key cannot
    // back, so the sentence must contain none.
    expect(BALANCE_ANSWER).not.toMatch(/[0-9]/);
    expect(BALANCE_ANSWER).toContain("Not from this key alone");
    expect(BALANCE_ANSWER).toContain("different secret");
  });
});

describe("every sentence cabinet four can show (grandma rule, D-018)", () => {
  const sentences: string[] = [
    WHO_PAID_SEALED,
    BALANCE_ANSWER,
    memoInWords(null),
    // The memo itself ("INV-204") is chain data, not a sentence, so it is
    // checked in the memoInWords block above and not asked to be prose here.
    blockTimeInWords(0),
    blockTimeInWords(INV_204.blockTime),
    proofInWords(null),
    proofInWords(PASSING_PROOF),
    proofInWords({ ...PASSING_PROOF, checks: [] }),
    proofInWords({
      ...PASSING_PROOF,
      verified: false,
      checks: PASSING_PROOF.checks.map((c) => ({ ...c, passed: false })),
    }),
  ];

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
