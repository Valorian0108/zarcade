/**
 * The Merchant's Window: cabinet four's rules, written down as plain data.
 *
 * This file does the same job for cabinet four that lib/unseen.ts does for
 * Unseen. The copy lives in one place so it can be read against the grandma
 * rule. The reading of chain data is pure, so it can be tested without a
 * wallet, a network or a browser. And the component is left doing only what a
 * component should: show the current state.
 *
 * One honesty rule runs through all of it, and it is the reason this file
 * exists separately from the screen. Every receipt here came out of a real
 * payment that the merchant account's incoming viewing key decrypted off the
 * chain. Nothing is modelled, nothing is filled in from the sender's side, and
 * when a payment has not landed the answer is "no receipt", never a placeholder
 * row. A cabinet that invented a receipt would teach exactly the wrong lesson:
 * that a private payment can be shown without being proven.
 *
 * Two things this file deliberately has no word for: who paid, and how much is
 * left. The first is not knowable from a receiving-side key. The second is not
 * knowable from this key at all, which is beat 6's whole point.
 */

import { formatTaz, shortenAddress } from "@/lib/zcash/format";

/**
 * The order reference the story's deposit carries.
 *
 * It is matched against the memo the payment really carried, so the cabinet
 * picks out the deposit by a fact on the chain rather than by position in a
 * list. If no receipt carries it, there is no deposit to show.
 */
export const DEPOSIT_MEMO = "INV-204";

/**
 * Stays on every row, lit or sealed (SCOPE-CABINET-4.md section 5, item 4).
 * A receiving-side key does not name the payer, and the screen must not hint
 * that it does.
 */
export const WHO_PAID_SEALED = "Who paid: still sealed";

/**
 * The explorer that indexes the canonical NU7 testnet (D-027). The one used
 * before it indexed an abandoned fork, so links from it would have been dead
 * ends for our own transactions.
 */
const EXPLORER_TX = "https://testnet.zecblock.com/tx/";

/** What a row on the board is allowed to carry. Note what is absent. */
export type Receipt = {
  txid: string;
  outputIndex: number;
  zatoshis: number;
  /** Null when the payment carried no message. Never guessed. */
  memo: string | null;
  block: number;
  /** Seconds since the Unix epoch, as the block itself reports. */
  blockTime: number;
};

/** The window as a whole: whose it is, what it can see, what it cannot do. */
export type WindowFacts = {
  /** The merchant's own receiving address. Public; a payer has to know it. */
  address: string;
  /** Always false. Stated rather than implied, because it is the lesson. */
  canSpend: boolean;
  /** The block the scan has read up to. */
  scannedTo: number;
  receipts: Receipt[];
};

export type ProofCheck = { name: string; passed: boolean; detail: string };

/** The verdict on one receipt, and the reasons behind it. */
export type Proof = {
  txid: string;
  outputIndex: number;
  zatoshis: number;
  memo: string | null;
  /** The block the scan recorded the receipt in. */
  claimedBlock: number;
  /** The block the network reports for it now, or null if it reports none. */
  networkBlock: number | null;
  /** The commitment the chain carries for this output. Public by design. */
  commitment: string;
  checks: ProofCheck[];
  verified: boolean;
};

/** A link to the transaction on an explorer that really indexes this chain. */
export function explorerUrl(txid: string): string {
  return `${EXPLORER_TX}${txid}`;
}

/**
 * The deposit the supplier is asking about, or null.
 *
 * Null is a real answer and the cabinet has to say it out loud: the payment has
 * not landed, so there is nothing to show and nothing to prove. The alternative,
 * picking the newest row and calling it the deposit, would put a false label on
 * somebody's money.
 */
export function depositReceipt(receipts: readonly Receipt[]): Receipt | null {
  return receipts.find((r) => r.memo === DEPOSIT_MEMO) ?? null;
}

/** The proof that belongs to one receipt, or null when there is none. */
export function proofFor(proofs: readonly Proof[], receipt: Receipt): Proof | null {
  return (
    proofs.find((p) => p.txid === receipt.txid && p.outputIndex === receipt.outputIndex) ?? null
  );
}

/** Money the way the explorer writes it, so the two can be compared by eye. */
export function amountInWords(zatoshis: number): string {
  return `${formatTaz(zatoshis)} TAZ`;
}

/** The address, shortened for the board. The full one stays in the markup. */
export function addressInWords(address: string): string {
  return shortenAddress(address);
}

/**
 * The message a payment carried, in words.
 *
 * A payment with no message says so. That is not a gap in our reading; the note
 * was empty on the chain, and pretending otherwise would be the smallest kind
 * of lie this cabinet could tell.
 */
export function memoInWords(memo: string | null): string {
  return memo === null ? "No message on this payment" : memo;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The block's own timestamp, in words.
 *
 * Taken from the block rather than from the moment somebody looked, so the row
 * reads the same today and next year. A zero means the chain gave no time, and
 * that is said instead of showing the 1970s.
 */
export function blockTimeInWords(blockTime: number): string {
  if (!Number.isFinite(blockTime) || blockTime <= 0) return "Time not recorded";
  const date = new Date(blockTime * 1000);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hours}:${minutes} UTC`;
}

/** Names of the checks that did not pass, so the screen can be specific. */
export function failedChecks(proof: Proof): string[] {
  return proof.checks.filter((c) => !c.passed).map((c) => c.name);
}

/**
 * Whether the cabinet is allowed to say this payment is proven.
 *
 * It does not trust the summary flag on its own. The verdict has to follow from
 * checks that are actually present and actually passed, so a truncated reply, a
 * stale flag or a new check added on the server cannot turn into a claim on
 * screen. This is the same rule the bridge applies when it reads the reply, and
 * repeating it here is deliberate: the screen is the last place a false verdict
 * could be stopped.
 */
export function proofHolds(proof: Proof): boolean {
  return proof.verified && proof.checks.length > 0 && proof.checks.every((c) => c.passed);
}

/**
 * What a proof means, in one plain sentence.
 *
 * Three cases, and the middle one matters most. A proof that passed says what
 * the chain vouches for. A proof that failed says the check did not complete and
 * claims nothing either way, because a verdict this cabinet cannot back with a
 * real check is worse than no verdict. And a proof nobody asked for says so.
 *
 * No red and no green live here. The words carry the result; colour never does
 * (SCOPE-CABINET-4.md section 5, item 9).
 */
export function proofInWords(proof: Proof | null): string {
  if (proof === null) return "Nothing has been checked yet.";
  if (proofHolds(proof)) {
    return `The chain carries this payment at block ${proof.claimedBlock}. The amount, the address and the message all went into the fingerprint the chain stores, and the fingerprint matches.`;
  }
  const failed = failedChecks(proof);
  if (failed.length > 0) {
    return `The check did not pass, so nothing is claimed either way. What failed: ${failed.join(", ")}.`;
  }
  return "The check did not complete, so nothing is claimed either way.";
}

/**
 * The line beat 6 answers with.
 *
 * The auditor asks how much money is left. The honest answer is that this key
 * cannot say: it sees money arriving, never money leaving, so a balance is
 * outside its scope. This is a real property of the key, not a dodge, and it is
 * the one question in the cabinet that has no number in it.
 */
export const BALANCE_ANSWER =
  "Not from this key alone. It shows money arriving at your account. Money leaving is a different secret, and this key does not hold it.";
