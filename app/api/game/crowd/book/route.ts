import { connection, NextResponse } from "next/server";

import { buildBook, CROWD_RECORDS } from "@/lib/crowd";
import { globalReadBrake, recordGlobalRead } from "@/lib/zcash/poll-guard";
import { readSendHistory } from "@/lib/zcash/sidecar";

/**
 * The Crowd's live book supply (D-093).
 *
 * Read-only. It asks the house wallet which payments it really broadcast and
 * composes the freshest honest rows it can; the curated rows in lib/crowd.ts
 * are the fallback when the ledger is thin or the wallet is unreachable, so
 * this route always answers with a playable book. It never moves money, and
 * it exposes nothing the chain does not already show: txids, kinds, the
 * fixed round amount, and mined blocks.
 */
export async function GET() {
  // The book changes as rounds are played, so it must be composed per real
  // request, never from a build-time guess (the same rule the house status
  // route follows under Cache Components).
  await connection();

  // The whole-arcade brake (D-138). This route has an honest fallback, so a
  // braked read answers with the curated book instead of refusing: those rows
  // are real transactions too, and the game must never break over a wallet
  // that is busy.
  const nowMs = Date.now();
  if (globalReadBrake(nowMs) !== null) {
    return NextResponse.json({ ok: true, book: CROWD_RECORDS });
  }
  recordGlobalRead(nowMs);

  try {
    const book = buildBook(await readSendHistory(8));
    return NextResponse.json({ ok: true, book });
  } catch {
    // Wallet waking up or unreachable: answer with the curated book instead
    // of an error, because the game must never break over a busy wallet.
    return NextResponse.json({ ok: true, book: CROWD_RECORDS });
  }
}
