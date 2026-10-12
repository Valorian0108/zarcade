# ARCHITECTURE

> **Status:** **APPROVED v1 (2026-10-10)** — D-012. Stack, testnet wiring, and
> the real-vs-represented plan approved. The design foundation is per **D-009**
> — the owner **reacts & corrects** it on first visible build; final version
> encoded as a locked rule.

## Stack (proposed)

- **Next.js + TypeScript** — same stack as Trust Layer; owner already knows it.
- **Tailwind CSS + shadcn/ui + Radix UI** — this *is* the adopted design system
  (D-009): a senior color palette, type scale, spacing, and accessible
  components, pre-decided. We tune it; we don't reinvent it.
- **Motion (Framer Motion)** — the "seal / reveal" transitions that teach.
- **Quality gates (senior tooling):** TypeScript `strict`, ESLint, Vitest,
  typecheck — so neither human nor LLM drifts into sloppy code.

## Network — Zcash TESTNET (DECIDED, D-008; rewired by D-024, D-027, D-028)

The original plan was a lightwalletd gRPC-web proxy plus an in-browser WASM
decoder. **Superseded by D-024.** What is actually built:

- **A Rust sidecar** (`sidecar/`) owns the wallet. It links
  `zcash_client_backend` / `zcash_client_sqlite` directly, speaks gRPC over TLS to
  a public lightwalletd, then builds, proves and signs transactions itself.
- **Proving is server-side with the parameters bundled into the binary**
  (`bundled-prover`), so there is no ~50MB download and no in-browser proof.
- **It binds `127.0.0.1:9070` only.** Players never reach it. The Next.js server
  reaches it, and the secret key never crosses that link (D-025).
- **Which chain (D-027):** the canonical NU7 testnet, magic `fa1af9bf`, served by
  `testnet.zec.rocks:443` and indexed by `testnet.zecblock.com`. The pre-NU7 fork
  (`zexplorer.app`, `blockexplorer.one`) is abandoned and must never be linked.
- **Which crates (D-028):** the `=`-pinned NU7-aware pre-release set. Stable 0.24
  ships NU7 as a stub and no `--cfg zcash_unstable="nu7"` flag can fix it.
- **Faucet:** Zakura, `https://zakura.com/nu7`, 0.125 TAZ per address per 24h.
- **Client-side decoding: dropped.** Nothing in the browser needs a viewing key,
  because the sidecar already knows exactly what it sent.
- **Pacing (D-031):** a shielded coin cannot be spent again until the network has
  agreed on the payment that moved it, so a pot held as one large coin means one
  player every minute or two. `POST /admin/split` breaks it into many small coins
  in a single transaction, run by hand before a session through
  `sidecar/split-pot.ps1` (D-037). Maintenance only: it is behind a token, the
  bridge does not proxy it, and every coin it makes is paid to the house itself,
  so it cannot be used to move money out. Measured in RESEARCH I7 and I8.
- **Refilling (D-035, D-036):** a split holds the wallet's single mutex for its
  whole run, about eight minutes. A round requested mid-split would otherwise
  queue behind it, time out, and be reported to the player as a failure while the
  wallet might still carry it out afterwards. Two layers stop that.
  - The bridge asks `/health` first, which is the one sidecar call that does not
    need the mutex, and refuses in about 100 ms with status 503 and
    `code: "refilling"` before it books a round or touches the wallet at all.
    Nothing is booked, so there is nothing to refund. This check deliberately
    sits *before* the rate-limit check even though that reads oddly: the rate
    check and the booking must run with nothing awaited between them, or two
    requests arriving together could both pass, so the await has to live outside
    that pair. Do not "tidy" it downwards.
  - Behind that, the sidecar keeps its own `refilling` flag *outside* the mutex
    and refuses `/send` in roughly 25 ms, as a backstop for anything that reaches
    it directly. On that path the bridge has already booked the round, so it gives
    the allowance back, which is safe because the refusal happens before anything
    is built or paid.

  A drop guard clears the flag, so a split that fails or is abandoned cannot leave
  the arcade permanently refusing players. `/api/house/status` asks the same
  question first for the same reason, and answers `refilling: true` with no
  balance figures rather than blocking on a wallet that is only busy.
- **`GET /health`** publishes that same flag without touching the wallet, which
  makes it the one endpoint that stays fast during a refill (1.6 ms measured,
  against 505 ms when it waited on the lock) and the only side-effect-free way to
  observe it. It returns `synced_to: null` while the wallet is busy rather than
  hanging, because a health endpoint that blocks is worse than one that admits it
  could not read the height.
- **`GET /tx-status`:** reports the block a given payment landed in and how many
  blocks have been built on top. This is what lets the game show a payment
  arriving as a real event rather than a countdown. It reads the wallet's own
  records first and only goes to the network while the payment is still
  unconfirmed, so polling it cannot slow down the next player's round.

