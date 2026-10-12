# ROADMAP

> **Status:** SCAFFOLD — phases are defined only after scope + architecture are
> approved. Each phase has a clear **definition of done** so we never drift.

## Phase 0 — Foundations (documents)
- Goal: VISION, RESEARCH, SCOPE, ARCHITECTURE, DECISIONS, ROADMAP all approved
- Definition of done: owner has signed off on all six documents
- Status: **DONE** (2026-10-10) — VISION, SCOPE, ARCHITECTURE, OUTLINE approved;
  RESEARCH A–C clicked; DECISIONS ongoing.

## Phase 1 — Foundation (Phase A): the world exists before gameplay

- Goal: design system + custom characters + hub shell + shared game frame.
  **No game logic yet** (that's Phase B).
- Tasks:
  - **A1 Scaffold** — Next.js + TS + Tailwind + shadcn/Radix + Motion; strict
    TS/ESLint/Vitest; folder structure. *(no owner input)*
  - **A2+A3 → World preview (merged, D-015)** — STYLEGUIDE.md (four layers,
    D-013/D-014/D-015/D-016 + voice D-018) + living scene: night-arcade stage,
    the Watcher (first custom character, idle + reacts), clickable
    hide/don't-hide with seal animation + leak meter. Static style sheet
    deleted. Delivered **with the slop-test scorecard**. Display font = **Syne**
    decided (D-017). *(OWNER reacts — plain-words copy rewrite proposed, Layer 4)*
  - **A4 Hub shell** — `/` lobby grid of cabinets; G1 playable-entry; others
    "coming soon."
  - **A5 Shared game frame** — stage + Watcher slot + explanation panel + leak
    meter on `/games/unseen`.
- Definition of done: app runs; owner approved look (A2) and characters (A3);
  hub cohesive (A4); frame exists (A5).
- Status: **DONE (2026-10-11)** — **A1 DONE** (2026-10-10). **World preview BUILT +
  voice pass APPLIED** (D-015/D-017/D-018): Syne font, grandma-rule copy, all
  gates green; owner approved the copy table ("everything passes move on").
  **A4 Hub shell BUILT + VERIFIED + APPROVED** (2026-10-10, D-019/D-020/D-021):
  data-driven lobby at `/`, one lit Unseen cabinet (Watcher alive, power-on
  beat, click navigates to `/games/unseen`) + four dark G2-G5 cabinets with
  custom glyphs and cursor teases; owner reacted "looks right". **A5 Shared
  game frame BUILT + VERIFIED + APPROVED** (D-021/D-023): reusable frame
  (header, stage + Watcher slot, explanation panel, leak meter) at
  `/games/unseen`, shipping a minimal hide / leave-open beat; both branches
  tested in browser (blind + sealed + 0% leak vs alert + exposed + full leak),
  zero console errors, delivered with slop scorecard; owner reacted "yeah its
  okay". Project named **Zarcade** (D-022).

## Phase 2 — The real thing (Phase B): real rounds + the on-chain send

- Goal: Unseen becomes a full game and its sends become REAL Zcash testnet
  transactions (D-003: no simulation). Funding + proving decisions are clicked:
  server-side proofs (D-024) and house-wallet treasury (D-025).
- Tasks:
  - **B1 Toolchain + sidecar** — DONE 2026-10-11. Native Windows Rust per
    D-026 (WSL2 impossible on this machine); axum service on the official
    librustzcash crates (backend 0.24 / sqlite 0.22 / proofs 0.30 with
    bundled Sapling params, no runtime download). House wallet generated
    server-side (seed never leaves `sidecar/data/`), account "house" with
    birthday = chain tip at creation, stable shielded UA persisted in
    `address.txt`. Endpoints: `/health` `/address` `/balance` `/sync` `/send`
    (ZIP-317 fees, 0.001 TAZ per-send cap, localhost bind only). Connects to
    `https://testnet.zec.rocks:443` (devtool-style TLS channel; the old
    `testnet.lightwalletd.com` was decommissioned 2024, see RESEARCH B).
    Verified: initial sync to height 4,488,441; `/health` + `/address`
    answer; address `utest1u0gv9...u80kr`.
  - **B2 Fund the treasury** — DONE 2026-10-11. **Chain split discovered
    (D-027):** the public testnet activated NU7 at 4,465,026 on 2026-10-04;
    the fauzec.com / jinolabs faucets (D-025) pay on the **abandoned pre-NU7
    fork**, so their funds are invisible to a canonical-chain wallet.
    Re-funded from the **Zakura NU7 faucet** (zakura.com/nu7): tx
    `eaf1d074b6e93a64163e82055454d7bd3e1e5f7f159d8451abd28e78a6839b1b`, claim
    `7d6ef5be4cf32c1ce0e1a06dc909c4a5`. House wallet now shows **0.125 TAZ
    (12,500,000 zat)** on the canonical NU7 chain via testnet.zec.rocks, and
    the sidecar scans post-NU7 blocks correctly.
  - **B3 Real sends** — **DONE 2026-10-11** (after the D-028 crate upgrade).
    Both legs are real mined transactions on the canonical NU7 testnet, and the
    explorer labels them exactly the way the lesson needs:
    - **Shielded (the lesson):** `952a1959f26c0f405e52de225239cb51bc0bb0696357f669d7449480f3299c77`,
      block **4,488,884**, fee 0.0001 TAZ, tx version 6. ZecBlock labels it
      `CONFIRMED / IRONWOOD`: *"Fully private transaction using the Ironwood
      shielded pool (NU6.3). All amounts, senders, and recipients are
      encrypted."*
    - **Transparent (the contrast):** `7ffa8ea6cab7dd1ae9e9558fa08e8f7a72b1c22dde423754eda69d245bb914f2`,
      block **4,488,905**, 2,000 zat to `tmA4rv…BvGb`, fee 0.00015 TAZ.
      ZecBlock labels it `CONFIRMED / UNSHIELDING` with a **privacy score of
      0/100**: *"moved out of the private shielded pool to the public
      address"*, naming both the amount and the recipient.
    - Balance trail: 12,500,000 -> 12,489,000 -> 12,472,000 zat.
    - The `/send` receipt's explorer link was repointed from the fork-indexing
      `zexplorer.app` to `testnet.zecblock.com/tx`.
    - Constraint learned, and it is a teaching gift: a transparent payment
      **cannot carry a memo**. The backend rejects it with
      `Payment(TransparentMemo)`. Memos exist only for shielded recipients, so
      "you can attach a private note" is itself part of what shielding buys.
    **Resolved since (D-030, 2026-10-11):** the sidecar now derives the house's
    own transparent address from the same seed and persists it beside the seed,
    exposed at `GET /transparent-address`. The B3 send to a stranger's address
    was a capability test only; the game pays the house. See RESEARCH I4 for the
    wrinkle that the wallet does not scan that address, and why that is fine.
  - **B4 Bridge + guardrails** — **DONE 2026-10-11.** Next.js route handlers
    call the sidecar; rate limits; a fixed tiny amount chosen on the server; no
    free-form player input reaches the wallet.
    - `POST /api/game/unseen/send` is the **only** route that can move money and
      accepts exactly one field, `choice`, worth `"hide"` or `"open"`. There is
      no field for a destination, an amount, or a note, so there is nothing to
      fill in. Unexpected fields are **refused**, not ignored.
    - The destination is resolved server-side to one of two addresses the arcade
      owns (D-030). The amount is `ROUND_ZATOSHIS` = 1,000. The note is fixed
      wording, sent only on the hidden branch, because the network forbids one
      on an open payment.
    - Three limits, checked before the wallet is touched: a global pause, a
      per-visitor hourly share, and a daily ceiling for the whole arcade. The
      slot is booked with nothing awaited between check and booking, so two
      simultaneous requests cannot both pass.
    - `GET /api/house/status` is read-only and reports the pot split into
      total / spendable / pending change, plus `readyForRound`.
    - Verified live: 8 smuggled or malformed requests all refused with 400, `GET`
      on the money route 405, and a real open round broadcast on chain
      (`b2905c65…b7297d`, 1,000 zatoshis to the house's own transparent
      address). 34 unit tests pin the rules down.
    - **Found while testing, and recorded in RESEARCH I:** a round cannot follow
      a round until the previous change is mined, and an unoptimized build took
      72s to prove one transaction. Both now have honest handling (a 2-second
      `409 settling` answer carrying the real numbers, and optimized dependency
      crates), but the pacing question is an **open owner decision**.
  - **B4.5 Pot split + real landing (D-031)** — **DONE 2026-10-11.** Removes the
    wait between rounds without hiding the fact that the wait exists.
    - `HouseWallet::split_pot(count, per_note)` builds ONE transaction paying the
      house's own shielded address many times, via `propose_transfer` and a
      `zip321::TransactionRequest`, because `propose_standard_transfer_to_address`
      hardcodes a single payment. `build_and_broadcast` was extracted from `send`
      so there is exactly one place that proves, signs and broadcasts money.
    - Exposed as `POST /admin/split` behind `x-zarcade-admin` / `ZARCADE_ADMIN_TOKEN`,
      with the endpoint disabled outright when the token is unset. The bridge does
      not proxy it. Every coin it creates is paid to the house, so it cannot move
      money out; the worst case is a burnt fee.
    - Bounds: 2 to 200 notes, each 5,001 to 100,000 zatoshis. The lower bound is
      load-bearing, not tidy: see the dust discovery below. All five refusal paths
      exercised live, all 400 before touching the wallet or the network.
    - `GET /tx-status?txid=` reports the block a payment landed in and its
      confirmations, and `readPaymentProgress` carries that into the app. It reads
      the wallet's own records first and only syncs while the payment is
      unconfirmed, so polling it cannot delay the next player's round. A txid the
      house never made is refused rather than reported as eternally landing.
    - **Verified live.** A 5-note split (`20f2527f…337f0e5`) cost exactly 30,000
      zatoshis, and three hidden rounds then ran back to back at 22.7s, 21.5s and
      22.1s with no settling refusal, which was impossible before it. The full
      40-note split (`30604abf…6738b1ba`) took 497s to build and cost exactly
      205,000, confirming the fee as **5,000 per output plus 5,000**. The house
      now holds 40 confirmed 20,000-zatoshi coins, so roughly 40 rounds can follow
      each other before the pace falls back to about one per block. RESEARCH I7.
    - **Found while checking whether the split was even safe, and it corrected a
      documented conclusion.** RESEARCH I5 used to say the wallet does not count an
      output the account sends to itself. Opening `sidecar/data/wallet.sqlite`
      read-only with `node:sqlite` shows every one of those outputs stored with a
      real witness. What excludes them is a dust floor: `get_wallet_snapshot` puts
      any note worth at or below the ZIP-317 marginal fee of 5,000 zatoshis into
      `uneconomic_value`, and `Balance::total` deliberately omits that bucket. Had
      the split been built on the old guess it would have appeared to work and
      quietly turned the pot into unspendable dust. Logged as D-033 and D-034.
    - **The design depends on one detail worth knowing.** Note selection for a
      value target is oldest-first (`ValueSelection::Accumulate`, ordered by
      commitment tree position). The split's change output is written last, so it
      is the newest coin and is reached only after the small ones are gone. If a
      future version reordered outputs, the burst would collapse to one round and
      the symptom would be the settling refusal coming back.
  - **B4.6 Operator safety for the refill (D-035, D-036, D-037)** — **DONE
    2026-10-12.** B4.5 proved the split works. This makes it something one person
    can run safely while a queue is forming.
    - `sidecar/split-pot.ps1` replaces the hand-assembled two-step command that
      needed a separate `split.json` and a token typed in by hand. One command now.
      It refuses early if the wallet is down, if a coin would be born as dust, or
      if the pot cannot cover the cost; states the fee before asking; then watches
      the transaction land and says when the coins are usable. Verified live end to
      end twice: 5 coins built in 95s and landed in block 4490547, 2 coins built in
      38s and landed in block 4490566 after 135s.
    - A round requested during a refill is refused with 503 and
      `code: "refilling"` at two layers, rather than queueing behind an
      eight-minute split, timing out, and being shown as a failure that might not
      even be true, since the wallet could still carry it out afterwards. The
      bridge asks `/health` first and refuses in about 100 ms before booking
      anything; the sidecar also refuses `/send` in about 25 ms as a backstop, and
      on that path the bridge refunds the round because nothing was paid. Found by
      test, not by reading: the first version guarded only `/send`, and a live
      round still went through, because `readAddresses` runs first and simply
      waits out the refill on the wallet mutex.
    - `GET /health` publishes the flag without touching the wallet, so it is the
      one endpoint that stays fast during a refill (1.6 ms measured, down from 505
      ms) and the only side-effect-free way to observe it. Probing `/admin/split`
      instead starts a real split whenever no refill happens to be running, which
      is exactly how that was discovered, at the cost of one 15,000-zatoshi fee.
    - **RESEARCH I7 corrected, see I8.** The split fee is
      `5,000 x max(inputs, outputs)`, not `5,000 x (notes + 1)`. The old formula
      only held while one large coin funded the split. Once the pot is mostly small
      coins, inputs outnumber outputs and each refill costs more per coin. Four
      separate splits fit the corrected rule exactly.
    - All four gates green: typecheck, lint, 34 tests, production build with both
      API routes still dynamic.
  - **B5 Full Unseen rounds** — rounds per OUTLINE; the D-020 signature seal
    sweep animation IS the lesson; leak meter bound to the REAL tx outcome;
    "what the public sees" panel linking the explorer; reduced-motion honored;
    delivered with the slop scorecard.
    - Must state plainly that both branches pay the arcade itself (the honesty
      line in ARCHITECTURE.md), and apply D-029 naming ("Ironwood, the private
      pool" on first mention, "the private pool" after).
    - Must show the payment landing as a real beat, using `readPaymentProgress`
      (B4.5) so the block number on screen is the block the network actually used.
      `readyForRound` and the `settling` answer remain the fallback for when the
      pot has not been split.
    - The refill state is already handled server-side (**done 2026-10-12**, folded
      in here at the owner's choice rather than fixed separately).
      `/api/house/status` now asks `/health` first, which is the one sidecar call
      that does not need the wallet mutex, and answers in about 100 ms with
      `refilling: true` and no balance figures, instead of blocking for up to two
      minutes and then reporting a broken wallet that was only busy. Verified live
      during a real refill, and verified to return to full figures afterwards. What
      is left for B5 is the screen: a distinct state that says the arcade is
      refilling.
- Definition of done: playing Unseen on localhost produces at least one REAL
  shielded testnet tx, verifiable on the explorer; both branches (hide / leave
  open) work; all gates green; owner approves the gameplay.
- Status: **B1 DONE, B2 DONE, B3 DONE, B4 DONE, B4.5 DONE, B4.6 DONE; B5 next (2026-10-12)** — D-024/D-025/D-026
  clicked; RESEARCH D+E filled and corrected (endpoint research: zec.rocks).
  Windows toolchain: VS Build Tools 2022 (C++ workload) + Rust stable 1.99.0
  (rustup, minimal profile via TUNA mirror; WSL2 ruled out, virtualization
  disabled). Sidecar compiles green (`profile.dev debug=0` for disk safety)
  and RUNS a real testnet wallet: house account created, shielded UA
  generated, synced to tip 4,488,441 via testnet.zec.rocks, `/health`
  `/address` `/balance` `/sync` `/send` live on 127.0.0.1:9070. Next: B2
  faucet funding to `utest1u0gv9...u80kr`, then B3 first real sends.
  **UPDATE 2026-10-11:** B2 DONE via the Zakura NU7 faucet after the
  chain-split discovery (D-027); the house wallet holds 0.125 TAZ on the
  canonical NU7 chain. **B3 DONE** after the D-028 upgrade to the NU7-aware
  crates: a real shielded send is mined in canonical block **4,488,884** and a
  real transparent contrast send in block **4,488,905**, both labelled by
  `testnet.zecblock.com`; the old wallet DB migrated cleanly to sqlite 0.23
  with the balance intact. Next: B4, the Next.js route handler that bridges the
  game to the sidecar.
  **UPDATE 2026-10-11 (B4):** **B4 DONE.** The bridge is live and verified
  against the real chain: `POST /api/game/unseen/send` accepts one field and
  nothing else, resolves the destination server-side to an address the arcade
  owns, and moved a real open payment on chain (`b2905c65…b7297d`). Every
  smuggling attempt is refused. `GET /api/house/status` reports the pot split
  into total / spendable / pending change. D-029 and D-030 logged and
  implemented; ARCHITECTURE.md's network and honesty sections rewritten to
  match what was actually built; RESEARCH section I added with the measured
  numbers. **Re-measured after optimizing the dependency crates:** a round now
  takes 21–22s instead of 72s, the confirmation wait measured 34–99s against a
  23.6s average block, and four more real payments went out through the bridge
  with the balance trail reconciling to the zatoshi (RESEARCH I2 and I5). All
  gates green: typecheck, lint, 34 tests, and a production build in which both
  API routes are correctly dynamic. Also closed a safety gap: `sidecar/data/` and
  `sidecar/target/` are now gitignored, so the seed can never be committed.
  **One thing now needs the owner:** round pacing, logged in the DECISIONS open
  list with the measured numbers attached. Next: that choice, then B5.
  **UPDATE 2026-10-11 (pacing decided, B4.5):** the owner chose **option C**
  (D-031): split the pot so nobody waits, and still show the payment landing
  while the next person plays. Also approved the in-game line "the crowd cannot
  see this. In a real wallet, not even the site could." (D-032). **B4.5 DONE and
  verified on the real chain.** The house now holds 40 confirmed 20,000-zatoshi
  coins, and five hidden rounds ran back to back in 130.9s (23.7, 24.2, 27.6,
  28.6, 26.8) with no settling refusal, against a pace of one player per minute
  or two before. `GET /tx-status` turns the landing into a fact: watched a fresh
  payment report `landed=False` eleven times and then `landed=True` in block
  **4,489,502** with 1 confirmation, after which asking again costs 4ms and no
  network. Fees came out exactly as predicted, 30,000 for 5 notes and 205,000
  for 40, i.e. 5,000 per output plus 5,000. **One documented conclusion turned
  out to be wrong and was corrected:** RESEARCH I5 said the wallet ignores
  outputs an account sends to itself. Reading `sidecar/data/wallet.sqlite`
  directly shows they are all stored with real witnesses; what excludes them is a
  dust floor at the ZIP-317 marginal fee of 5,000 zatoshis, which
  `Balance::total` deliberately omits. Catching this before building the split
  was the difference between a working pot and an unspendable one (D-033, D-034,
  RESEARCH I5 and I7). Gates green: typecheck, lint, 34 tests, production build
  with both API routes still correctly dynamic. Next: **B5**.

## Phase 3 — _(to be defined)_
- Goal:
- Tasks:
- Definition of done:

## Phase N — Polish + hackathon submission
- Goal: demo video, writeup, docs, submission
- Definition of done: submission package complete

---

**Rule:** We do not start Phase N+1 until Phase N's definition of done is met
and the owner confirms it.
