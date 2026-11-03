/**
 * The rules that stop a player from steering the arcade's money (B4, D-025).
 *
 * Everything here is pure: no clock, no network, no memory of earlier calls.
 * The route handler hands these functions plain data and acts on the answer,
 * which is what makes the rules easy to test and hard to get wrong.
 *
 * The shape of the rule matters more than any single check. There is no field
 * anywhere in a request for an address, an amount, or a note, so there is
 * nothing for a caller to fill in. The choice is the only input, and the choice
 * only picks between two destinations that both belong to the arcade (D-030).
 *
 * Wording follows the Layer 4 voice rule (D-018): plain words, short
 * sentences, no em dashes, and something a grandparent could act on.
 */

/** The only two things a round can be. */
export const BRANCHES = ["hide", "open"] as const;
export type Branch = (typeof BRANCHES)[number];

/**
 * The only field a request may carry. Notice what is missing: there is no key
 * for an address, an amount, or a note.
 */
export const ALLOWED_BODY_KEYS = ["choice"] as const;

/** How often money may move. Kept structural so the constants can stay `as const`. */
export type Limits = {
  readonly minSecondsBetweenSends: number;
  readonly maxSendsPerIpPerHour: number;
  readonly maxSendsPerDayGlobal: number;
};

export type ParseOutcome =
  | { readonly ok: true; readonly branch: Branch }
  | { readonly ok: false; readonly problem: string };

const UNREADABLE = "We could not read that. Please use the buttons and try again.";

export function isBranch(value: string): value is Branch {
  return (BRANCHES as readonly string[]).includes(value);
}

/**
 * Reads a round request.
 *
 * Unexpected fields are refused rather than quietly dropped. A caller that
 * invents a field such as `to` or `zatoshis` is not the game, and ignoring the
 * attempt would hide it. Refusing makes the guardrail visible in the logs and
 * in the response.
 */
export function parseRoundRequest(raw: string): ParseOutcome {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, problem: UNREADABLE };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, problem: UNREADABLE };
  }

  const record = body as Record<string, unknown>;
  const allowed: readonly string[] = ALLOWED_BODY_KEYS;
  const invented = Object.keys(record).filter((key) => !allowed.includes(key));
  if (invented.length > 0) {
    return {
      ok: false,
      problem:
        "This game only needs your choice. It never asks for an address or an amount, and it will not accept one.",
    };
  }

  const choice = record.choice;
  if (typeof choice !== "string" || !isBranch(choice)) {
    return { ok: false, problem: 'Please choose "hide it" or "leave it open".' };
  }
  return { ok: true, branch: choice };
}

/** The four headers that say where a round request came from. Read by the route. */
export type SenderHeaders = {
  readonly contentType: string | null;
  readonly secFetchSite: string | null;
  readonly origin: string | null;
  readonly host: string | null;
};

export type SenderCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly problem: string };

const NOT_FROM_HERE =
  "That request did not come from this page. Please use the buttons and try again.";

/** The bare host inside an Origin header, or null when it cannot be read. */
function hostOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Who may ask for a round (D-137).
 *
 * The route takes one word and pays real money, so the question is not only
 * what a request says but where it came from. A page on somebody else's site
 * can post here from a visitor's browser. No cookie rides along, so nothing is
 * stolen, but the round still spends, and the day's budget is shared with real
 * players.
 *
 * Three checks, cheapest first:
 *
 *  1. The body must arrive as JSON. Plain text and form posts are the shapes a
 *     browser will send cross-origin without asking first, and asking first is
 *     what stops this: the question it asks has no answer here, so the round is
 *     never sent.
 *  2. `Sec-Fetch-Site` says who started the request, and no script on a page
 *     can set it. Only `same-origin`, this page, and `none`, meaning the
 *     visitor typed the address or used a bookmark, are let through.
 *     `same-site` is refused on purpose: the arcade lives on a rented domain
 *     that other people's sites share, so a neighbour's subdomain counts as
 *     same-site and is still not us.
 *  3. Where that header is missing, an older browser is assumed and the Origin
 *     host is compared with the host the request arrived on.
 *
 * A request with no Origin at all is let through, because that is what a
 * person typing the address sends, and also what the operator's own checks
 * send. This is not a substitute for the wallet's own locks (D-094): those
 * decide where money may go, and these decide who may ask.
 */
