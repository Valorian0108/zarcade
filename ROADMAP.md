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
    - **UPDATE 2026-10-12 (B5 DONE):** all three rounds built and verified with
      real testnet payments, including the round-3 open-only lock, the landing
      beat via `readPaymentProgress`, and the summary screen. 76 tests, all
      gates green. Owner gameplay approval queued.
    - **UPDATE 2026-10-12 (Layer 5 applied, D-044/D-045):** the owner-approved
      sample look was carried into the real game. The paid phase now belongs to
      a dedicated Reveal: two panels (your side / the stranger) with the
      redesigned Watcher on the hinge, shuttered rows that read out one at a
      time, gold pips instead of the red leak meter, the decision written as a
      margin note, and the twist line landing last with a light sweep. No red
      or green remains anywhere; `--valid`/`--leak` were repointed to the
      meaning colours. Motion level is now a choice the page offers
      (`components/motion-pref.tsx`, "Motion: more / less", remembered, OS
      `prefers-reduced-motion` as the starting default). The summary-screen
      meter bug ("Nothing yet" after three real payments) is fixed by hiding
      the per-payment readout there. Gates green: typecheck, lint, 76 tests,
      production build. Owner visual approval of the real reveal queued (needs
      one played round).
    - **UPDATE 2026-10-12 (same day, frame rebuilt):** the owner compared
      `/games/unseen` with `/sample` side by side and called the difference
      correctly: the reveal had the approved look but the other four screens
      were still the old generic shell in new colours. The frame itself was
      then rebuilt in the sample's system, ported line for line into
      `components/game/game.css` (`gm-` prefix): marquee with the gold
      wordmark and round chip, two panels with the Watcher on the hinge on
      EVERY screen, the sample's card treatment, chunky glowing pips, gold
      gradient buttons, the twist caption, and the same glows. The Watcher and
      the motion toggle were moved onto the same stylesheet, so the hub and
      the preview wear it too. Gates green again: typecheck, lint, 76 tests,
      production build. Computed styles verified equal to the sample's spec
      (wordmark gold and tracking, 16px panel radius, 170px hinge column,
      28x6 pips, gold gradient buttons).
    - **UPDATE 2026-10-12 (slot grammar, D-046):** the owner then found the
      flow screens clustered: prose paragraphs had been left inside the left
      panel, which the sample never does. Logged and applied the slot grammar:
      panels hold objects only (eyebrow, one display line, at most one card,
      open space, bottom anchor), conditional notices sit between card and
      anchor, the record panel holds one status sentence plus receipts plus
      the pip anchor, and all teaching prose moved to a caption slot below the
      stage. Audited state by state in code (intro calm and refilling, brief
      normal, error and locked, sending, summary) plus a live DOM check of the
      intro: no prose inside any panel, caption below the stage, anchors
      pinned. Gates green: typecheck, lint, 76 tests, production build.
    - **UPDATE 2026-10-12 (prose voice, D-047):** the owner then caught that
      the intro list had character (Syne) while every other sentence was the
      framework default nobody chose. Built the /sample/type specimen (three
      directions on the real game copy: Newsreader, Space Grotesk, tuned
      all-Syne); owner picked Direction 1. Applied everywhere: Newsreader
      loaded in the root layout as --font-prose and mapped to font-sans,
      Geist Sans removed from the app, prose classes tuned to 16px/1.7 in
      game.css and the sample, specimen page kept as the record.
    - **UPDATE 2026-10-12 (wide left panel, D-048 + voice flip, D-049):** the
      owner found the intro clustered and traced it to the "About the money"
      card: a normal-length message in a 278px text column. Their proposal was
      taken: leave every object where it is and widen the box that carries
      them. The stage split flipped to 1.3fr : 170px : 1fr, one rule in the
      shared frame, so all screens and future games inherit it. Then the owner
      flipped the prose voice from Newsreader to Space Grotesk (specimen
      Direction 2); the serif-era size tuning was reverted to the defaults the
      direction was judged at. Machine-verified after: prose family, panel
      widths, card text column, display and mono constants. Owner confirmed
      the applied result visually the same day ("yeah this is better"): the
      intro clustering complaint is closed.
