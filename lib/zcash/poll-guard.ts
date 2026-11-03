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
 * Two brakes live here, and they answer different questions. The per-visitor gap
 * asks whether this player is asking too often. The whole-arcade count at the
 * bottom asks whether the wallet is being asked too often in total, which no
 * per-visitor rule can see, because the key those rules use is a header a caller
 * can write (D-138).
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
  globalState = { readsMs: [] };
}

/**
 * The whole arcade's brake on reads (D-138).
 *
 * The gaps above are per visitor, and they work: one player watching a payment
 * cannot ask more often than the block changes. They say nothing about a lot of
 * players at once, and nothing at all about one caller who invents a fresh
 * visitor key per request, which the header those gaps are keyed on lets them
 * do.
 *
 * Every read below ends at the wallet's one lock, and the caller waiting hardest
 * on that lock is the player whose payment is being built. So the arcade as a
 * whole is allowed this many reads a minute. Over that, a read is refused in the
 * same shape as a per-visitor refusal: a plain sentence and a retry-after.
 *
 * Nothing is hidden by waiting. A balance, a block number and a record book are
 * all still true a few seconds later, and the routes that have an honest
 * fallback answer with it instead of refusing.
 */
export const MAX_GLOBAL_READS_PER_MINUTE = 600;
export const GLOBAL_READ_WINDOW_MS = 60_000;

/** The words every braked read uses, so five routes cannot drift apart. */
export const GLOBAL_BUSY_MESSAGE =
  "The arcade is answering a lot of questions about its wallet right now. Please try again in a few seconds.";

type GlobalState = { readsMs: number[] };

let globalState: GlobalState = { readsMs: [] };

/** Drops the asks that have fallen out of the window and returns the rest. */
function readsInsideWindow(nowMs: number): number[] {
  const start = nowMs - GLOBAL_READ_WINDOW_MS;
  globalState.readsMs = globalState.readsMs.filter((t) => t >= start);
  return globalState.readsMs;
}

/**
 * May the arcade answer one more read right now? Null when it may, or the whole
 * seconds a caller should be told to wait.
 */
export function globalReadBrake(nowMs: number): number | null {
  const reads = readsInsideWindow(nowMs);
  if (reads.length < MAX_GLOBAL_READS_PER_MINUTE) return null;
  // The window frees a slot when its oldest ask falls out of it.
  const freesUpAtMs = reads[0] + GLOBAL_READ_WINDOW_MS;
  return Math.max(1, Math.ceil((freesUpAtMs - nowMs) / 1000));
}

/**
 * Counts a read that is about to reach the wallet. Called after the brake has
 * let it through, so a refused read never pushes the next one further away.
 */
export function recordGlobalRead(nowMs: number): void {
  globalState.readsMs.push(nowMs);
}

/**
 * The refusal itself, in one place. The `too-soon` code is the one the machines
 * already treat as "keep waiting quietly", so a braked poll never reaches the
 * player as an error.
 */
export function globalBusyResponse(retryAfterSeconds: number): Response {
  return Response.json(
    {
      ok: false,
      code: "too-soon",
      problem: GLOBAL_BUSY_MESSAGE,
      retryAfterSeconds,
    },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );
}
