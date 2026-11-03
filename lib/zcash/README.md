# lib/zcash — the bridge to the house wallet

Everything that talks to Zcash lives here. Added in Phase B (B4).

The browser never touches the chain and never holds a key. It calls HTTP routes
in `app/api/`, every one of them listed below, and those routes call a small
Rust program on the same machine (the **sidecar**, D-024) which owns the wallet
and does the signing.
See `sidecar/` for that program and `DECISIONS.md` D-024, D-025, D-027, D-030
for why it is shaped this way.

## Files

| File | What it is |
| --- | --- |
| `config.ts` | The server-side numbers: how much a round moves, the note it carries, the timeouts, and how often money may move. None of it is settable by a player. |
| `guardrails.ts` | The rules that stop a caller steering the money. Pure: no clock, no network, no memory. This is the file to read first. |
| `rate-store.ts` | The counters those rules read, kept in this process's memory. |
| `poll-guard.ts` | The brakes on reads: a per-visitor gap on "where has my payment got to?", and the whole-arcade count per minute that keeps the wallet's lock free for whoever is being paid (D-138). |
| `sidecar.ts` | The HTTP client for the sidecar. Server code only. Every failure becomes plain words; nothing here can invent a success. Also `readPaymentProgress`, which asks the chain where a payment has got to, so the game can show a real block number instead of a made-up countdown (D-031). Two refusals get their own types instead of being lumped in with breakdowns, because neither is a breakdown: `SettlingError`, the network still agreeing on the last payment, and `RefillingError`, the arcade mid-split (D-035). `readHealth` is the cheap call and reports whether a refill is running without making anyone wait on the wallet (D-036). |
| `format.ts` | Zatoshis into the decimal string the explorer shows. |
| `*.test.ts` | The rules above, pinned down so a careless edit fails loudly. |

## Routes

Every route the site has, and the one question that matters about each:

| Route | Method | Can it move money? |
| --- | --- | --- |
| `/api/house/status` | GET | No. Read-only: balance, synced height, both addresses. |
| `/api/game/crowd/book` | GET | No. Read-only: The Crowd's record book, composed from recent send history. |
| `/api/game/unseen/progress` | GET | No. Read-only: where one payment has got to, as a real block number. |
| `/api/game/merchant/window` | GET | No. Read-only: the merchant's incoming side and the receipts on it. |
| `/api/game/merchant/receipt` | GET | No. Read-only: one payment proved against the chain, check by check. |
| `/api/game/unseen/send` | POST | **Yes. The only one that can.** |

Every read ends at the wallet's single lock, so the reads share two brakes
(`poll-guard.ts`, D-138): a per-visitor gap, and a count for the whole arcade
per minute. A braked read says so in plain words and claims nothing; the
crowd's book answers with its curated fallback rows instead of refusing.

## The shape of the protection

The send route accepts one field, `choice`, worth `"hide"` or `"open"`. That is
the whole input. There is no field for a destination, an amount, or a note, so
there is nothing to fill in:

- The **amount** is `ROUND_ZATOSHIS` in `config.ts`.
- The **destination** is one of two addresses the arcade itself owns: the
  shielded deposit address for `hide`, the house's own transparent address for
  `open` (D-030). Coins never leave the house, so a round is repeatable.
- The **note** is fixed wording in `config.ts`, sent only on a hidden payment.
  An open payment cannot carry one at all; the network forbids it, and the
  wallet refuses with `Payment(TransparentMemo)` if anyone tries.

Unexpected fields are **refused**, not ignored. A caller that invents `to` or
`zatoshis` is not the game, and quietly dropping the attempt would hide it.

Then the rate limits, checked before the wallet is touched and in this order:

1. A global pause between sends. The wallet builds one transaction at a time,
   and a real send takes tens of seconds of proving.
2. A per-visitor share of each hour.
3. A daily ceiling for the whole arcade, which is the treasury's seatbelt.

The slot is booked the instant the check passes, with nothing awaited in
between, so two requests arriving together cannot both get through. A booking
survives a failed payment on purpose: it stops anyone hammering a wallet that is
struggling, and the daily ceiling can only under-spend the pot, never
overspend it.

## Known limits, stated plainly

- The counters live in one process's memory. They reset on restart, and two
  servers would each keep their own copy. Right-sized for a demo on one machine.
- The visitor key reads the last hop of `x-forwarded-for`, the entry the
  platform's proxy added, so a caller cannot invent a fresh hourly bucket by
  writing the header themselves (D-138). It still assumes one honest proxy in
  front; a caller who reaches the app without one picks their own key. The
  rules that protect the money, the global pause and the daily ceiling, and
  the whole-arcade read brake do not use the key at all, so the worst case
  stays one visitor taking more than their share of an hour.
- The sidecar must be running. If it is not, every route says so and no payment
  is made. Start it with `cargo run` in `sidecar/`.
