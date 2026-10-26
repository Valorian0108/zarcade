import { connection } from "next/server";

import type { Receipt } from "@/lib/merchant";
import {
  mayPoll,
  pollSnapshotFor,
  recordPoll,
  secondsUntilNextPoll,
} from "@/lib/zcash/poll-guard";
import { visitorKey } from "@/lib/zcash/rate-store";
import { readMerchantWindow, SidecarError } from "@/lib/zcash/sidecar";

/**
 * Cabinet four's window (SCOPE-CABINET-4.md 2.3): what the merchant's incoming
 * viewing key can see.
 *
 * Read-only, and there is nothing to aim. This route takes no parameters at
 * all: no address, no amount, no transaction id, no account. It asks the wallet
 * helper for the merchant's own incoming side and passes on what came back. A
 * caller cannot use it to look at somebody else's money, because the key behind
 * it cannot.
 *
 * Three things it must never do, and the reason each is safe here:
 *  - It cannot move money. The helper's one send door is a different route with
 *    three locks of its own (D-094), and this file has no path to it.
 *  - It cannot leak a key. The helper answers from notes the incoming viewing
 *    key decrypted, and its reply has no field for key material.
 *  - It cannot invent a receipt. An empty list is passed through as an empty
 *    list, which is how the cabinet says a payment has not landed yet.
 */

/**
 * How often one visitor may ask for the window.
 *
 * A fresh look walks any new blocks since the last one, which is real work on
 * the helper's side and real traffic to the public lightwalletd server. Ten
 * seconds is far shorter than the story, and nothing appears faster for asking
 * more often: a payment shows up when its block does, roughly every twenty five
 * seconds.
 */
const WINDOW_GAP_MS = 10_000;

/** The brake is per visitor and per thing watched; this is the thing. */
const GUARD_KEY = "merchant-window";

export async function GET(request: Request) {
  // The answer changes as blocks land, so it must be composed per real request
  // and never from a build-time guess (the rule the other live routes follow
  // under Cache Components).
  await connection();

  const visitor = visitorKey(request);
  const nowMs = Date.now();
  const last = pollSnapshotFor(visitor, GUARD_KEY);
  if (!mayPoll(last, nowMs, WINDOW_GAP_MS)) {
    const wait = Math.max(1, secondsUntilNextPoll(last, nowMs, WINDOW_GAP_MS));
    return Response.json(
      {
        ok: false,
        code: "too-soon",
        problem: "The window was just opened. A payment does not arrive sooner for asking again.",
        retryAfterSeconds: wait,
      },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  }

  try {
    const window = await readMerchantWindow();
    recordPoll(visitor, GUARD_KEY, nowMs);
    const receipts: Receipt[] = window.receipts.map((r) => ({
      txid: r.txid,
      outputIndex: r.outputIndex,
      zatoshis: r.zatoshis,
      memo: r.memo,
      block: r.block,
      blockTime: r.blockTime,
    }));
    return Response.json({
      ok: true,
      network: "testnet",
      window: {
        address: window.address,
        canSpend: window.canSpend,
        scannedTo: window.scannedTo,
        receipts,
      },
    });
  } catch (error) {
    recordPoll(visitor, GUARD_KEY, nowMs);
    if (error instanceof SidecarError) {
      // `warming` means the wallet is still opening, which is not a breakdown.
      // The cabinet says "in a moment" rather than showing an error.
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
    console.error("could not read the merchant's window:", error);
    return Response.json(
      { ok: false, problem: "The arcade could not reach the wallet to look." },
      { status: 502 },
    );
  }
}
