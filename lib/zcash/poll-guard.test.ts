import { beforeEach, describe, expect, it } from "vitest";

import {
  MAX_TRACKED_POLLS,
  mayPoll,
  MIN_POLL_GAP_MS,
  pollSnapshotFor,
  recordPoll,
  resetPollsForTest,
  secondsUntilNextPoll,
} from "@/lib/zcash/poll-guard";

const NOW = Date.parse("2026-10-12T12:00:00.000Z");
const TXID = "a".repeat(64);

describe("the spacing rule", () => {
  it("lets a first ask through", () => {
    expect(mayPoll(null, NOW)).toBe(true);
    expect(secondsUntilNextPoll(null, NOW)).toBe(0);
  });

  it("turns away an ask that comes too soon", () => {
    expect(mayPoll(NOW, NOW + 1_000)).toBe(false);
    expect(secondsUntilNextPoll(NOW, NOW + 1_000)).toBe(3);
  });

  it("lets an ask through once the gap has passed", () => {
    expect(mayPoll(NOW, NOW + MIN_POLL_GAP_MS)).toBe(true);
    expect(secondsUntilNextPoll(NOW, NOW + MIN_POLL_GAP_MS)).toBe(0);
  });

  it("never reports a negative wait", () => {
    expect(secondsUntilNextPoll(NOW, NOW + MIN_POLL_GAP_MS + 60_000)).toBe(0);
  });
});

describe("the counters", () => {
  beforeEach(() => {
    resetPollsForTest();
  });

  it("starts with no record of anybody", () => {
    expect(pollSnapshotFor("alice", TXID)).toBeNull();
  });

  it("remembers who asked about what", () => {
    recordPoll("alice", TXID, NOW);
    expect(pollSnapshotFor("alice", TXID)).toBe(NOW);
    // A different visitor asking about the same payment is a separate bucket.
    expect(pollSnapshotFor("bob", TXID)).toBeNull();
  });

  it("keeps visitors apart on the same payment", () => {
    recordPoll("alice", TXID, NOW);
    recordPoll("bob", TXID, NOW + 500);
    expect(pollSnapshotFor("alice", TXID)).toBe(NOW);
    expect(pollSnapshotFor("bob", TXID)).toBe(NOW + 500);
  });

  it("keeps payments apart for the same visitor", () => {
    const other = "b".repeat(64);
    recordPoll("alice", TXID, NOW);
    expect(pollSnapshotFor("alice", other)).toBeNull();
  });

  it("updates rather than accumulates when asked again", () => {
    recordPoll("alice", TXID, NOW);
    recordPoll("alice", TXID, NOW + 10_000);
    expect(pollSnapshotFor("alice", TXID)).toBe(NOW + 10_000);
  });

  it("stops growing at the cap, and drops the oldest first", () => {
    for (let i = 0; i < MAX_TRACKED_POLLS + 50; i += 1) {
      recordPoll(`visitor-${i}`, TXID, NOW + i);
    }
    expect(pollSnapshotFor("visitor-0", TXID)).toBeNull();
    expect(pollSnapshotFor(`visitor-${MAX_TRACKED_POLLS + 49}`, TXID)).not.toBeNull();
  });
});
