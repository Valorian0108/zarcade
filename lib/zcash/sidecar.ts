/**
 * The bridge to the house wallet helper (D-024, B4).
 *
 * Server code only. It talks to a small program on this same machine, at
 * 127.0.0.1:9070, which no browser could reach even if it tried. The secret key
 * never travels over this link: we hand over a destination and an amount, and
 * the helper does the signing itself. That is the whole reason the helper
 * exists (D-025).
 *
 * Every failure becomes a `SidecarError` carrying plain words, so the game can
 * say what went wrong instead of showing a stack trace. Nothing here invents a
 * success: if the payment did not happen, this throws.
 */

import {
  READ_TIMEOUT_MS,
  REFILLING_MESSAGE,
  SEND_TIMEOUT_MS,
  SIDECAR_SERVICE_TOKEN,
  SIDECAR_URL,
} from "./config";
import { formatTaz } from "./format";

/** Something went wrong between the app and the helper. `message` is safe to show a player. */
export class SidecarError extends Error {
  readonly status: number;
  /** The helper's raw JSON, kept so a caller can react to a specific `code`. */
  readonly body: Record<string, unknown> | null;

  constructor(status: number, message: string, body: Record<string, unknown> | null = null) {
    super(message);
    this.name = "SidecarError";
    this.status = status;
    this.body = body;
  }
}

/**
 * The wallet refused because the money from the last payment has not landed yet.
 *
 * This is not a failure and not a mistake, and it must never be shown as one.
 * The coins are real and on their way; the network simply has not agreed on the
 * block that contains them, and until it does the wallet has nothing confirmed
 * to spend (ZIP 315). Carries the real numbers so the game can say something
 * true instead of guessing.
 */
export class SettlingError extends Error {
  readonly spendableZatoshis: number;
  readonly pendingChangeZatoshis: number;

  constructor(spendableZatoshis: number, pendingChangeZatoshis: number) {
    super("The last payment has not landed yet.");
    this.name = "SettlingError";
    this.spendableZatoshis = spendableZatoshis;
    this.pendingChangeZatoshis = pendingChangeZatoshis;
  }
}

const DOWN =
  "The arcade's wallet is not running, so no payment can be made. Nothing has been sent.";

/**
 * The wallet is busy refilling its coins, so it cannot pay right now.
 *
 * Like `SettlingError` this is not a breakdown and must never be shown as one.
 * It happens only while a pot split is running, which is started by hand before
 * a session and takes about eight minutes (D-031). Giving it its own type is
 * what stops the game from telling a player the wallet is broken when the truth
 * is that it is doing planned maintenance.
 */
export class RefillingError extends Error {
  constructor(message: string = REFILLING_MESSAGE) {
    super(message);
    this.name = "RefillingError";
  }
}

type ErrorBody = { ok?: boolean; error?: string; code?: string };
type HealthBody = {
  ok?: boolean;
  network?: string;
  /** Null while the wallet is busy with a refill, which is not the same as unknown. */
  synced_to?: number | null;
  /** True only while a pot split is running. */
  refilling?: boolean;
};
type AddressBody = { ok?: boolean; address?: string };
type BalanceBody = {
  ok?: boolean;
  zatoshis?: number;
  zec?: string;
  spendable_zatoshis?: number;
  pending_change_zatoshis?: number;
  transparent_zatoshis?: number;
  synced_to?: number;
};
type SendBody = { ok?: boolean; txid?: string; explorer?: string };
type TxStatusBody = {
  ok?: boolean;
  txid?: string;
  landed?: boolean;
  mined_height?: number | null;
  confirmations?: number;
  explorer?: string;
};
type HistoryBody = {
  ok?: boolean;
  entries?: Array<{
    txid?: string;
    kind?: string;
    zatoshis?: number;
    block?: number | null;
    url?: string;
  }>;
};

export type HouseStatus = {
  network: string;
  syncedTo: number;
  /** Everything the house owns, including money that is still landing. */
  zatoshis: number;
  taz: string;
  /** What a round can actually be built from right now. */
  spendableZatoshis: number;
  /** Change from the house's own last payment, waiting to be mined. */
  pendingChangeZatoshis: number;
  /** Open coins, which pile up on the house's visible address as a record. */
  transparentZatoshis: number;
};

export type HouseAddresses = {
  /** Where test coins are deposited, and where a hidden round pays to. */
  deposit: string;
  /** The arcade's own open address, where an open round pays to (D-030). */
  transparent: string;
};