- Definition of done: playing Unseen on localhost produces at least one REAL
  shielded testnet tx, verifiable on the explorer; both branches (hide / leave
  open) work; all gates green; owner approves the gameplay.
- Status: **B1–B5 DONE. Definition of done completed 2026-10-12: the owner
  played live rounds with the sidecar running and approved the real reveal
  ("dope i love this").** Owner-session payments, all real on the NU7 testnet:
  `ea3a0a094734fe92aaa17d25c864d0cd3a15fdf61e6be0fe63e15b542718059f` and
  `a2efb60c6eef3370de7c4ef5fde43a78e96976469ade457dfa7e46a3263efd24` (block
  4,492,119), `d914815afe6cf2dbc9af61b6cbdc263cd392da8f2311beb87fe106bbe6fa067f`
  (block 4,492,127), `e38db5048a17cd83385f936c13da0dc4d39bdfbd0d03191763ad80c4dc183b16`
  (broadcast, landing during verification). House wallet spent 54,000 zat
  including fees across the session and stayed readyForRound throughout.
  — D-024/D-025/D-026
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
  **UPDATE 2026-10-12 (B6 front door + floor, D-050):** the three-room flow is
  built. `/` is now the entrance (ZARCADE sign with one neon flicker and one
  gold sweep, two prose lines, the Watcher's eye opens with a single lantern
  flare, "Step inside" ignites into a slow attract pulse; ~2s landing, then
  quiet). The hub moved to `/arcade` and was restyled into the gm- system:
  cabinets fade in on a stagger, Unseen rises last and ignites, dark cabinets
  stay inert, the row ends with "One machine is live. The others come later."
  `/games/unseen` unchanged. Beat sheet machine-verified in the browser
  (animation names and delays, fonts, lit and shadow states, press-to-navigate,
  copy). Gates green: typecheck, lint, 76 tests, production build with `/` and
  `/arcade` static. **Self-audit then found a real pre-existing bug:** React 19
  does not patch attribute mismatches at hydration ("This won't be patched up"),
  so a saved "less" motion choice never reaches the DOM on a fresh load:
  `data-reduced` stays `"false"` and the CSS plays full motion. Reproduced in
  the production build, not dev-only; the earlier note calling the hydration
  warning harmless was wrong. Fix per the shipped Next.js guide
  (preventing-flash-before-hydration): an inline script applies the choice to
  `<html>` before first paint. Logged as D-051 and applied (next update).
  **UPDATE 2026-10-12 (D-051, D-052, D-053 applied):** the motion fix plus all
  six owner feedback points, in one pass.
  - D-051: inline script in `<head>` sets `data-motion` (and `data-pref` when
    saved) on `<html>` before first paint; a second inline script in the toggle
    sets `aria-pressed` during parsing; `suppressHydrationWarning` on `<html>`
    and the toggle buttons; all CSS keys off `html[data-motion="less"]` and
    `html[data-pref]`; `data-reduced` removed from every component; `setPref`
    syncs the `<html>` attributes so clicks apply without a reload. Machine
    verified both ways: saved "less" fresh-loads to `data-motion="less"` with
    Less pressed before any interaction, mood skipping straight to calm, and
    zero console errors (the hydration error is gone); no saved choice loads
    "more" with `data-pref` absent, the full beat sheet intact (flicker 0.4s,
    sweep 0.95s, glow 1.5s, blind to calm), nothing pressed, zero errors.
  - D-052: caption slot now sits above the stage on every screen; spacing
    rebalanced (caption 6px under the marquee, stage 18px under the caption).
  - D-053: sign sizes by its column (`clamp(18px, 10cqi, 80px)`, container
    `.gm-doorSide`); measured "ZARCADE" at 9.43em wide, so the sign always
    takes 94% of its box and can never slide under the Watcher again (owner's
    616px column gets a 61.6px sign). Amount sizes by its panel
    (`clamp(24px, 12cqi, 44px)`, container `.gm-panel`); measured text ratio
    7.02em, so it takes at most 84% of the panel and cannot touch the box.
    Watcher: viewBox widened 200 to 224 so the lantern glow circle (cx 169,
    r 52) is whole, killing the rectangular light band; blind lid redrawn with
    the hood's own curve path instead of the square rect, so a closed hood
    reads dark and empty, never as a black box.
  - Gates green: typecheck, lint, 76 tests, production build, `/` and
    `/arcade` still static.
  - Owner reported "can't see the Watcher" mid-pass. Machine probes found it
    present and visible in all three rooms (opacity 1, correct sizes, clean
    console in both motion modes); likely a stale dev tab after ~20 rapid hot
    reloads. Owner asked to hard-reload and confirm.

