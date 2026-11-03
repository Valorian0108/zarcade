import { beforeEach, describe, expect, it } from "vitest";

import {
  GLOBAL_BUSY_MESSAGE,
  GLOBAL_READ_WINDOW_MS,
  globalBusyResponse,
  globalReadBrake,
  MAX_GLOBAL_READS_PER_MINUTE,
  MAX_TRACKED_POLLS,
  mayPoll,
  MIN_POLL_GAP_MS,
  pollSnapshotFor,
  recordGlobalRead,
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

describe("the whole-arcade brake (D-138)", () => {
  beforeEach(() => {
    resetPollsForTest();
  });

  /** Counts `count` reads, one millisecond apart, starting at `at`. */
  const fill = (count: number, at: number) => {
    for (let i = 0; i < count; i += 1) recordGlobalRead(at + i);
  };

  it("lets reads through while the arcade is quiet", () => {
    expect(globalReadBrake(NOW)).toBeNull();
    recordGlobalRead(NOW);
    expect(globalReadBrake(NOW + 1)).toBeNull();
  });

  it("refuses the read that fills the minute, and says how long to wait", () => {
    fill(MAX_GLOBAL_READS_PER_MINUTE - 1, NOW);
    expect(globalReadBrake(NOW + MAX_GLOBAL_READS_PER_MINUTE)).toBeNull();
    recordGlobalRead(NOW + MAX_GLOBAL_READS_PER_MINUTE);
    const wait = globalReadBrake(NOW + 1_000 + MAX_GLOBAL_READS_PER_MINUTE);
    expect(wait).not.toBeNull();
    // The window frees its first slot when the oldest ask falls out of it.
    if (wait !== null) {
      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(Math.ceil(GLOBAL_READ_WINDOW_MS / 1_000));
    }
  });

  it("waits exactly as long as the oldest ask takes to leave the window", () => {
    fill(MAX_GLOBAL_READS_PER_MINUTE, NOW);
    expect(globalReadBrake(NOW + 1_000)).toBe(
      Math.ceil((GLOBAL_READ_WINDOW_MS - 1_000) / 1_000),
    );
  });

  it("drops reads that have fallen out of the window before counting", () => {
    fill(MAX_GLOBAL_READS_PER_MINUTE, NOW);
    expect(globalReadBrake(NOW + GLOBAL_READ_WINDOW_MS)).not.toBeNull();
    // One millisecond later every one of those reads is outside the window.
    const later = NOW + GLOBAL_READ_WINDOW_MS + 1;
    expect(globalReadBrake(later)).toBeNull();
  });

  it("refuses in the same shape the machines already treat as keep waiting", async () => {
    const response = globalBusyResponse(7);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("7");
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({
      ok: false,
      code: "too-soon",
      problem: GLOBAL_BUSY_MESSAGE,
      retryAfterSeconds: 7,
    });
  });

  it("says the busy message once, in the house voice", () => {
    expect(GLOBAL_BUSY_MESSAGE.length).toBeGreaterThan(0);
    expect(GLOBAL_BUSY_MESSAGE).not.toMatch(/[—–]/);
  });

  it("is cleared by the test reset, together with the per-visitor counters", () => {
    fill(MAX_GLOBAL_READS_PER_MINUTE, NOW);
    expect(globalReadBrake(NOW)).not.toBeNull();
    resetPollsForTest();
    expect(globalReadBrake(NOW)).toBeNull();
  });
});
