/**
 * The counters behind the rate limits (B4).
 *
 * They live in this process's memory, which is the right size for a demo that
 * runs as one server on one machine: no database, nothing to install, nothing
 * to migrate. Two honest limits, both acceptable for the event: the counters
 * reset if the server restarts, and two servers would each keep their own copy.
 *
 * Nothing here reads a clock for itself. Every function is told the time, so
 * the day rollover can be tested without waiting for midnight.
 */

import { dayKey, type LedgerSnapshot } from "./guardrails";

const HOUR_MS = 3_600_000;

type State = {
  lastSendAtMs: number | null;
  /** visitor key -> when their sends happened */
  visitors: Map<string, number[]>;
  /** which UTC day `sendsToday` counts */
  day: string;
  sendsToday: number;
};

// Module state on purpose. Next.js keeps one copy per server process, so every
// request sees the same counters. The day starts empty and is filled in on
// first use rather than at import time, because reading the clock while the
// app is being built is not allowed under Cache Components.
let state: State = { lastSendAtMs: null, visitors: new Map(), day: "", sendsToday: 0 };

function rollDayIfNeeded(nowMs: number): void {
  const today = dayKey(nowMs);
  if (state.day !== today) {
    state.day = today;
    state.sendsToday = 0;
  }
}

/** What the rules need to know about this visitor, as of `nowMs`. */
export function snapshotFor(visitorKey: string, nowMs: number): LedgerSnapshot {
  rollDayIfNeeded(nowMs);
  return {
    lastSendAtMs: state.lastSendAtMs,
    thisVisitorSendTimesMs: state.visitors.get(visitorKey) ?? [],
    sendsToday: state.sendsToday,
  };
}

/**
 * Counts a payment that really happened. Called only after the wallet has
 * broadcast it, so a refusal or a failure never uses up anybody's allowance.
 */
export function recordSend(visitorKey: string, nowMs: number): void {
  rollDayIfNeeded(nowMs);
  state.lastSendAtMs = nowMs;
  state.sendsToday += 1;

  const times = state.visitors.get(visitorKey) ?? [];
  times.push(nowMs);
  // Drop entries older than the hour, so a long event cannot grow this without
  // bound and so the per-visitor window stays cheap to check.
  const windowStart = nowMs - HOUR_MS;
  state.visitors.set(visitorKey, times.filter((t) => t >= windowStart));
}

/**
 * Gives back the allowance for a round that certainly did not move money, while
 * leaving the global pause in place.
 *
 * Used when the wallet refuses because the previous payment is still landing,
 * and when the wallet cannot be reached at all. In both cases the player should
 * not lose their share of the hour, or the arcade its daily allowance, for
 * something that never happened. The pause stays, because that is what stops
 * anyone retrying in a tight loop while the network catches up.
 *
 * Only call this when it is certain no payment left the wallet. A timeout is not
 * certain: the transaction may have been broadcast before the answer was lost.
 */
export function refundRoundKeepingPause(visitorKey: string, nowMs: number): void {
  state.sendsToday = Math.max(0, state.sendsToday - 1);
  const times = state.visitors.get(visitorKey);
  if (times) {
    const index = times.lastIndexOf(nowMs);
    if (index !== -1) times.splice(index, 1);
  }
}

/**
 * Works out who is asking.
 *
 * On a machine with no proxy in front, everyone is the host, so every visitor
 * shares one bucket. That is the strictest reading and it is the right default
 * for a local demo. Behind a platform that sets the forwarded header, each
 * visitor gets their own bucket.
 *
 * Known weakness, stated plainly: those headers are only trustworthy if a proxy
 * sets them. A caller who invents one gets a fresh per-visitor bucket. The two
 * limits that protect the money itself, the global pause and the daily cap,
 * cannot be dodged that way, so the worst case is one visitor taking more than
 * their share of an hour, not the pot being drained.
 */
export function visitorKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first && first.trim() !== "") return first.trim();
  }
  const real = request.headers.get("x-real-ip");
  if (real && real.trim() !== "") return real.trim();
  return "local";
}

/** Clears the counters. Only for tests, so each one starts from a quiet arcade. */
export function resetCountersForTest(): void {
  state = { lastSendAtMs: null, visitors: new Map(), day: "", sendsToday: 0 };
}