## Phase 3 — _(to be defined)_
- Goal:
- Tasks:
- Definition of done:

## Phase N — Polish + hackathon submission
- Goal: demo video, writeup, docs, submission
- Definition of done: submission package complete
  **UPDATE 2026-10-12 (D-054, first submission artifact):** the public README
  was rewritten per README-PLAN.md. The internal pieces moved out:
  OPERATING.md (run steps, pot split, troubleshooting), AGREEMENT.md (the
  accountability agreement + document map), LICENSE (MIT, owner said pick
  now). The README carries the real facts: the two mined testnet txids with
  explorer labels, a mermaid money path, three collapsible field notes, the
  hide-versus-open table, measured numbers, a live /api/house/status block.
  Pending: three screenshots from the owner's window (assets/SHOTS-NEEDED.md
  lists them); optional round gif only if time allows. Docs only, no code
  touched, gates unaffected.

## Phase O — The door lives, the wait teaches, the Watcher is the face
- Goal: the six changes the owner approved on 2026-10-12, in the agreed order.
- Tasks:
  - D-058 copy fix: "This is an arcade that teaches Zcash privacy." (door + metadata). DONE.
  - D-056 quiet footer: contrast line + GITHUB link to Valorian0108/zarcade. DONE.
  - D-057 "less" redefined: no movement, but gentle 0.2s opacity/colour fades stay. DONE.
  - D-055 the Watcher's ~40s ambient story: idle, little door, walk through,
    empty beat with a softer sign, screen-edge peek, slip away. DONE, pending owner eyeball.
  - D-059 lever A: the sending screen teaches (real pipeline track, one live step,
    "Real math takes real seconds."). DONE. Lever B declined for now, revisit post-Zecathon.
  - D-060 the Watcher is the logo: app/icon.svg mark (hood + one lit eye). DONE, pending owner eyeball.
  - Also fixed: README repo URL was Valorian0104, the real remote is Valorian0108.
  - D-061 (found by self-audit mid-phase): the parse-time aria-pressed script
    moved out of the toggle component into the server layout, because a script
    in a client component warns on every client navigation. Verified: full
    client-side door-arcade-machine chain with a clean console.
  - D-062 the door restaged (owner picked option A): a door he can actually
    enter. 96x210 on wide windows (84x210 stacked), clear gap to the right of
    the cloak, feet on the ground-shadow line, layered behind him, threshold
    hairline, inner light rises as he nears, leaf swings open, he steps in
    shrinking to 0.72, leaf shuts with a small settle, closed door holds and
    fades. Walk distance and door size are CSS variables per breakpoint, not
    guesses. Verified by seek (not waiting): at rest the door clears the cloak
    by ~25px and sits on the ground line; at entry his center is inside the
    door with the leaf open at 0.12; the leaf closes behind him; the door fades
    on cue; the sign softens to brightness(0.85) while the room is empty; the
    peek and home beats are unchanged; under "less" none of it moves and the
    0.2s fades stay. Gates green (typecheck, lint, 76 tests, build). DONE,
    pending owner eyeball.
   - D-067 the door restaged AGAIN on the owner's eyeball verdict: the flat
     row (cloak, watcher, door all on one ground line) read as "a door down
     the street," not "a door at the back of the room." The owner named the
     artist technique he wanted (depth cues: the back figures on his paper
     sketch sit higher, not beside). Rebuilt on the four classic cues:
     higher feet (the door now stands on a back floor seam, --backH 60px
     wide / 48px stacked, drawn fainter than the front row and fading in and
     out with the door itself), smaller (door 96x210 to 88x192 wide, 76x168
     stacked; the watcher shrinks with honest perspective along the walk,
     1 to 0.97 to 0.94 to 0.91 to 0.88 on arrival, the 0.72 entry shrink
     stays), overlap (he still passes in front of the door, and the back
     seam emerges from behind his robe), atmospheric (door border and outer
     glow dimmed a step). The walk is now a diagonal upstage climb:
     translate(--walkX, -backH) with a bob that shrinks with distance.
     Beats, percentages, peek and home unchanged. Verified by seek; gates
     green. DONE, pending owner eyeball.
   - D-068 the watcher moved into the background (owner eyeball on D-067:
     the walk looked "dropped" into the scenery; his own follow-up note:
     door and watcher on one line would make the entry side-by-side, not
     backwards). The back-row resident, in two parts: he now rests ON the
     platform's near edge in his depth size (scale 0.88, feet on the seam
     within a pixel), and the platform gained real depth (--climbD: the
     door stands 31px deeper against the far wall, 24px stacked). The walk
     is a true recession: he crosses the platform climbing its depth and
     shrinking to 0.84, so every step moves him away from the viewer and
     toward the door at once. The seam is permanent (exists from load; the
     less-motion picture is him standing on his floor). The 0.72 doorway
     shrink, leaf beats, sign softening and full-size peek are unchanged;
     the peek now reads as the back-row resident suddenly huge at the edge
     of your world. Verified by seek on the stacked breakpoint (feet on
     seam, feet on threshold, cloak centre inside the door span); gates
     green. DONE, pending owner eyeball.
   - D-069 the figure shrunk and the peek made honest (owner screenshot
     verdict on D-068: the watcher towered over his own door, and the peek
     showed most of his body). Door-page figure 300px to 150px wide: at his
     platform rest he is about 153px against a 192px door, so the door is
     1.25 times the person. Geometry recomputed from the new fixed numbers
     (cloak centre 67, walkX 115 wide / 109 stacked, doorRight -76 / -64,
     foot offsets +2px). The peek now hides 56% of him behind a 16deg
     diagonal lean, so a sliver of hood and one craned eye is all that
     shows. Other Watcher instances untouched. Verified by seek (feet on
     seam and on threshold within a pixel, eye onscreen at the peek with
     most of the body offscreen); gates green. DONE, pending owner eyeball.
   - D-070 the wide scene hugs the text column (owner: "do build 1 as a
     proper architect", choosing both grid changes after seeing the first
     full-view capture). justify-self center to start kills the 143px dead
     air the D-069 shrink exposed; columns 1.35fr to 1.1fr pull the watch
     column right after the text. In the 1120 box the watcher now starts one
     grid gap past the title's last letter and covers the footer's G, the
     owner's two anchors, by structure not pixels. Title pays about 9
     percent of its wide size (it sizes by column, D-053), accepted. Phones
     keep their old centered staging via an explicit stacked override. Peek
     untouched: edge-pinned by measurement. Verified by real wide seeks at
     1200 innerWidth (anchors plus every beat), stacked seeks at 800 (no
     regression), and before/after 1500px headless captures; gates green.
     DONE, pending owner eyeball.
   - D-071 the door comes down to the title line and the peek measurement
     is hardened against stale layouts (owner: the peek was not coming from
     off screen, and the door's top belongs at the ZARCADE E level,
     horizontal position unchanged). Grid align-items to start; the story
     descends by calc(--doorRise + --titleLift), both stated as geometry,
     the title's 26px margin promoted to a shared variable. Door top to
     title top measured 0.1px on wide; phones untouched (stacked zeroes the
     margin). The stale-peek class is fixed at the source: the script
     re-measures on load, on fonts.ready and on every cycle's
     animationiteration, on top of resize, because the owner's open tab
     survived a deploy that moved the scene without firing resize. Poison
     and heal test passes. Anchors and every beat re-seeked on wide; gates
     green; after capture taken. DONE, pending owner eyeball.
