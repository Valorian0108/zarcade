# Zcash Interactive Experience — Project Home

> **Name:** Zarcade (D-022)
> **Target:** The Zecathon — Track 05: Wildcard (Art / Education / Games). The track
> is still an open decision; see `DECISIONS.md`.
> **Status:** Building. Phase 1 (the design foundation) is complete and approved.
> Phase 2 (the real chain) is in progress: B1–B4 are done, B5 is next.
> See `ROADMAP.md` for the exact state of each step.

## What this project is

An interactive, visual experience that **explains how Zcash protects data by
showing it happen in real time** — using real Zcash network interactions, not
simulations. Built for The Zecathon hackathon.

## How we work (the accountability agreement)

1. **The owner proposes and decides. The AI advises and drafts.** Every material
   decision is presented with options + trade-offs + a recommendation, but the
   owner approves or changes it. Nothing is built on an AI assumption.
2. **Nothing is built until it is written down and approved.** Order of work:
   Vision → Research → Scope → Architecture → Decisions → Roadmap → Code.
3. **Every decision is logged** in `DECISIONS.md` with the *why*, the
   alternatives considered, and who decided.
4. **Open questions stay visible.** Gaps are never silently filled with generic
   defaults; they live in the open-decisions list until the owner chooses.
5. **The owner owns the documents.** The AI drafts; the owner reviews, edits,
   and approves. The docs are the source of truth — not the chat history.

## Document map (build in this order)

| # | Document | Purpose | State |
|---|----------|---------|-------|
| 1 | `VISION.md` | The why, audience, goal, core promise, what it IS / IS NOT | **Approved v1** (2026-10-10) |
| 2 | `RESEARCH.md` | The Zcash knowledge base; what's real vs. simulated | Filled A–E, G, H, I — researched live, incl. the testnet chain split and measured round timings |
| 3 | `SCOPE.md` | What's IN / OUT; the games; priorities; MVP definition | **Approved v1** (2026-10-10) |
| 4 | `ARCHITECTURE.md` | Stack, Zcash integration, visual system, layout | **Approved v1** (2026-10-10); network + honesty sections rewritten 2026-10-11 to match what was actually built |
| 4b | `OUTLINE.md` | Master blueprint: pages, components, characters, microinteractions, G1 breakdown, wiring | **Approved v1** (2026-10-10) |
| 4c | `STYLEGUIDE.md` | Design foundation: ① slop-gate process, ② game-feel motion spec, ③ the look | **v1.1** (2026-10-10) — all three layers **approved** (D-013/D-014/D-015); display font = Syne (D-017) |
| 5 | `DECISIONS.md` | Running log of every decision + why + who decided | Ongoing — D-001…D-030 logged, plus a visible list of what is still open |
| 6 | `ROADMAP.md` | Phases in order, each with a definition of done | Ongoing — Phase 1 DONE; Phase 2 B1–B4 DONE, B5 next |

**The gate has been passed:** all six documents exist and were approved before any
code was written. Code now changes only what a logged decision authorises.

## Directory layout

```
zcash/
  README.md          # this file — the agreement + map
  VISION.md
  RESEARCH.md
  SCOPE.md
  OUTLINE.md
  STYLEGUIDE.md
  ARCHITECTURE.md
  DECISIONS.md
  ROADMAP.md
  app/               # the site: the hub, the game page, and two API routes
  components/        # shadcn/ui plus the game's own parts
  lib/
    games.ts         # the hub's cabinet list, the single source of truth (D-019)
    zcash/           # the bridge to the house wallet — see lib/zcash/README.md
  sidecar/           # Rust: the house wallet itself (D-024)
    data/            # SECRET and gitignored — seed.hex, wallet.sqlite
```

## How to run it

Two programs, and the order matters.

**1. The house wallet (the Rust sidecar).** It has to be running before the site
can do anything that moves money.

```powershell
cd sidecar
$env:ZARCADE_ADMIN_TOKEN = "pick a long random string"
cargo run
```

The first run takes a while: it creates the wallet, then downloads and scans the
chain from a pinned birthday height. Wait for `initial sync complete up to
height …` before going further. It then listens on `http://127.0.0.1:9070`, an
address only this machine can reach.

That token unlocks one maintenance command, described below. Nothing in the game
uses it, and if you leave it out the sidecar still runs normally with that
command switched off.

Needs Rust, and on Windows the Visual Studio Build Tools C++ workload.

**Before a session: split the pot.** A shielded coin cannot be spent again until
the network has agreed on the payment that moved it, which takes about one block.
With the pot sitting in one large coin, that means one player every minute or
two. Splitting it into many small coins once, ahead of time, lets players follow
each other straight away (D-031).

```powershell
powershell -File sidecar\split-pot.ps1
```

That is the whole command (D-037). It takes the token from `ZARCADE_ADMIN_TOKEN`,
checks the wallet is up, states the fee it expects before it starts, and refuses
if the pot cannot cover the cost or if a coin would be born too small to ever
spend. It then watches the transaction land and tells you when the coins are ready
to use. Pass `-Yes` to skip the confirmation, or `-Notes` and `-PerNote` to change
the shape.

Allow about eight minutes for the default 40 coins: it builds a zero-knowledge
proof for every one of them, at roughly twelve seconds each. Run it before people
arrive, not while they are waiting, because nobody can play during it. Anyone who
does try is told the arcade is refilling rather than being left to wait, so
nothing looks broken (D-035).

The coins stay in the house, so the only real cost is the fee, which is 5,000
zatoshis per logical action. For 40 coins paid out of one large coin that is
205,000; it rises if the wallet has to gather the money from several small coins
instead, because inputs count as actions too (RESEARCH I7). Each coin must be
worth more than 5,000 zatoshis or the wallet treats it as dust and will never
spend it. See RESEARCH I5 and I7.

**2. The site.**

```powershell
npm install
npm run dev
```

Open the URL it prints. Then load `/api/house/status` in the browser: `ok: true`
means the site can see the wallet.

**The gates, which must all stay green:**

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

### You never have to manage a wallet

There is no seed phrase for you to write down, no private key to keep safe, and
nothing to fund. The sidecar creates the wallet on first run and keeps it in
`sidecar/data/`, which is gitignored. The money in it is free testnet coins from
a public faucet, and it is the arcade's own pot rather than anybody's savings.
The one thing that matters is that `sidecar/data/` is never committed and never
screenshotted, and the `.gitignore` in this folder already handles the first
half of that.

### When something goes wrong

| What you see | What it usually means |
| --- | --- |
| `/api/house/status` answers 503 | The sidecar is not running. Start it first. |
| A round answers `409` with `code: "settling"` | Normal, not a fault. The wallet has no confirmed coin to spend right now. If this keeps happening, the pot has not been split, or the split's small coins have run out. Run the split again. See RESEARCH I1 and I7. |
| A round answers 503 | The sidecar stopped, or it cannot reach `testnet.zec.rocks`. |
| The balance reads 0 when it should not | The wallet was rebuilt without the pinned birthday height. The birthday must be ≤ 4,488,820 or the original deposit is invisible forever. See RESEARCH H3. |
| A payment is slow | Building the zero-knowledge proof is the expensive part. See RESEARCH I2 for the measured numbers. |
