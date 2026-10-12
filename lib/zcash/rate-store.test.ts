import { beforeEach, describe, expect, it } from "vitest";

import { decideSend, type Limits } from "@/lib/zcash/guardrails";
import {
  recordSend,
  refundRoundKeepingPause,
  resetCountersForTest,
  snapshotFor,
  visitorKey,
} from "@/lib/zcash/rate-store";

const LIMITS: Limits = {
  minSecondsBetweenSends: 30,
  maxSendsPerIpPerHour: 3,
  maxSendsPerDayGlobal: 5,
};

const NOW = Date.parse("2026-10-11T12:00:00.000Z");
const MINUTE = 60_000;
const HOUR = 3_600_000;

describe("the counters", () => {
  beforeEach(() => {
    resetCountersForTest();
  });

  it("starts quiet", () => {
    expect(snapshotFor("alice", NOW)).toEqual({
      lastSendAtMs: null,
      thisVisitorSendTimesMs: [],
      sendsToday: 0,
    });
  });

  it("counts a round against the visitor and against the day", () => {
    recordSend("alice", NOW);
    const snapshot = snapshotFor("alice", NOW + 1);
    expect(snapshot.lastSendAtMs).toBe(NOW);
    expect(snapshot.sendsToday).toBe(1);
    expect(snapshot.thisVisitorSendTimesMs).toEqual([NOW]);
  });

  it("gives each visitor their own share, but one shared pot for the day", () => {
    recordSend("alice", NOW);
    recordSend("bob", NOW + 1);

    expect(snapshotFor("alice", NOW + 2).thisVisitorSendTimesMs).toHaveLength(1);
    expect(snapshotFor("bob", NOW + 2).thisVisitorSendTimesMs).toHaveLength(1);
    expect(snapshotFor("alice", NOW + 2).sendsToday).toBe(2);
    expect(snapshotFor("bob", NOW + 2).sendsToday).toBe(2);
  });

  it("really does stop a visitor who has had their share", () => {
    // The pause is skipped forward each time so only the hourly rule can bite.
    for (let i = 0; i < 3; i += 1) {
      const at = NOW + i * 31_000;
      expect(decideSend(snapshotFor("alice", at), LIMITS, at).allow).toBe(true);
      recordSend("alice", at);
    }
    const after = NOW + 3 * 31_000;
    expect(decideSend(snapshotFor("alice", after), LIMITS, after).allow).toBe(false);
  });

  it("really does stop the whole arcade at the daily ceiling", () => {
    for (let i = 0; i < 5; i += 1) {
      const at = NOW + i * 31_000;
      recordSend(`visitor-${i}`, at);
    }
    const after = NOW + 5 * 31_000;
    expect(decideSend(snapshotFor("newcomer", after), LIMITS, after).allow).toBe(false);
    // A brand new visitor has had no rounds of their own, and is still stopped.
    expect(snapshotFor("newcomer", after).thisVisitorSendTimesMs).toHaveLength(0);
  });

  it("starts the day's count over at midnight, UTC", () => {
    recordSend("alice", NOW);
    expect(snapshotFor("alice", NOW).sendsToday).toBe(1);
    // An hour later is still the same UTC day, so the count carries on.
    expect(snapshotFor("alice", NOW + HOUR).sendsToday).toBe(1);

    recordSend("alice", NOW + 13 * HOUR);
    expect(snapshotFor("alice", NOW + 13 * HOUR).sendsToday).toBe(1);
  });

  it("does not keep a visitor's rounds forever", () => {
    recordSend("alice", NOW);
    recordSend("alice", NOW + 90 * MINUTE);
    // The first one is now outside the hour and has been dropped from the list.
    expect(snapshotFor("alice", NOW + 90 * MINUTE).thisVisitorSendTimesMs).toEqual([
      NOW + 90 * MINUTE,
    ]);
  });
  it("gives the allowance back when no money moved, but keeps the pause", () => {
    recordSend("alice", NOW);
    expect(snapshotFor("alice", NOW).sendsToday).toBe(1);
    expect(snapshotFor("alice", NOW).thisVisitorSendTimesMs).toEqual([NOW]);

    refundRoundKeepingPause("alice", NOW);

    const after = snapshotFor("alice", NOW + 1);
    expect(after.sendsToday).toBe(0);
    expect(after.thisVisitorSendTimesMs).toEqual([]);
    // The pause is the part that must survive, so a tight retry loop cannot
    // spin against a wallet that is waiting for the network.
    expect(after.lastSendAtMs).toBe(NOW);
    expect(decideSend(after, LIMITS, NOW + 1).allow).toBe(false);
    expect(decideSend(after, LIMITS, NOW + 31_000).allow).toBe(true);
  });

  it("removes only the booking it is given, and never counts below zero", () => {
    recordSend("alice", NOW);
    recordSend("alice", NOW + 60_000);
    expect(snapshotFor("alice", NOW + 60_001).sendsToday).toBe(2);

    refundRoundKeepingPause("alice", NOW);
    expect(snapshotFor("alice", NOW + 60_001).sendsToday).toBe(1);
    expect(snapshotFor("alice", NOW + 60_001).thisVisitorSendTimesMs).toEqual([NOW + 60_000]);

    // Refunding something that was never booked must not invent negative room.
    refundRoundKeepingPause("alice", NOW);
    refundRoundKeepingPause("alice", NOW);
    expect(snapshotFor("alice", NOW + 60_001).sendsToday).toBe(0);
  });
});

describe("who is asking", () => {
  it("takes the first address a proxy forwarded", () => {
    const request = new Request("http://localhost/api/game/unseen/send", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    });
    expect(visitorKey(request)).toBe("203.0.113.7");
  });

  it("falls back to the real-ip header, then to one shared local bucket", () => {
    const withRealIp = new Request("http://localhost/x", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(visitorKey(withRealIp)).toBe("203.0.113.9");

    const bare = new Request("http://localhost/x");
    expect(visitorKey(bare)).toBe("local");

    const blank = new Request("http://localhost/x", { headers: { "x-forwarded-for": "  " } });
    expect(visitorKey(blank)).toBe("local");
  });
});
