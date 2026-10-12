import { connection } from "next/server";

import {
  EXPECTED_REFILL_SECONDS,
  EXPECTED_SETTLE_SECONDS,
  HIDDEN_ROUND_MEMO,
  LIMITS,
  REFILLING_MESSAGE,
  ROUND_ZATOSHIS,
} from "@/lib/zcash/config";
import { formatTaz } from "@/lib/zcash/format";
import { decideSend, parseRoundRequest, type Branch } from "@/lib/zcash/guardrails";
import {
  recordSend,
  refundRoundKeepingPause,
  snapshotFor,
  visitorKey,
} from "@/lib/zcash/rate-store";
import {
  readAddresses,
  readHealth,
  RefillingError,
  sendPayment,
  SettlingError,
  SidecarError,
} from "@/lib/zcash/sidecar";

/**
 * The only route in the arcade that can move money (B4).
 *
 * A caller sends one word. That word picks between two destinations that both
 * belong to the arcade, and the amount is a constant defined on the server.
 * There is no field for an address, no field for an amount, and no field for a
 * note, so there is no way to ask for one (D-025, D-030).
 *
 * The payment is real: it is signed by the house wallet, broadcast to the
 * Zcash testnet, and mined into a block. That is why the limits below exist.
 */
export async function POST(request: Request) {
  // Never answered from a build-time guess: this touches a live wallet.
  await connection();

  // 1. Read the one allowed field. Refuses anything else outright.
  const parsed = parseRoundRequest(await request.text());
  if (!parsed.ok) {
    return Response.json({ ok: false, problem: parsed.problem }, { status: 400 });
  }

  // 1b. Is the arcade mid-refill?
  //
  //     This has to come before the wallet is touched at all, because `/health`
  //     is the only sidecar call that answers instantly during a split (D-036).
  //     Every other call needs the wallet mutex, which a refill holds for about
  //     eight minutes. Left to itself, `readAddresses` in step 4 would block, hit
  //     its 20-second timeout, and the player would be told the wallet could not
  //     be reached, when the truth is that it is busy doing planned maintenance
  //     and nothing is wrong.
  //
  //     It sits before the rate-limit check rather than after it, which looks
  //     wrong but is not: that check and the booking in step 3 must run with
  //     nothing awaited between them, or two requests arriving together could
  //     both pass. So this await has to live outside that pair.
  //
  //     Nothing is booked here, so there is nothing to refund. And a health check
  //     that fails says nothing about whether a refill is running, so it falls
  //     through and lets the real work below produce the accurate message rather
  //     than inventing one here.
  try {
    if ((await readHealth()).refilling) {
      return Response.json(
        {
          ok: false,
          code: "refilling",
          problem: REFILLING_MESSAGE,
          retryAfterSeconds: EXPECTED_REFILL_SECONDS,
        },
        {
          status: 503,
          headers: { "retry-after": String(EXPECTED_REFILL_SECONDS) },
        },
      );
    }
  } catch {
    // Fall through on purpose.
  }

  // 2. Is a round allowed right now?
  const visitor = visitorKey(request);
  const nowMs = Date.now();
  const decision = decideSend(snapshotFor(visitor, nowMs), LIMITS, nowMs);
  if (!decision.allow) {
    return Response.json(
      {
        ok: false,
        // "limited" rather than no code at all, so the screen can tell a wait from
        // a breakdown. Like settling and refilling this is not an error: nothing
        // was paid, the round is still theirs, and a slot frees up on its own.
        // Painting it red would tell the player something had gone wrong.
        code: "limited",
        problem: decision.problem,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { "retry-after": String(decision.retryAfterSeconds) },
      },
    );
  }

  // 3. Book the slot at once. Nothing is awaited between the check above and
  //    this line, so two requests arriving together cannot both pass.
  //
  //    A booking is given back only when it is certain no payment left the
  //    wallet. Keeping it on a mere suspicion is the safer bias: the daily
  //    ceiling can then only under-spend the pot, never overspend it.
  recordSend(visitor, nowMs);

  // 4. Where does it go? Decided here, never by the caller.
  let to: string;
  try {
    const addresses = await readAddresses();
    // Hidden rounds pay the arcade's shielded address. Open rounds pay the
    // arcade's own open address (D-030), so the coins stay in the house and the
    // round can be repeated all day without a third party involved.
    to = parsed.branch === "hide" ? addresses.deposit : addresses.transparent;
  } catch (error) {
    // The wallet was never asked to pay, so the allowance goes back.
    refundRoundKeepingPause(visitor, nowMs);
    return refuse(error, "reach the wallet");
  }

  // 5. Make the real payment. Only a hidden payment may carry a note: the rules
  //    of the network forbid one on an open payment, so nothing is sent there.
  let payment;
  try {
    payment = await sendPayment(
      to,
      ROUND_ZATOSHIS,
      parsed.branch === "hide" ? HIDDEN_ROUND_MEMO : undefined,
    );
  } catch (error) {
    // A settling or refilling refusal is the wallet saying "not yet", before it
    // built or broadcast anything, so the allowance goes back. Any other failure
    // is treated as possibly-paid and the booking is kept.
    if (error instanceof SettlingError || error instanceof RefillingError) {
      refundRoundKeepingPause(visitor, nowMs);
    }
    return refuse(error, "make the payment");
  }

  return Response.json({
    ok: true,
    branch: parsed.branch,
    txid: payment.txid,
    explorerUrl: payment.explorerUrl,
    amountZatoshis: ROUND_ZATOSHIS,
    amountTaz: formatTaz(ROUND_ZATOSHIS),
    // What a stranger can learn about this payment from the chain. These are
    // rules of the network, not our opinion and not scraped from an explorer,
    // and the link above is handed to the player so they can check for
    // themselves. That is the honesty line from ARCHITECTURE.md.
    publicFacts: publicFactsFor(parsed.branch, to),
  });
}