- Definition of done: all six verified by machine in both motion modes, gates
  green, and the owner has seen the story cycle and the logo and reacted.

## Phase P — The arcade gets a home of its own
- Status: **PARKED by owner 2026-10-13.** The kit is built, verified and
  pushed; it resumes on the owner's word. With the repo staying private,
  the deploy-key appendix in deploy/SETUP-GUIDE.md is the active path for
  the server clone when it does.
- Goal: Zarcade live at zarcade.obestlink.com on a Hetzner machine (D-066),
  the wallet internal-only, fresh faucet-funded seed, one real public round
  proven end to end.
- Tasks:
  - Owner: Hetzner account (PayPal or bank, no credit card), order an
    Ubuntu 24.04 machine with at least 4GB of memory, console firewall
    (TCP 22/80/443), root password. Walkthrough: deploy/SETUP-GUIDE.md.
  - Owner decision pending: repo visibility (open item, raised 2026-10-13);
    the server clones from GitHub and the footer link currently 404s for
    visitors while the repo is private. History verified clean first.
  - Kit built: deploy/setup.sh (tools, 4G swap, Rust, Node 22, release
    build of the sidecar, website build, two systemd services with a
    random admin token, Caddy with automatic HTTPS, ufw + fail2ban) and
    the guide above (faucet and pot-split commands, Namecheap DNS,
    verification, upkeep, troubleshooting).
  - Setup session: clone + script, wallet generates its own fresh seed on
    first run, Zakura NU7 claim, split the pot into 40 notes.
  - Namecheap: one A record, host zarcade, reversible, nothing else touched.
  - Prove it: one full hidden round at the public address with a real txid
    on the canonical testnet; both halves survive a machine reboot.