export type SentPayment = { txid: string; explorerUrl: string };

/** How far a payment has got along the chain, in facts rather than guesses. */
export type PaymentProgress = {
  txid: string;
  /** True once the network has put this payment into a block. */
  landed: boolean;
  /** The block it landed in, or null while it is still on its way. */
  block: number | null;
  /** Blocks built on top of it, counting its own block as the first. */
  confirmations: number;
  explorerUrl: string;
};

async function call<T>(
  path: string,
  init: RequestInit | undefined,
  timeoutMs: number,
  what: string,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${SIDECAR_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        // D-094: the send door's second lock. The sidecar checks this header
        // on /send when ZARCADE_SEND_TOKEN is armed. Carrying it on every
        // call keeps the bridge one shape and costs nothing elsewhere.
        ...(SIDECAR_SERVICE_TOKEN ? { "x-zarcade-service": SIDECAR_SERVICE_TOKEN } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    // Refused, timed out, or the helper is not running. All the same to a player.
    throw new SidecarError(503, DOWN);
  }

  const text = await response.text();
  let body: T | ErrorBody | null;
  try {
    body = text === "" ? null : (JSON.parse(text) as T | ErrorBody);
  } catch {
    throw new SidecarError(502, `The wallet answered, but not in a form we could read (${what}).`);
  }

  if (!response.ok || body === null || (body as { ok?: boolean }).ok === false) {
    // The helper's own explanation is technical, so it goes to the server log
    // and the player gets a sentence they can act on. The raw body travels with
    // the error so a caller can react to a specific `code`.
    const detail = (body as ErrorBody | null)?.error;
    if (detail) console.error(`sidecar ${what} failed: ${detail}`);
    const record =
      body !== null && typeof body === "object" ? (body as Record<string, unknown>) : null;
    throw new SidecarError(
      response.ok ? 502 : response.status,
      `The wallet could not ${what}.`,
      record,
    );
  }

  return body as T;
}

/**
 * Is the helper alive, how far has it read the chain, and is it mid-refill.
 *
 * The one sidecar call that stays fast during a pot split, because the sidecar
 * answers it without touching the wallet. `syncedTo` is null in that window,
 * which means "busy", not "unknown chain".
 */
export async function readHealth(): Promise<{
  network: string;
  syncedTo: number | null;
  refilling: boolean;
}> {
  const body = await call<HealthBody>("/health", undefined, READ_TIMEOUT_MS, "be reached");
  return {
    network: body.network ?? "unknown",
    syncedTo: body.synced_to ?? null,
    refilling: body.refilling === true,
  };
}

/** The pot, after the wallet catches up with the chain. Takes a few seconds. */
export async function readBalance(): Promise<HouseStatus> {
  const body = await call<BalanceBody>(
    "/balance",
    undefined,
    READ_TIMEOUT_MS * 6,
    "report the balance",
  );
  const zatoshis = body.zatoshis ?? 0;
  return {
    network: "testnet",
    syncedTo: body.synced_to ?? 0,
    zatoshis,
    // Formatted here rather than taken from the wallet's string, so there is
    // exactly one place that decides how money is written for a player.
    taz: formatTaz(zatoshis),
    spendableZatoshis: body.spendable_zatoshis ?? 0,
    pendingChangeZatoshis: body.pending_change_zatoshis ?? 0,
    transparentZatoshis: body.transparent_zatoshis ?? 0,
  };
}

/** Reads a number out of an untyped JSON body without trusting it. */
function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Both of the arcade's addresses. Neither is a secret; both are public on the chain. */
export async function readAddresses(): Promise<HouseAddresses> {
  const [deposit, transparent] = await Promise.all([
    call<AddressBody>("/address", undefined, READ_TIMEOUT_MS, "give the deposit address"),
    call<AddressBody>(
      "/transparent-address",
      undefined,
      READ_TIMEOUT_MS,
      "give the open address",
    ),
  ]);
  if (!deposit.address) throw new SidecarError(502, "The wallet has no deposit address yet.");
  if (!transparent.address) throw new SidecarError(502, "The wallet has no open address yet.");
  return { deposit: deposit.address, transparent: transparent.address };
}

/**
 * The one function that can move money, and it takes no choices from a caller
 * about where the money goes beyond the address handed to it. The route handler
 * is responsible for only ever passing an address the arcade owns (D-030).
 *
 * Slow by nature: the wallet syncs, then builds a real zero-knowledge proof.
 *
 * Throws `SettlingError` when the house owns the money but cannot spend it yet,
 * which is a normal part of the rhythm rather than a breakdown, and any other
 * failure as `SidecarError`.
 */
export async function sendPayment(
  to: string,
  zatoshis: number,
  memo?: string,
): Promise<SentPayment> {
  let body: SendBody;
  try {
    body = await call<SendBody>(
      "/send",
      { method: "POST", body: JSON.stringify({ to, zatoshis, memo }) },
      SEND_TIMEOUT_MS,
      "make the payment",
    );
  } catch (error) {
    if (
      error instanceof SidecarError &&
      error.status === 409 &&
      error.body?.code === "settling"
    ) {
      throw new SettlingError(
        asNumber(error.body.spendable_zatoshis),
        asNumber(error.body.pending_change_zatoshis),
      );
    }
    // The sidecar refuses a round instantly while a refill is running, before it
    // touches the wallet at all. Its own wording already follows the grandma
    // rule, so pass it through rather than substituting a vaguer sentence.
    if (
      error instanceof SidecarError &&
      error.status === 503 &&
      error.body?.code === "refilling"
    ) {
      const said = error.body.error;
      throw new RefillingError(
        typeof said === "string" && said !== "" ? said : REFILLING_MESSAGE,
      );
    }
    throw error;
  }
  if (!body.txid || !body.explorer) {
    throw new SidecarError(502, "The wallet said it paid, but gave no receipt.");
  }
  return { txid: body.txid, explorerUrl: body.explorer };
}

/**
 * Where a payment has got to on the chain.
 *
 * This is what makes the "your payment is landing" moment a fact instead of an
 * animation (D-031, option C). The block number comes from the network, so the
 * game can show the real block the payment landed in and never has to fake a
 * countdown.
 *
 * Safe to ask over and over. Once the payment has landed the wallet answers from
 * its own records without going back to the network, so a player watching their
 * payment settle cannot slow down the next player's round. While it is still on
 * the way the answer can take a few seconds, and it waits its turn behind any
 * round already being built, which is why the timeout is a generous one.
 */
export async function readPaymentProgress(txid: string): Promise<PaymentProgress> {
  const body = await call<TxStatusBody>(
    `/tx-status?txid=${encodeURIComponent(txid)}`,
    undefined,
    READ_TIMEOUT_MS * 6,
    "say where the payment landed",
  );
  if (!body.explorer) {
    throw new SidecarError(502, "The wallet found the payment but gave no way to see it.");
  }
  const mined = body.mined_height;
  return {
    txid: body.txid ?? txid,
    landed: body.landed === true && typeof mined === "number",
    block: typeof mined === "number" ? mined : null,
    confirmations: asNumber(body.confirmations),
    explorerUrl: body.explorer,
  };
}

/** One payment from the wallet's ledger, in facts the chain shows anyone. */
export type LedgerRow = {
  txid: string;
  kind: "shielded" | "open";
  zatoshis: number;
  /** Null until the network has mined it. */
  block: number | null;
};

/**
 * The payments the house wallet really broadcast, newest first (D-093).
 * Read-only: this is the supply for The Crowd's record book, and it never
 * asks the wallet to move money. Malformed entries are dropped rather than
 * trusted, and any failure simply means the book falls back to its curated
 * rows, so the game never breaks because the wallet is busy or waking up.
 */
export async function readSendHistory(limit = 8): Promise<LedgerRow[]> {
  const body = await call<HistoryBody>(
    `/history?limit=${limit}`,
    undefined,
    READ_TIMEOUT_MS * 3,
    "list the payments it made",
  );
  const rows: LedgerRow[] = [];
  for (const entry of body.entries ?? []) {
    if (typeof entry.txid !== "string" || entry.txid.length !== 64) continue;
    if (entry.kind !== "shielded" && entry.kind !== "open") continue;
    rows.push({
      txid: entry.txid,
      kind: entry.kind,
      zatoshis:
        typeof entry.zatoshis === "number" && Number.isFinite(entry.zatoshis) ? entry.zatoshis : 0,
      block: typeof entry.block === "number" && Number.isFinite(entry.block) ? entry.block : null,
    });
  }
  return rows;
}
