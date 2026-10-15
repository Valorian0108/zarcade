/**
 * Server-side numbers for the Zcash bridge (B4).
 *
 * None of these can be set by a player. How much a round moves, where it goes,
 * and how often it may happen are decided here, on the server, because the
 * wallet behind them is the arcade's own pot of test coins (D-025).
 *
 * Units: 1 TAZ = 100,000,000 zatoshis ("zats" for short).
 */

/**
 * The house wallet helper (D-024). On a dev machine it listens on this
 * machine only; on Railway it lives on the private network with no public
 * door (D-087, D-094).
 */
export const SIDECAR_URL = process.env.ZARCADE_SIDECAR_URL ?? "http://127.0.0.1:9070";

/**
 * The service token for the wallet's send door (D-094). When the same value
 * is set on both services, the sidecar accepts a payment request only from a
 * caller that knows it. Empty means the token lock is off, which deploys
 * safely but is announced in the sidecar's log: the destination and amount
 * policy and the daily budget hold either way.
 */
export const SIDECAR_SERVICE_TOKEN = process.env.ZARCADE_SEND_TOKEN ?? "";

/**
 * How much one round of Unseen moves: 1,000 zatoshis, which is 0.00001 TAZ.
 *
 * Tiny on purpose. The lesson is the choice between hidden and open, not the
 * size of the payment, and the pot has to survive a whole event full of
 * players. For scale, the network fee on a round costs more than the payment
 * itself. The sidecar separately refuses anything above 100,000 (D-025), so
 * even a bug here cannot move a large sum.
 */
export const ROUND_ZATOSHIS = 1_000;

/**
 * The note attached to a hidden payment. Fixed wording, composed here, never
 * taken from a player.
 *
 * Only a hidden payment can carry a note at all. The rules of the network
 * forbid one on an open payment, which is itself part of the lesson, so the
 * open branch sends nothing here.
 */
export const HIDDEN_ROUND_MEMO = "Zarcade practice payment. The network cannot read this.";

/**
 * How long to wait on the helper. A real send does real cryptography: building
 * the zero-knowledge proof takes tens of seconds, and the wallet also has to
 * catch up with the chain first.
 */
export const SEND_TIMEOUT_MS = 180_000;
export const READ_TIMEOUT_MS = 20_000;

/**
 * How often money may move.
 *
 * `minSecondsBetweenSends` is a pause for everyone, not per visitor, and it is
 * an anti-hammering measure only. It is NOT the wait for a payment to land;
 * that wait is real and variable, and the wallet reports it separately as a
 * "still settling" refusal which the game turns into a countdown.
 *
 * `maxSendsPerIpPerHour` keeps one visitor from using up the whole pot.
 *
 * `maxSendsPerDayGlobal` is the treasury's seatbelt. A round costs about
 * 16,000 zatoshis including its fee, so 150 rounds is roughly 2.4 million,
 * comfortably inside the 12.5 million that one faucet claim provides.
 */
export const LIMITS = {
  minSecondsBetweenSends: 30,
  maxSendsPerIpPerHour: 10,
  maxSendsPerDayGlobal: 150,
} as const;

/**
 * Head-room for the network fee when asking whether the pot can pay for a
 * round. Mirrors `FEE_HEADROOM_ZATOSHIS` in the sidecar, which is the authority;
 * this copy only exists so the game can explain a refusal without a round trip.
 * Observed ZIP 317 fees: 10,000 zatoshis hidden, 15,000 open.
 */
export const FEE_HEADROOM_ZATOSHIS = 20_000;

/**
 * How long a payment usually takes to be mined, in seconds.
 *
 * Derived rather than guessed: NU7 activated at height 4,465,026 on 2026-10-04
 * and the chain reached 4,489,028 by 2026-10-11, which is 24,002 blocks in
 * 604,800 seconds, or about 25 seconds a block. A payment needs one
 * confirmation (ZIP 315 via `ConfirmationsPolicy::MIN`), so the honest wait is
 * one block on average and two when the chain is slow. Used only to suggest a
 * retry time; the game confirms by watching the wallet, never by trusting this.
 */
export const EXPECTED_SETTLE_SECONDS = 60;

/**
 * How long a pot refill usually takes, in seconds.
 *
 * Measured twice on this machine, not guessed (RESEARCH I7). Building a
 * zero-knowledge proof costs about twelve seconds per output: a 5-note split
 * took 69 seconds and a 40-note split took 497. The default refill makes 40
 * notes, so eight minutes is the honest worst case to suggest as a retry time.
 *
 * Only ever a suggestion. A round request during a refill is refused instantly
 * by the sidecar and never queues, so nothing is waiting on this number and a
 * wrong value can only make the retry hint optimistic, never lose a payment.
 */
export const EXPECTED_REFILL_SECONDS = 480;

/**
 * The sentence a player gets if they press the button while the arcade is
 * refilling its coins.
 *
 * Written once here because three places need to say the same thing: the bridge,
 * which now refuses early, the sidecar client, which carries the refusal, and the
 * Rust sidecar itself, which keeps its own copy as a backstop for anything that
 * calls it directly. It follows the grandma rule: no jargon, and it says what to
 * do rather than what broke.
 */
export const REFILLING_MESSAGE =
  "The arcade is refilling its coins. Please try again in a few minutes.";