## Real vs. represented for G1 (the honesty line)

- **REAL:** the transparent send, the shielded send, the network fee, and the
  block the payment lands in. Every round broadcasts a real transaction to the
  canonical testnet, and the player is handed the explorer link
  (`https://testnet.zecblock.com/tx/<txid>`) to check it themselves. The block
  number is not a timer dressed up as one: it comes from `GET /tx-status`, which
  reads it off the chain, so the moment the game says a payment has landed is the
  moment the network actually put it in a block.
- **REAL:** the "what the public sees" panel. It states rules of the network —
  is the amount visible, is the recipient visible, can this payment carry a note
  at all. Those are facts rather than our opinion, and the link beside them lets
  the player verify.
- **REAL, and corrected by the chain (2026-10-12):** the panel reports the sender
  as hidden on **both** branches. It originally claimed an open payment named its
  sender, which is wrong, because the house coins sit in the shielded pool and an
  open payment is therefore an *unshielding* one: destination and amount go in the
  clear, but the notes that paid for them reveal only nullifiers. Verified against
  real tx `c97af953…624fa7e5` (RESEARCH H7). The leak meter reads this fact rather
  than the branch, so it cannot drift from it.
- **REPRESENTED (the game layer):** the watcher, the belt, the rounds, win/lose,
  and the characters. It's a game and is meant to teach — that's intended, not
  fake.
- **REPRESENTED (the recipient):** both branches pay an address the arcade
  itself owns (D-030) — the shielded deposit address when hidden, the house's
  own transparent address when open. Coins stay in the house, so a round is
  repeatable all day and no third party can vanish on us. **Stated plainly
  in-game as of B5 (D-040):** the intro says both destinations belong to the
  arcade and that this is practice money. There is no recipient character, so
  nothing on screen implies a stranger is being paid.
- **Naming (D-029):** the shielded pool is "Ironwood, the private pool" on first
  mention and "the private pool" afterwards, because that is what the explorer
  shows for our real transactions. Earlier documents in this folder that say
  "Sapling" are wrong about where the house funds actually sit.
- **v1 proves server-side** (D-024). Live in-browser proving remains a later
  upgrade, not an MVP blocker.

## Design foundation (PROPOSED — D-009; judge it visually, correct by reaction)

Plain English first, tokens second.

- **Concept:** "hidden vs. visible signal." Deep charcoal stage. One confident
  **gold/amber accent** (ties to Zcash's identity, reads premium not neon).
  **Shielded** = sealed, glowing, locked. **Exposed/leaked** = desaturated red.
- **Type:** one display face for headings + a **monospace for on-chain data**
  (data reads as code — thematically perfect) + a readable body face. A modular
  size scale. Two families total.
- **Color:** neutral charcoal ramp + gold accent + semantic **green = valid**,
  **red = leak**. Contrast-checked (WCAG). Built with an OKLCH / Radix method so
  the ramps stay even.
- **Spacing:** an 8pt scale; a readable column for explanations; full-bleed for
  the game stage.
- **Components:** shadcn/ui + Radix (engineered, accessible — not hand-rolled).
- **Motion:** restrained. A "seal/encrypt" transition when data hides, a
  "reveal" when it shows. Motion *is* the teaching — you watch data get sealed.
- **Layout:** the arcade hub = a grid of game "cabinets"; each game = a focused
  stage + the watcher + a plain-language explanation panel.

> The owner does not need to know these terms. React in plain words ("too dark,"
> "the red is aggressive," "bigger buttons") and the system translates it.

## Project layout

```
zcash/
  (the .md docs — source of truth)
  app/
    page.tsx                     # the arcade hub (lobby)
    games/unseen/                # G1
    api/house/status/route.ts    # GET  read-only wallet status
    api/game/unseen/send/route.ts# POST the only route that can move money
  components/                    # shadcn/ui + game parts (frame, watcher, hub)
  lib/
    games.ts                     # the data-driven cabinet list (D-019)
    zcash/                       # the bridge: config, guardrails, rate-store,
                                 #   sidecar client, formatting (see its README)
  sidecar/                       # Rust: the house wallet (D-024), localhost-only
    src/wallet.rs                #   init, sync, balance, send, both addresses
    src/main.rs                  #   the HTTP surface
    src/bin/probe.rs             #   chain diagnostic (this is what found D-027)
    data/                        #   seed.hex (SECRET), wallet.sqlite, addresses
```

Design tokens live in `app/globals.css` as CSS variables (Tailwind v4).
`sidecar/data/` is gitignored; it holds the only secret in the project.

## Open

- [x] Owner approval of this plan (stack + wiring + real/represented) — D-012.
- [ ] Design corrections after the first visible build (D-009).
- [ ] B5: state the self-payment plainly in-game, and apply D-029 naming to the
      game copy.
- [ ] Sweep the remaining docs for "Sapling" where they mean the pool the house
      funds actually sit in (Ironwood).