- Definition of done: a stranger's browser can play a real round at
  zarcade.obestlink.com, the wallet never faces the internet, the machine
  reboots clean, and the session is logged in DECISIONS.md.

## Phase Q — The cabinets fill up (PROPOSED 2026-10-13, owner approval per game)
- Goal: the cheap honest games from the 2026-10-12 menu, one at a time,
  each with a scoping decision, a build, machine verification, and a real
  testnet payment round end to end.
- Tasks (proposed order):
  - Footer truth fix (open item in DECISIONS.md): copy and link match the
    private-repo reality before anything else ships on top of it.
  - Cabinet two: The Crowd. No new backend; reuses the send route and
    GameFrame; three challenges with real arcade records; the second
    challenge is impossible by design, and that is the lesson.
  - Cabinet three: The Proof Puzzle. One small read-only hash endpoint,
    no wallet changes.
  - Cabinet four: The Paper Trail. Transparent versus shielded contrast,
    cheap on the existing rails.
  - Not scheduled: Auditor's Key and Vault Run (new Rust wallet work),
    The Sealed Letter (conflicts with the D-025 memo guardrail),
    Double-Spend Heist (cannot be staged honestly).
- Definition of done per game: status flipped in lib/games.ts, a glyph
  named, all four gates green, a real hidden payment round played end to
  end, machine-verified beats, and the owner has played it and reacted.

---

**Rule:** We do not start Phase N+1 until Phase N's definition of done is met
and the owner confirms it.
