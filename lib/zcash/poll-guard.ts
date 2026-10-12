/**
 * A small brake on "where has my payment got to?" (B5).
 *
 * Watching a payment land means asking the wallet repeatedly. While the payment is
 * still on its way the wallet has to go and look at the network, and looking takes
 * the same lock that building somebody else's payment needs. One player watching
 * closely is nothing. A room full of them, each asking every couple of seconds,
 * would spend the wallet's time answering questions instead of making payments.
 *
 * So each visitor is allowed to ask about one payment once every few seconds, and
 * the answer in between is simply "not yet, ask again shortly". Nothing is hidden
 * by this. The block number does not change any faster for asking more often.
 *
 * The counters live in this process's memory for the same reason the send limits
 * do, and with the same two honest limits: they reset on a restart, and two
 * servers would each keep their own copy. See rate-store.ts.
 *
 * Every function is told the time rather than reading a clock, so the spacing can
 * be tested without waiting for it.
 */

/** How often one visitor may ask about one payment. */
export const MIN_POLL_GAP_MS = 4_000;

/**
 * How many visitor-and-payment pairs to remember at once.
 *
 * A cap rather than a cleanup timer, so a long event cannot grow this without
 * bound. When it fills, the oldest entries are dropped, and the only consequence
 * is that somebody gets one answer sooner than the spacing intended.
 */
export const MAX_TRACKED_POLLS = 400;

type State = {
  /** "visitor|txid" -> when it was last answered */
  polls: Map<string, number>;
};

let state: State = { polls: new Map() };

function keyFor(visitorKey: string, txid: string): string {
  return `${visitorKey}|${txid}`;
}

/** Pure check: is this visitor allowed to ask about this payment right now? */
export function mayPoll(
  lastMs: number | null,
  nowMs: number,
  minGapMs: number = MIN_POLL_GAP_MS,
): boolean {
  return lastMs === null || nowMs - lastMs >= minGapMs;
}

/** Whole seconds until the next allowed ask, for a retry-after header. */
export function secondsUntilNextPoll(
  lastMs: number | null,
  nowMs: number,
  minGapMs: number = MIN_POLL_GAP_MS,
): number {
  if (lastMs === null) return 0;
  const remaining = minGapMs - (nowMs - lastMs);
  return remaining <= 0 ? 0 : Math.ceil(remaining / 1000);
}

/** What the rules need to know about this visitor and payment, as of `nowMs`. */
export function pollSnapshotFor(visitorKey: string, txid: string): number | null {
  return state.polls.get(keyFor(visitorKey, txid)) ?? null;
}

/**
 * Records that this visitor was answered.
 *
 * Called only when the wallet was really asked, so a request turned away by the
 * brake does not push its own waiting time further out.
 */
export function recordPoll(visitorKey: string, txid: string, nowMs: number): void {
  const key = keyFor(visitorKey, txid);
  // Re-inserting deletes first, which is what keeps the map in ask order, so
  // dropping the oldest entry really does drop the oldest.
  state.polls.delete(key);
  state.polls.set(key, nowMs);
  while (state.polls.size > MAX_TRACKED_POLLS) {
    const oldest = state.polls.keys().next();
    if (oldest.done) break;
    state.polls.delete(oldest.value);
  }
}

/** Clears the counters. Only for tests, so each one starts from a quiet arcade. */
export function resetPollsForTest(): void {
  state = { polls: new Map() };
}
