import { describe, expect, it } from "vitest";

import {
  ALLOWED_BODY_KEYS,
  BRANCHES,
  checkSender,
  dayKey,
  decideSend,
  isBranch,
  parseRoundRequest,
  type LedgerSnapshot,
  type Limits,
  type SenderHeaders,
} from "@/lib/zcash/guardrails";

/**
 * These are the guardrails from D-025 and D-030 written as tests. The point of
 * the file is the second block: a caller must have no way to say where the
 * money goes or how much moves.
 */

const LIMITS: Limits = {
  minSecondsBetweenSends: 30,
  maxSendsPerIpPerHour: 3,
  maxSendsPerDayGlobal: 5,
};

const QUIET: LedgerSnapshot = {
  lastSendAtMs: null,
  thisVisitorSendTimesMs: [],
  sendsToday: 0,
};

const NOW = Date.parse("2026-10-11T12:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 3_600_000;

describe("the request shape", () => {
  it("accepts the two real choices", () => {
    expect(parseRoundRequest('{"choice":"hide"}')).toEqual({ ok: true, branch: "hide" });
    expect(parseRoundRequest('{"choice":"open"}')).toEqual({ ok: true, branch: "open" });
  });

  it("has no field for a destination or an amount, and never will by accident", () => {
    // A regression guard: adding a key here would be the whole guardrail
    // disappearing, so the test fails loudly rather than quietly allowing it.
    expect([...ALLOWED_BODY_KEYS]).toEqual(["choice"]);
    expect([...BRANCHES]).toEqual(["hide", "open"]);
  });

  it("refuses a smuggled destination even when the choice is valid", () => {
    const attempt = parseRoundRequest('{"choice":"open","to":"tmSomebodyElsesAddress"}');
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.problem).toMatch(/never asks for an address/);
  });

  it("refuses a smuggled amount", () => {
    expect(parseRoundRequest('{"choice":"hide","zatoshis":99999999}').ok).toBe(false);
  });

  it("refuses a smuggled note", () => {
    expect(parseRoundRequest('{"choice":"hide","memo":"hello"}').ok).toBe(false);
  });

  it("refuses anything that is not one small object", () => {
    expect(parseRoundRequest("not json at all").ok).toBe(false);
    expect(parseRoundRequest('["hide"]').ok).toBe(false);
    expect(parseRoundRequest('"hide"').ok).toBe(false);
    expect(parseRoundRequest("null").ok).toBe(false);
    expect(parseRoundRequest("").ok).toBe(false);
  });

  it("refuses a choice that is missing, mistyped, or invented", () => {
    expect(parseRoundRequest("{}").ok).toBe(false);
    expect(parseRoundRequest('{"choice":true}').ok).toBe(false);
    expect(parseRoundRequest('{"choice":"steal"}').ok).toBe(false);
    // Case matters: the game sends lowercase, and guessing at anything else
    // would mean accepting words we have not thought about.
    expect(parseRoundRequest('{"choice":"HIDE"}').ok).toBe(false);
  });

  it("says what to do instead, in plain words", () => {
    const result = parseRoundRequest("{}");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problem).toContain("hide it");
      expect(result.problem).toContain("leave it open");
      // Layer 4 voice rule (D-018): no em dashes anywhere a player reads.
      expect(result.problem).not.toContain("\u2014");
    }
  });

  it("recognises exactly the two branches", () => {
    expect(isBranch("hide")).toBe(true);
    expect(isBranch("open")).toBe(true);
    expect(isBranch("")).toBe(false);
    expect(isBranch("shield")).toBe(false);
  });
});

