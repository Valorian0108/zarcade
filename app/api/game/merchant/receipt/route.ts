import { connection } from "next/server";

import type { Proof } from "@/lib/merchant";
import { proofHolds } from "@/lib/merchant";
import {
  mayPoll,
  pollSnapshotFor,
  recordPoll,
  secondsUntilNextPoll,
} from "@/lib/zcash/poll-guard";
import { visitorKey } from "@/lib/zcash/rate-store";
import { readMerchantWindow, SidecarError, verifyReceipt } from "@/lib/zcash/sidecar";

/**
 * Cabinet four's proof of one payment (SCOPE-CABINET-4.md 2.4): the "hand over
 * one sealed note" path, and the only place in the arcade where a private
 * payment is demonstrated rather than described.
 *
 * Read-only like the window, and just as hard to aim. This route takes no
 * parameters either. It reads the merchant's own incoming side, then asks the
 * wallet helper to prove each receipt against the chain, and passes on the
 * verdicts. The helper refuses to prove a transaction its incoming-only scan
 * never decrypted for the merchant's address, so there is no way to reach
 * somebody else's payment through here even by guessing.
 *
 * What comes back is the verdict and public facts: the transaction id, the
 * block, the amount, the message, the fingerprint the chain stores, and the
 * list of checks with their reasons. The note's own randomness, which is what
 * makes the check possible, never leaves the helper. Two of the checks exist
 * only to prove that, and they are passed through here like the rest.
 *
 * A failed proof is returned, not hidden. If a check does not pass, the cabinet
 * says the check did not complete and claims nothing, which is the whole reason
 * the verdict is computed by the machine instead of written by the copy.
 */

/**
 * How often one visitor may ask for the proofs.
 *
 * Each proof makes the helper fetch a whole transaction and decrypt a note, so
 * this is the heavier of the two read routes and gets the longer brake. Twenty
 * seconds is still far shorter than the story beat that leads here, and a proof
 * of a mined payment does not change while a player watches it.
 */
const PROOF_GAP_MS = 20_000;

/** The brake is per visitor and per thing watched; this is the thing. */
const GUARD_KEY = "merchant-receipt";

export async function GET(request: Request) {
  await connection();

  const visitor = visitorKey(request);
  const nowMs = Date.now();
  const last = pollSnapshotFor(visitor, GUARD_KEY);
  if (!mayPoll(last, nowMs, PROOF_GAP_MS)) {
    const wait = Math.max(1, secondsUntilNextPoll(last, nowMs, PROOF_GAP_MS));
    return Response.json(
      {
        ok: false,
        code: "too-soon",
        problem: "The receipts were just checked. A mined payment does not change that fast.",
        retryAfterSeconds: wait,
      },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  try {
    const window = await readMerchantWindow();
    // One proof at a time. The helper holds a single lock on the wallet, so
    // asking in parallel would only queue the same work and make the first
    // answer slower. The row count is bounded by payments we sent ourselves.
    const proofs: Proof[] = [];
    for (const row of window.receipts) {
      const proof = await verifyReceipt(row.txid, row.outputIndex);
      proofs.push({
        txid: proof.txid,
        outputIndex: proof.outputIndex,
        zatoshis: proof.zatoshis,
        memo: proof.memo,
        claimedBlock: proof.claimedBlock,
        networkBlock: proof.networkBlock,
        commitment: proof.commitment,
        checks: proof.checks.map((c) => ({ name: c.name, passed: c.passed, detail: c.detail })),
        verified: proof.verified,
      });
    }
    recordPoll(visitor, GUARD_KEY, nowMs);
    return Response.json({
      ok: true,
      network: "testnet",
      // An empty list is the honest answer when nothing has landed yet. The
      // cabinet says so instead of showing a verdict it does not have.
      proofs,
      proved: proofs.length,
      // The summary flag uses the same strict rule the screen does: a proof
      // counts only when every check is present and passed, never on the bare
      // `verified` field alone. proofHolds is the single place that decides.
      allVerified: proofs.length > 0 && proofs.every(proofHolds),
    });
  } catch (error) {
    recordPoll(visitor, GUARD_KEY, nowMs);
    if (error instanceof SidecarError) {
      const code = error.body?.code;
      return Response.json(
        {
          ok: false,
          ...(typeof code === "string" ? { code } : {}),
          problem: error.message,
        },
        { status: error.status },
      );
    }
    console.error("could not prove a merchant receipt:", error);
    return Response.json(
      { ok: false, problem: "The arcade could not check the payment against the chain." },
      { status: 502 },
    );
  }
}
