import { connection, NextResponse } from "next/server";

import { buildBook, CROWD_RECORDS } from "@/lib/crowd";
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
  try {
    const book = buildBook(await readSendHistory(8));
    return NextResponse.json({ ok: true, book });
  } catch {
    // Wallet waking up or unreachable: answer with the curated book instead
    // of an error, because the game must never break over a busy wallet.
    return NextResponse.json({ ok: true, book: CROWD_RECORDS });
  }
}