export function checkSender(headers: SenderHeaders): SenderCheck {
  const type = (headers.contentType ?? "").toLowerCase();
  if (!type.startsWith("application/json")) {
    return { ok: false, status: 415, problem: UNREADABLE };
  }

  const site = (headers.secFetchSite ?? "").toLowerCase();
  if (site.length > 0) {
    if (site === "same-origin" || site === "none") return { ok: true };
    return { ok: false, status: 403, problem: NOT_FROM_HERE };
  }

  const origin = headers.origin ?? "";
  if (origin.length === 0) return { ok: true };

  const from = hostOfOrigin(origin);
  const to = (headers.host ?? "").toLowerCase().split(":")[0];
  if (from === null || to.length === 0 || from !== to) {
    return { ok: false, status: 403, problem: NOT_FROM_HERE };
  }
  return { ok: true };
}

/** A read-only picture of the counters the store keeps. */
export type LedgerSnapshot = {
  /** When the last successful send finished, or null if there has not been one. */
  readonly lastSendAtMs: number | null;
  /** When this visitor's earlier sends happened. Any order, may be empty. */
  readonly thisVisitorSendTimesMs: readonly number[];
  /** How many sends the whole arcade has made today. */
  readonly sendsToday: number;
};

export type SendDecision =
  | { readonly allow: true }
  | { readonly allow: false; readonly problem: string; readonly retryAfterSeconds: number };

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Decides whether a round may move money right now, in order of cheapest to
 * check. Each refusal says what to do next, because a dead end with no
 * explanation is the least grandma-friendly thing a game can do.
 */
export function decideSend(
  snapshot: LedgerSnapshot,
  limits: Limits,
  nowMs: number,
): SendDecision {
  // 1. The global pause. The wallet builds one transaction at a time.
  if (snapshot.lastSendAtMs !== null) {
    const waitMs = limits.minSecondsBetweenSends * 1_000 - (nowMs - snapshot.lastSendAtMs);
    if (waitMs > 0) {
      const seconds = Math.ceil(waitMs / 1_000);
      return {
        allow: false,
        problem: `The wallet is still busy with the last payment. Please try again in ${seconds} ${
          seconds === 1 ? "second" : "seconds"
        }.`,
        retryAfterSeconds: seconds,
      };
    }
  }

  // 2. This visitor's share of the hour.
  const windowStart = nowMs - HOUR_MS;
  const inWindow = snapshot.thisVisitorSendTimesMs.filter((t) => t >= windowStart);
  if (inWindow.length >= limits.maxSendsPerIpPerHour) {
    // A slot frees up when the oldest of them passes out of the hour.
    const freesUpAtMs = Math.min(...inWindow) + HOUR_MS;
    return {
      allow: false,
      problem: "That is your share of rounds for this hour. Please come back a little later.",
      retryAfterSeconds: atLeastOneSecond(freesUpAtMs - nowMs),
    };
  }

  // 3. The treasury's seatbelt for the day.
  if (snapshot.sendsToday >= limits.maxSendsPerDayGlobal) {
    return {
      allow: false,
      problem:
        "The arcade has made all of today's practice payments. Please come back tomorrow.",
      retryAfterSeconds: secondsUntilUtcMidnight(nowMs),
    };
  }

  return { allow: true };
}

/** The UTC calendar day, used as the key for the daily counter. */
export function dayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(nowMs: number): number {
  const midnightMs = Date.parse(`${dayKey(nowMs)}T00:00:00.000Z`) + DAY_MS;
  return atLeastOneSecond(midnightMs - nowMs);
}

function atLeastOneSecond(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1_000));
}