describe("when a round may move money", () => {
  it("allows the first round of a quiet day", () => {
    expect(decideSend(QUIET, LIMITS, NOW)).toEqual({ allow: true });
  });

  it("makes everyone wait out the global pause, and says for how long", () => {
    const busy: LedgerSnapshot = { ...QUIET, lastSendAtMs: NOW - 10_000 };
    const decision = decideSend(busy, LIMITS, NOW);
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.retryAfterSeconds).toBe(20);
      expect(decision.problem).toContain("20 seconds");
      expect(decision.problem).toContain("still busy");
    }
  });

  it("lets the next round through once the pause has passed", () => {
    expect(decideSend({ ...QUIET, lastSendAtMs: NOW - 30_000 }, LIMITS, NOW)).toEqual({
      allow: true,
    });
    expect(decideSend({ ...QUIET, lastSendAtMs: NOW - 30_001 }, LIMITS, NOW)).toEqual({
      allow: true,
    });
  });

  it("counts one visitor's rounds within the hour only", () => {
    const threeRecent = [NOW - 5 * MINUTE, NOW - 20 * MINUTE, NOW - 40 * MINUTE];
    const decision = decideSend(
      { ...QUIET, thisVisitorSendTimesMs: threeRecent },
      LIMITS,
      NOW,
    );
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      // The slot frees up when the oldest of the three leaves the hour.
      expect(decision.retryAfterSeconds).toBe(Math.ceil((HOUR - 40 * MINUTE) / 1000));
      expect(decision.problem).toContain("your share");
    }
  });

  it("forgets rounds older than an hour", () => {
    const stale = [NOW - 2 * HOUR, NOW - 90 * MINUTE];
    expect(decideSend({ ...QUIET, thisVisitorSendTimesMs: stale }, LIMITS, NOW)).toEqual({
      allow: true,
    });
  });

  it("stops at the daily ceiling for everybody", () => {
    const decision = decideSend({ ...QUIET, sendsToday: 5 }, LIMITS, NOW);
    expect(decision.allow).toBe(false);
    if (!decision.allow) {
      expect(decision.problem).toContain("tomorrow");
      // Midnight UTC, which is when the counter starts over.
      expect(decision.retryAfterSeconds).toBe(12 * 60 * 60);
    }
  });

  it("checks the pause before the visitor's share", () => {
    const both: LedgerSnapshot = {
      lastSendAtMs: NOW - 1_000,
      thisVisitorSendTimesMs: [NOW - MINUTE, NOW - 2 * MINUTE, NOW - 3 * MINUTE],
      sendsToday: 0,
    };
    const decision = decideSend(both, LIMITS, NOW);
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.problem).toContain("still busy");
  });

  it("names the day the way the counter expects", () => {
    expect(dayKey(NOW)).toBe("2026-10-11");
    expect(dayKey(NOW + 12 * HOUR)).toBe("2026-10-12");
  });
});

describe("who may ask for a round (D-137)", () => {
  const HOST = "web-production-22d97.up.railway.app";
  const HERE = `https://${HOST}`;

  const headers = (over: Partial<SenderHeaders> = {}): SenderHeaders => ({
    contentType: "application/json",
    secFetchSite: "same-origin",
    origin: HERE,
    host: HOST,
    ...over,
  });

  it("lets this page ask, with or without a charset on the type", () => {
    expect(checkSender(headers()).ok).toBe(true);
    expect(checkSender(headers({ contentType: "application/json; charset=utf-8" })).ok).toBe(true);
  });

  it("lets a visitor who typed the address ask", () => {
    expect(checkSender(headers({ secFetchSite: "none", origin: null })).ok).toBe(true);
  });

  it("refuses a body that is not JSON before it reads a word of it", () => {
    // This is the shape a cross-origin form or text post arrives in, and the
    // only shape a browser sends without asking permission first.
    const plain = checkSender(
      headers({ contentType: "text/plain;charset=UTF-8", secFetchSite: "cross-site" }),
    );
    expect(plain.ok).toBe(false);
    if (!plain.ok) expect(plain.status).toBe(415);
  });

  it("refuses a request another site started", () => {
    const out = checkSender(
      headers({ secFetchSite: "cross-site", origin: "https://someone-else.example" }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(403);
  });

  it("refuses a neighbour on the same rented domain", () => {
    // Same-site is not us. The arcade lives on a domain other tenants share.
    expect(
      checkSender(
        headers({ secFetchSite: "same-site", origin: "https://other-tenant.up.railway.app" }),
      ).ok,
    ).toBe(false);
  });

  it("falls back to the host when the browser sends no Sec-Fetch-Site", () => {
    expect(checkSender(headers({ secFetchSite: null })).ok).toBe(true);
    expect(
      checkSender(headers({ secFetchSite: null, origin: "https://someone-else.example" })).ok,
    ).toBe(false);
  });

  it("compares hosts without the port getting in the way", () => {
    expect(
      checkSender(
        headers({
          secFetchSite: null,
          origin: "http://localhost:3000",
          host: "localhost:3000",
        }),
      ).ok,
    ).toBe(true);
  });

  it("refuses an Origin it cannot read rather than trusting it", () => {
    expect(checkSender(headers({ secFetchSite: null, origin: "not a url" })).ok).toBe(false);
  });

  it("lets a request with no Origin through, which is what a person and an operator both send", () => {
    expect(checkSender(headers({ secFetchSite: null, origin: null })).ok).toBe(true);
  });

  it("says something a player can act on when it refuses, in the house voice", () => {
    const out = checkSender(headers({ secFetchSite: "cross-site" }));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.problem.length).toBeGreaterThan(0);
      expect(out.problem).toMatch(/buttons/);
      expect(out.problem).not.toMatch(/[—–]/);
    }
  });
});
