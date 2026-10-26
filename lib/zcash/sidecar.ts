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

/**
 * Cabinet four's window (SCOPE-CABINET-4.md 2.2 and 2.3).
 *
 * Read-only, and read-only all the way down. The wallet helper answers this
 * from notes the merchant account's incoming viewing key decrypted, so the
 * reply cannot contain a spending key, a full viewing key, a balance or a
 * sender: the key that produced it does not know those things.
 *
 * Notice what is NOT here. There is no parameter for an address, an amount or
 * an account, so there is nothing for a caller to aim. The window shows the
 * merchant's own incoming side or it shows nothing.
 */
type MerchantRowBody = {
  txid?: string;
  pool?: string;
  output_index?: number;
  zatoshis?: number;
  address?: string;
  memo?: string | null;
  block?: number;
  block_time?: number;
};

type MerchantBody = {
  ok?: boolean;
  network?: string;
  merchant?: {
    address?: string;
    /** A label naming which key was used, never the key itself. */
    key_used?: string;
    can_spend?: boolean;
    scanned_from?: number;
    scanned_to?: number;
    blocks_scanned?: number;
    rows?: MerchantRowBody[];
  };
};

/** One payment the merchant received, exactly as the incoming-only scan read it. */
export type MerchantReceipt = {
  txid: string;
  pool: string;
  outputIndex: number;
  zatoshis: number;
  /** Null when the payment carried no text note. Never guessed. */
  memo: string | null;
  block: number;
  blockTime: number;
};

export type MerchantWindow = {
  /** The merchant's own receiving address. Public: a payer has to know it. */
  address: string;
  /** Always false, and said out loud rather than implied. Reading is not spending. */
  canSpend: boolean;
  /** The block the scan has read up to, so the screen can say how fresh it is. */
  scannedTo: number;
  receipts: MerchantReceipt[];
};

const TXID_SHAPE = /^[0-9a-f]{64}$/i;

/**
 * The merchant's incoming side, as the chain currently shows it.
 *
 * Slow the first time after a restart, because the helper walks blocks from the
 * account's birthday to the chain tip; after that it only reads new blocks.
 * Malformed rows are dropped rather than trusted, and an empty list is a real
 * answer: it means no payment has landed yet, which the cabinet says plainly
 * instead of inventing a receipt.
 */
export async function readMerchantWindow(): Promise<MerchantWindow> {
  const body = await call<MerchantBody>(
    "/merchant",
    undefined,
    READ_TIMEOUT_MS * 6,
    "read the merchant's incoming payments",
  );
  const scan = body.merchant;
  if (!scan || typeof scan.address !== "string" || scan.address === "") {
    throw new SidecarError(502, "The wallet has no merchant account to look through yet.");
  }
  const receipts: MerchantReceipt[] = [];
  for (const row of scan.rows ?? []) {
    if (typeof row.txid !== "string" || !TXID_SHAPE.test(row.txid)) continue;
    if (!Number.isFinite(row.zatoshis) || !Number.isFinite(row.block)) continue;
    receipts.push({
      txid: row.txid,
      pool: typeof row.pool === "string" ? row.pool : "ironwood",
      outputIndex: Number.isFinite(row.output_index) ? (row.output_index as number) : 0,
      zatoshis: row.zatoshis as number,
      memo: typeof row.memo === "string" && row.memo !== "" ? row.memo : null,
      block: row.block as number,
      blockTime: Number.isFinite(row.block_time) ? (row.block_time as number) : 0,
    });
  }
  return {
    address: scan.address,
    // Anything other than an explicit false would be a claim the key cannot keep.
    canSpend: scan.can_spend === true,
    scannedTo: Number.isFinite(scan.scanned_to) ? (scan.scanned_to as number) : 0,
    receipts,
  };
}

/**
 * The result of proving one of those receipts against the chain
 * (SCOPE-CABINET-4.md 2.4).
 *
 * This is the payload the shipped cabinet is allowed to see. It carries the
 * verdict and facts that are already public or already the merchant's own to
 * show. It has no field for the note's randomness, diversifier or recipient
 * bytes, and the helper checks that before it answers: two of the five checks
 * exist only to prove the plaintext stayed behind.
 */
type VerifyBody = {
  ok?: boolean;
  verification?: {
    txid?: string;
    pool?: string;
    output_index?: number;
    zatoshis?: number;
    memo?: string | null;
    claimed_height?: number;
    network_height?: number | null;
    onchain_commitment?: string;
    checks?: Array<{ name?: string; passed?: boolean; detail?: string }>;
    verified?: boolean;
  };
};

export type ReceiptCheck = { name: string; passed: boolean; detail: string };

export type ReceiptProof = {
  txid: string;
  outputIndex: number;
  zatoshis: number;
  memo: string | null;
  /** The block the scan recorded the receipt in. */
  claimedBlock: number;
  /** The block the network reports right now, or null if it reports none. */
  networkBlock: number | null;
  /** The commitment the chain carries for this output. Public by design. */
  commitment: string;
  checks: ReceiptCheck[];
  verified: boolean;
};

/**
 * Proves one receipt the merchant's window already holds.
 *
 * The two arguments are not a caller's free choice: the sidecar refuses any
 * transaction its incoming-only scan did not decrypt for the merchant's own
 * address, so this cannot be aimed at somebody else's payment. Both values come
 * from a row this bridge already read.
 *
 * A `verified: false` answer is passed through, not thrown. Whether a proof
 * failed is itself the fact the cabinet has to report honestly.
 */
export async function verifyReceipt(txid: string, outputIndex: number): Promise<ReceiptProof> {
  const body = await call<VerifyBody>(
    `/merchant/verify?txid=${encodeURIComponent(txid)}&output=${encodeURIComponent(String(outputIndex))}`,
    undefined,
    READ_TIMEOUT_MS * 6,
    "prove the receipt against the chain",
  );
  const v = body.verification;
  if (!v || typeof v.txid !== "string") {
    throw new SidecarError(502, "The wallet answered the proof request with nothing readable.");
  }
  const checks: ReceiptCheck[] = [];
  for (const check of v.checks ?? []) {
    if (typeof check.name !== "string") continue;
    checks.push({
      name: check.name,
      passed: check.passed === true,
      detail: typeof check.detail === "string" ? check.detail : "",
    });
  }
  return {
    txid: v.txid,
    outputIndex: Number.isFinite(v.output_index) ? (v.output_index as number) : outputIndex,
    zatoshis: Number.isFinite(v.zatoshis) ? (v.zatoshis as number) : 0,
    memo: typeof v.memo === "string" && v.memo !== "" ? v.memo : null,
    claimedBlock: Number.isFinite(v.claimed_height) ? (v.claimed_height as number) : 0,
    networkBlock:
      typeof v.network_height === "number" && Number.isFinite(v.network_height)
        ? v.network_height
        : null,
    commitment: typeof v.onchain_commitment === "string" ? v.onchain_commitment : "",
    checks,
    // Only true when the wallet said so AND every individual check passed, so a
    // future check added server-side cannot be skipped by a stale summary flag.
    verified: v.verified === true && checks.length > 0 && checks.every((c) => c.passed),
  };
}
