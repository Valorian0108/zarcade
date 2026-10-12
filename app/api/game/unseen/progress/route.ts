import { connection } from "next/server";

import {
  mayPoll,
  pollSnapshotFor,
  recordPoll,
  secondsUntilNextPoll,
} from "@/lib/zcash/poll-guard";
import { visitorKey } from "@/lib/zcash/rate-store";
import { readPaymentProgress, SidecarError } from "@/lib/zcash/sidecar";

/**
 * Where one payment has got to on the chain (B5).
 *
 * This is what turns "your payment is landing" from an animation into a fact. The
 * block number in it came from the network, so the screen can show the real block
 * and never has to count down to a guess (D-031).
 *
 * Read-only. It cannot move money and it cannot be pointed at anything except a
 * payment the house itself made, because the wallet refuses a transaction id it
 * has no record of. That refusal is what makes this safe to expose: the worst a
 * caller can do is ask again about our own payments.
 */
const TXID_SHAPE = /^[0-9a-f]{64}$/i;

export async function GET(request: Request) {
  // The answer changes every block, so it must not come from a build-time guess.
  await connection();

  const txid = new URL(request.url).searchParams.get("txid") ?? "";
  if (!TXID_SHAPE.test(txid)) {
    return Response.json(
      { ok: false, problem: "That is not a transaction id this screen can look up." },
      { status: 400 },
    );
  }

  // Ask the wallet no more often than is useful. A block takes about twenty five
  // seconds, so asking every few seconds already catches it the moment it lands.
  const visitor = visitorKey(request);
  const nowMs = Date.now();
  const last = pollSnapshotFor(visitor, txid);
  if (!mayPoll(last, nowMs)) {
    const wait = Math.max(1, secondsUntilNextPoll(last, nowMs));
    return Response.json(
      {
        ok: false,
        code: "too-soon",
        problem: "Asked about this payment too recently. The block will not arrive sooner.",
        retryAfterSeconds: wait,
      },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  try {
    const progress = await readPaymentProgress(txid);
    recordPoll(visitor, txid, nowMs);
    return Response.json({
      ok: true,
      txid: progress.txid,
      landed: progress.landed,
      block: progress.block,
      confirmations: progress.confirmations,
      explorerUrl: progress.explorerUrl,
    });
  } catch (error) {
    recordPoll(visitor, txid, nowMs);
    if (error instanceof SidecarError) {
      return Response.json({ ok: false, problem: error.message }, { status: error.status });
    }
    console.error("could not read where a payment landed:", error);
    return Response.json(
      { ok: false, problem: "The arcade could not reach the wallet to ask." },
      { status: 502 },
    );
  }
}
