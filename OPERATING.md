# OPERATING.md: running Zarcade

This file is for whoever runs the arcade. The public front door is
[README.md](README.md). Two programs are involved, and the order matters:
the house wallet first, the site second.

## 1. The house wallet (the Rust sidecar)

It has to be running before the site can do anything that moves money.

```powershell
cd sidecar
$env:ZARCADE_ADMIN_TOKEN = "pick a long random string"
cargo run
```

- Needs a stable Rust toolchain. On Windows, also the Visual Studio Build
  Tools with the C++ workload.
- The first run takes a while: it creates the wallet, uses the bundled
  Sapling parameters (nothing is downloaded at runtime), and scans the chain
  from a pinned birthday height. Wait for `initial sync complete up to
  height …` before going further.
- It then listens on `http://127.0.0.1:9070`, an address only this machine
  can reach.
- The admin token unlocks exactly one maintenance command, the pot split
  below. Nothing in the game uses it. Leave it out and the sidecar still
  runs normally with that command switched off.
- Birthday warning: a rebuilt wallet must keep the pinned birthday height at
  or below 4,488,820, or the original deposit is invisible forever
  (`RESEARCH.md`, item H3).

## Funding the pot

Free testnet coins come from the Zakura NU7 faucet (https://zakura.com/nu7).
Send to the shielded deposit address: the sidecar prints it at startup, and
`GET /address` returns it.

Never use a faucet that pays on the abandoned pre-NU7 fork. The canonical
chain activated NU7 at height 4,465,026 on 2026-10-04, and coins from the
dead fork are invisible to this wallet (D-027). The sidecar connects to
`https://testnet.zec.rocks:443`.

## Before every session: split the pot

A shielded coin cannot be spent again until the network has agreed on the
payment that moved it, which takes about one block. With the pot sitting in
one large coin, that means one player every minute or two. Splitting it into
many small coins ahead of time lets players follow each other straight away
(D-031).

```powershell
powershell -File sidecar\split-pot.ps1
```

That is the whole command (D-037). It takes the token from
`ZARCADE_ADMIN_TOKEN`, checks the wallet is up, states the fee it expects
before it starts, and refuses if the pot cannot cover the cost or if a coin
would be born too small to ever spend. It then watches the transaction land
and tells you when the coins are ready. Pass `-Yes` to skip the
confirmation, or `-Notes` and `-PerNote` to change the shape.

Facts to plan with:

- Allow about eight minutes for the default 40 coins: one zero-knowledge
  proof per coin, roughly twelve seconds each. Run it before people arrive,
  not while they wait, because nobody can play during it. Anyone who tries
  is told the arcade is refilling rather than being left to wonder (D-035).
- The fee is 5,000 zatoshis per logical action (ZIP-317). For 40 coins paid
  out of one large coin that is 205,000. It rises if the wallet has to
  gather money from several small coins instead, because inputs count as
  actions too (`RESEARCH.md`, item I7).
- Every coin must be worth more than 5,000 zatoshis, or the wallet treats it
  as dust and will never spend it (`RESEARCH.md`, items I5 and I7).
- The coins stay in the house wallet, so the only real cost is the fee.

## 2. The site

```powershell
npm install
npm run dev
```

Open the URL it prints. Then load `/api/house/status` in the browser:
`"ok": true` means the site can see the wallet. For a production run use
`npm run build` followed by `npm run start`; the sidecar still comes first
either way.

## The gates, which must all stay green

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```

## You never have to manage a wallet

There is no seed phrase to write down, no private key to keep safe, and
nothing to fund beyond the free faucet claim. The sidecar creates the wallet
on first run and keeps it in `sidecar/data/`, which is gitignored. The money
in it is free testnet coins, the arcade's own pot rather than anybody's
savings. The one thing that matters: `sidecar/data/` is never committed and
never screenshotted, and the `.gitignore` in that folder already handles the
first half.

## Session checklist

- [ ] Sidecar running, initial sync complete.
- [ ] `/api/house/status` answers `"ok": true` and `"readyForRound": true`.
- [ ] Spendable balance covers the session: 1,000 zatoshis plus fee per
      round.
- [ ] The pot was split recently. If `409 settling` keeps appearing, split
      again.
- [ ] Site starts, the door lands in about two seconds, a full round can be
      played end to end.

## When something goes wrong

| What you see | What it usually means |
| --- | --- |
| `/api/house/status` answers 503 | The sidecar is not running. Start it first. |
| A round answers `409` with `code: "settling"` | Normal, not a fault. The wallet has no confirmed coin to spend right now. If this keeps happening, the pot has not been split, or the split's small coins have run out. Run the split again. See `RESEARCH.md` items I1 and I7. |
| A round answers 503 | The sidecar stopped, or it cannot reach `testnet.zec.rocks`. |
| The balance reads 0 when it should not | The wallet was rebuilt without the pinned birthday height. The birthday must be at or below 4,488,820 or the original deposit is invisible forever. See `RESEARCH.md` item H3. |
| A payment is slow | Building the zero-knowledge proof is the expensive part, about twelve seconds. See `RESEARCH.md` item I2 for the measured numbers. |
| The motion choice seems ignored on a fresh load | Should be impossible since D-051 (the pre-paint script). If it ever happens again, check that `app/layout.tsx` still carries the inline script and that `data-motion` lands on `<html>` before paint. |