function publicFactsFor(branch: Branch, to: string) {
  return branch === "hide"
    ? {
        amountVisible: false,
        recipientVisible: false,
        recipient: null,
        senderVisible: false,
        notePossible: true,
        noteSecret: true,
      }
    : {
        amountVisible: true,
        recipientVisible: true,
        recipient: to,
        // Not visible, and this took a real transaction to establish. The house
        // money sits in the shielded pool, so an open payment is an unshielding
        // one: the destination and the amount are written in the clear, but the
        // coins that paid for it are still shielded notes, and those reveal only
        // nullifiers. Checked against tx
        // c97af9530f49e1760ee7368f46ed3b8940d0095a30230a3bba244863624fa7e5, where
        // the explorer names the source only as "Ironwood Pool", lists both inputs
        // as sealed Ironwood notes with no address, and its own Blend Check reads
        // "nothing here for an outside observer to connect" at a risk score of
        // 0/100. Claiming the sender was public would have overstated the leak,
        // which is the one thing the honesty line forbids.
        senderVisible: false,
        // Not a choice we made. An open payment cannot carry a note at all,
        // which the wallet refuses with its own error if anyone tries.
        notePossible: false,
        noteSecret: false,
      };
}

/**
 * Turns any failure into one plain sentence and an honest status. It never
 * invents a receipt, so a player is never shown a payment that did not happen.
 *
 * The settling and refilling cases are answered first and separately, because
 * neither is a breakdown. Settling is the network doing what it always does.
 * Refilling is planned maintenance somebody started by hand. Both should read
 * as a beat to wait through rather than an error, and in both cases the slot
 * has already been given back because nothing was paid.
 */
function refuse(error: unknown, what: string) {
  if (error instanceof RefillingError) {
    return Response.json(
      {
        ok: false,
        code: "refilling",
        problem: error.message,
        retryAfterSeconds: EXPECTED_REFILL_SECONDS,
      },
      {
        status: 503,
        headers: { "retry-after": String(EXPECTED_REFILL_SECONDS) },
      },
    );
  }
  if (error instanceof SettlingError) {
    return Response.json(
      {
        ok: false,
        code: "settling",
        problem: `The last payment is still landing. The network has to agree on it before the wallet can pay again, which usually takes about a minute. Nothing is wrong, and nothing has been lost: ${formatTaz(
          error.pendingChangeZatoshis,
        )} TAZ is on its way back to the arcade.`,
        retryAfterSeconds: EXPECTED_SETTLE_SECONDS,
        spendableZatoshis: error.spendableZatoshis,
        pendingChangeZatoshis: error.pendingChangeZatoshis,
      },
      {
        status: 409,
        headers: { "retry-after": String(EXPECTED_SETTLE_SECONDS) },
      },
    );
  }
  if (error instanceof SidecarError) {
    return Response.json({ ok: false, problem: error.message }, { status: error.status });
  }
  console.error(`round failed while trying to ${what}:`, error);
  return Response.json(
    { ok: false, problem: "The payment did not go through. Nothing has been sent." },
    { status: 500 },
  );
}
