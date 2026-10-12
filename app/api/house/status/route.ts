import { connection } from "next/server";

import { FEE_HEADROOM_ZATOSHIS, ROUND_ZATOSHIS } from "@/lib/zcash/config";
import {
  readAddresses,
  readBalance,
  readHealth,
  SidecarError,
} from "@/lib/zcash/sidecar";

/**
 * Read-only view of the arcade's own wallet (B4).
 *
 * It cannot move money. Both addresses are public by design: they are on the
 * chain, anyone can look them up, and the game shows the open one to the player
 * so they can see exactly where a visible payment went. The balance is public
 * for the same reason. Nothing secret is reachable from here.
 *
 * It also answers while the arcade is refilling, which is the point of checking
 * that first: during a refill the wallet is held for minutes, and a status route
 * that blocks would show a player an error for a wallet that is only busy
 * (D-036). In that state it returns `refilling: true` and no balance figures,
 * because a number it cannot read honestly is worse than no number.
 */
export async function GET() {
  // The answer changes every block and the wallet helper only exists at run
  // time, so this must not be answered from a build-time guess. Under Cache
  // Components the way to say that is to wait for a real request.
  await connection();

  // Ask the cheap question first. During a refill the wallet mutex is held for
  // minutes, so `readBalance` below would block until its timeout and this route
  // would report a broken wallet that is only busy. `/health` does not need the
  // mutex at all (D-036), so it answers in about a millisecond and lets the
  // screen say the truth instead of stalling.
  //
  // If `/health` itself cannot be reached that says nothing about a refill, so it
  // falls through and lets the balance call below produce the accurate message.
  let refilling = false;
  try {
    refilling = (await readHealth()).refilling;
  } catch {
    // Deliberately empty.
  }

  if (refilling) {
    return Response.json({
      ok: true,
      refilling: true,
      // No balance figures, because none can be read honestly right now. Showing
      // a stale number would be worse than showing none, and the game has a
      // distinct state for this.
      readyForRound: false,
    });
  }

  try {
    const [status, addresses] = await Promise.all([readBalance(), readAddresses()]);
    return Response.json({
      ok: true,
      refilling: false,
      network: status.network,
      syncedTo: status.syncedTo,
      zatoshis: status.zatoshis,
      taz: status.taz,
      // The split is what the game actually needs. `zatoshis` is everything the
      // house owns; `spendableZatoshis` is what a round can be built from this
      // second. The difference is the money still landing, and showing both is
      // how the game can say "your payment is on its way" truthfully.
      spendableZatoshis: status.spendableZatoshis,
      pendingChangeZatoshis: status.pendingChangeZatoshis,
      transparentZatoshis: status.transparentZatoshis,
      // One answer to "can somebody play right now?", so the game can poll this
      // route while it waits instead of re-deriving the rule in two places.
      readyForRound:
        status.spendableZatoshis >= ROUND_ZATOSHIS + FEE_HEADROOM_ZATOSHIS,
      addresses,
    });
  } catch (error) {
    const problem =
      error instanceof SidecarError ? error.message : "The arcade's wallet did not answer.";
    console.error("house status failed:", error);
    // Fail closed: a clear "not available" rather than an empty or invented
    // number that a player might mistake for the truth.
    return Response.json({ ok: false, problem }, { status: 503 });
  }
}
