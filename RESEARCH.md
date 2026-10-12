# RESEARCH — The Zcash Knowledge Base

> **Status:** Sections A–C drafted in plain language (2026-10-10); **owner
> confirmed the click on 2026-10-10** — the "hides meaning, not existence" model
> is understood. **Sections D–E FILLED 2026-10-10** (researched live against the
> 2026 network); the two Phase B decisions they gate (funding model; where the
> proofs are made) now await the owner's click. Section F fills in as scope is
> decided.
>
> **The golden line:** for every topic we note whether our build will use the
> **REAL** network behavior or a **VISUAL/teaching** representation — and why.
>
> **Fact vs. representation (added 2026-10-10, per D-003):** the *mechanics* in
> A–C (what's public, what's hidden, pools, proofs, nullifiers, viewing keys)
> are Zcash protocol **facts**. The *imagery* used to teach them (envelopes,
> vaults, jar, Alice/Bob, the Observer, conveyor belt) is **PROPOSED visual
> language only — NOT approved.** The owner chooses the final visual
> representation at visual-design time (VISION.md §9). Until then every
> metaphor is labeled [PROPOSED] and must not be treated as settled content.

---

## A. Zcash fundamentals

### A1. Transparent vs. shielded

- **Transparent (t-addr):** like Bitcoin. Every transaction publishes sender,
  receiver, and amount, forever, to everyone. A **glass envelope** — anyone can
  read it, anytime.
- **Shielded (z-addr):** the chain publishes a *proof* plus opaque blobs. Who
  sent, who received, and how much are mathematically hidden. A **sealed
  envelope** — anyone can verify it's a real, valid envelope *without opening it*.
- Same chain, same coin. Privacy is a **choice per address/transaction**, not a
  different currency.

### A2. The three pools

- **Transparent pool, Sapling pool, Orchard pool** = three vaults holding coins,
  with different privacy technology. Orchard is newest/strongest; Sapling is the
  workhorse; transparent = no privacy.
- Your coins sit in one pool. Moving between pools = **shielding** (t→z),
  **unshielding** (z→t), or upgrading (Sapling→Orchard).
- **Teaching nuance:** crossing pools leaks. A t→z shield reveals the source
  address and amount on the transparent side. Fully private = born shielded,
  stays shielded (z→z).

### A3. Why Zcash is NOT a mixer

- **Mixer:** everyone drops coins into one public jar, waits, then withdraws to
  a fresh address. Privacy = being lost in the crowd. The jar is public, you
  must wait, and a small crowd is traceable.
- **Zcash:** there is no jar. Each shielded transaction carries its own
  mathematical proof of validity. Privacy = the data was **never revealed at
  all**. No waiting, no crowd required.
- One line: *mixers hide you in the noise; Zcash makes the signal itself
  invisible.*

---

## B. The cryptography, taught visually

### B1. Zero-knowledge proof (zk-SNARK)

- The **statement:** "this transaction is valid" (the inputs exist, the amounts
  balance, nothing is double-spent).
- The **prover** knows the secret data (the *witness*). They compute a tiny
  **proof**. The **verifier** checks the proof in milliseconds and is convinced —
  while learning *nothing* about the witness.
- **Image [PROPOSED]:** a sealed box plus a tiny glowing token. The token convinces anyone
  that the box holds a valid transaction. The box never opens.

### B2. Commitment (the sealed envelope)

- Commit to a value now; reveal it later (or never). The commitment is public,
  the content is hidden, and it's *binding* — content can't change after committing.
- In Zcash, each shielded coin (a **note**) lives on-chain as a commitment. The
  chain stores sealed envelopes, not visible coins.

### B3. Nullifier (the shadow)

- To spend a note you publish its **nullifier**: a unique tag derived from the
  note and your key. It reveals nothing about the note — but if the same
  nullifier ever appears twice, that's a double-spend and it's rejected.
- **Image [PROPOSED]:** spending a note casts a shadow on a public board. The network only
  checks "has this shadow been here before?" It never learns which note cast it.
- Commitments + nullifiers = the chain can prove coins exist and are spent once,
  without ever knowing whose they are.

### B4. Viewing key (the auditor's copy)

- Your shielded history is a locked diary. The **viewing key** is a copy of the
  lock's key: whoever holds it can *read* your transactions (amounts,
  counterparties) but **cannot spend**.
- **Selective disclosure:** hand it to an auditor, a tax office, a friend — and
  only them. Everyone else still sees nothing.
- **Spending key vs. viewing key:** spending moves money (never share); viewing
  only reveals (share deliberately).

---

## C. Addresses & what's actually public

### C1. Unified Addresses (UA)

- One address that bundles receivers for several pools (transparent, Sapling,
  Orchard). The sender's wallet picks the strongest one the recipient supports.
- **Image [PROPOSED]:** one mailing address with several mailboxes behind it; the letter
  routes to the best available box.

### C2. What a shielded transaction publishes — and hides

**Public on-chain:** the proof · nullifiers of spent notes · new commitments
(created notes) · a value commitment (proves in = out + fee without revealing
amounts) · encrypted memo (ciphertext) · the fee · rough size/timing.

**Hidden:** sender · receiver · amounts · memo content.

### C3. What STILL leaks (the honesty section)

- The **fee** is public. **Timing and size** are metadata. **Crossing pools**
  (t→z) exposes the transparent side.
- "Does not leak" is a discipline, not a magic switch: full privacy =
  shielded-to-shielded, metadata-aware. This is great teaching material — the
  experience can show these leaks too, not hide them.

---

## D. Network access — FILLED 2026-10-10 (researched live)

- [x] **Testnet vs. mainnet — testnet** (D-008). Live and active in 2026
      (explorers show blocks every few seconds; privacy mix ~84% private).
      Coins are free and worthless, so a demo mistake costs nothing. The
      hackathon accepts testnet. REAL network, REAL transactions.
- [x] **lightwalletd — the light-client gateway.** It speaks gRPC
      (`CompactTxStreamer`, ZIP-307): `GetLatestBlock`, `GetBlockRange`,
      `GetTransaction`, and `SendTransaction` (broadcast). It sits in front of a
      full node. **2026 node reality:** `zcashd` reached end-of-support and
      auto-halted at block 3,417,100 on 2026-07-18 (no NU6.3); the maintained
      stack is **Zebra** (node) + **Zaino** (indexer) + **lightwalletd** (Go) or
      **lightwalletd-rs** (Rust, adds a native `--grpc-web` flag). Public testnet
      endpoint **(corrected 2026-10-11)**: `https://testnet.zec.rocks:443`
      (native gRPC). The formerly noted `testnet.lightwalletd.com:9067` belonged
      to Nighthawk Apps, who decommissioned lightwalletd.com on 2024-05-31
      (funding); the domain no longer resolves. `testnet.zec.rocks` is the
      default server preset ("zecrocks") in `zcash/zcash-devtool` (the
      librustzcash team's own CLI, source checked 2026-10-11); verified from
      this machine: DNS resolves (66.241.124.102), TCP 443 open. YWallet's
      lwd1-8.zcash-infra.com fleet serves mainnet only.
      **Browsers cannot speak gRPC**, so a gRPC-web proxy (ChainSafe's hosted
      proxy, Envoy, or lightwalletd-rs `--grpc-web`) is needed ONLY if a wallet
      runs in the browser. **Our v1 server helper talks native gRPC
      server-side, so no proxy is needed.**
- [x] **Faucets — free TAZ.** `fauzec.com` (mines on demand, shielded by
      default, no signup); `zcashfaucet.jinolabs.xyz` (0.1 TAZ per small
      browser proof-of-work, sent as a shielded z2z tx; runs off a public
      lightwalletd/Zaino endpoint, no full node); `zcash/zfaucet` (Django,
      transparent + shielded); ZecHub Discord as a human fallback.
      **Teaching gift:** modern faucets pay **shielded by default**, so our
      treasury's coins arrive already private. That makes the
      shielded-to-shielded send (the strongest lesson) the natural demo.
      **CORRECTION 2026-10-11 (see section H, D-027):** `fauzec.com` and
      `zcashfaucet.jinolabs.xyz` both pay on the **abandoned pre-NU7 fork**,
      not the canonical testnet, so their coins are invisible to any wallet
      that follows the real chain. The faucet that pays on the canonical NU7
      chain is the **Zakura NU7 faucet** (`https://zakura.com/nu7`, labelled
      "verified for Public Testnet"; 0.125 TAZ per address per 24h; accepts
      `tm…`, `t2…` or `utest1…`). ZecHub's faucet list had not been updated
      for NU7 and still points at the fork faucets.
- [x] **Explorers — showing real txs.** `zexplorer.app/testnet` (labels each tx
      private/public and shows fees and the network privacy mix; the best fit
      for our "what the public sees" panel); `testnet.cipherscan.app` (shows
      shielded activity with amounts masked; pairs with the
      `@cipherscan/zcash-decoder` library); backups `testnet.zcashexplorer.app`
      and `testnet.zecblock.com`. REAL chain data, linked from the game so the
      player can verify with their own eyes.
      **CORRECTION 2026-10-11 (see section H):** `zexplorer.app/testnet` and
      `blockexplorer.one` index the **fork**, not the canonical chain, so a tx
      they display may not exist on the real testnet. Use
      `testnet.zecblock.com` (verified to agree with `testnet.zec.rocks`
      block-for-block) and the Zakura NU7 dashboard instead.
- [x] **Funding model (Phase B) — RESOLVED 2026-10-11 (D-025): option A,
      central testnet treasury + no player login.** Research
      confirms: Zcash still has **no smart contracts and no ERC-4337 paymaster**;
      fees are the ZIP-317 minimum (a few thousandths of a cent); testnet coins
      are free. Options: **(A) central testnet treasury** we fund once from a
      faucet; a server-side signer holds the keys and signs/broadcasts each demo
      tx; the player connects and funds nothing. **(B)** per-session in-browser
      wallet via WebZjs (possible, but ~60MB WASM + COOP/COEP headers + long
      sync = a bad demo). **(C)** user pastes their own testnet key (bad UX,
      scary). **Recommendation: A.** Accepted trade-off: the coins are the
      house's test coins; the privacy lesson (what is public vs. hidden) stays
      fully REAL. See DECISIONS.md "Funding model / paymaster question".

## E. SDKs & tooling — FILLED 2026-10-10 (researched live)

- [x] **Browser/WASM options for creating shielded transactions.**
      **WebZjs** (`@chainsafe/webzjs-wallet`): a full shielded wallet in the
      browser; ~60MB WASM binary; needs a gRPC-web proxy and COOP/COEP headers
      (SharedArrayBuffer); syncs in a web worker; powers the MetaMask Zcash
      Snap. **t2z** (`@d4mr/t2z-wasm`, Dec 2025): transparent-to-Orchard only,
      via the PCZT format (ZIP-374); **no big download** (Orchard uses Halo2,
      proving key built on demand ~10s then cached); testnet supported; but it
      has **no shielded inputs and no Sapling outputs**, so it cannot do the
      shielded-to-shielded send that is G1's core lesson.
- [x] **Client-side vs. server-helper proof generation — RESOLVED 2026-10-11
      (D-024): server-helper for v1.** Reasons: (1) G1 needs a
      shielded SPEND (z-to-z), which t2z cannot do and WebZjs does only at ~60MB
      + sync cost on the player's device; (2) a server can download the
      parameters once, cache them, and keep a warm prover, so each demo send
      takes seconds; (3) the player's device stays light and the demo never
      stalls on a download. Concrete shape: a small **Rust sidecar** built on the
      official `librustzcash` crates (`zcash_client_backend` +
      `zcash_client_sqlite` + `zcash_proofs`), holding the treasury keys, syncing
      through testnet lightwalletd, and exposing a tiny JSON API (balance, send
      shielded, send transparent, decode tx) to the Next.js server helper.
      In-browser proving (WebZjs) stays a later upgrade if the owner ever wants
      a "this is your wallet" feel.
- [x] **Proof-parameter weight and its UX implications.** Sapling:
      `sapling-spend.params` = 47,958,396 bytes (~48MB) + `sapling-output.params`
      = 3,592,860 bytes (~3.6MB), ~51.5MB total, hash-verified from
      `download.z.cash` (a 2026 grant is adding multi-origin fallback because
      single-origin param downloads have caused real "can't spend" outages).
      Orchard: Halo2 proving key either bundled (~50MiB in-binary) or built on
      demand (~10s). **UX verdict: far too heavy for a page load; keep it on the
      server.** On the server it is a one-time deploy download, cached to disk,
      prover kept warm.
- [x] **Proving toolchain (Phase B) — the "zk" the owner asked about, updated.**
      "Installing the zk" = running the Rust sidecar with `librustzcash` + the
      parameters above. It lives on OUR server, never on the player's device.
      Two 2026 corrections to earlier notes: the node behind lightwalletd must
      be **Zebra** (zcashd is dead), and a brand-new post-NU6.3 pool called
      **Ironwood** now exists. Our teaching stays on the Sapling/Orchard ideas;
      the implementation uses Unified Addresses and lets the wallet pick the
      strongest pool, so the lesson does not depend on which pool a note lands
      in. Flag for Phase B: confirm which pool the faucet pays into and target
      that.
- [x] **Privy (owner question, researched 2026-10-11).** Privy (privy.io) is an
      embedded-wallet + login SDK: email/social login, instant per-user wallets,
      no seed phrases, gas sponsorship, 160M+ accounts. Exactly the right
      instinct for "players own nothing", but its supported chains are EVM,
      Solana, Bitcoin (raw-key only), TRON, Stellar, Cosmos, Sui, NEAR, TON.
      **No Zcash, transparent or shielded.** Its signature features (account
      abstraction, smart accounts, gas sponsorship) rely on smart-contract
      chains; Zcash deliberately has none (see D), and shielded Zcash needs the
      heavy proving machinery (~51.5MB params) Privy does not run. The raw-key
      escape hatch could theoretically drive Zcash's *transparent* layer, but
      that means hand-rolling our own Zcash tx stack AND is the non-private
      side, which would gut the lesson. Verdict: Privy cannot be the wallet or
      login layer for this project. The closest browser-native equivalent for
      Zcash is the MetaMask Zcash Snap (ChainSafe WebZjs), already evaluated as
      option B and rejected for v1 on demo weight (~60MB + sync). Revisit only
      if Privy ever adds Zcash or the project grows EVM legs.
- [x] **B1 implementation notes (2026-10-11, after D-026).** Verified on
      crates.io today: `zcash_client_backend` **0.24.0** stable (with the
      `lightwalletd-tonic-*` features it talks native gRPC+TLS directly to a
      lightwalletd server, so no gRPC-web proxy is needed server-side; the
      endpoint is `https://testnet.zec.rocks:443`, see section B correction) and `zcash_client_sqlite` **0.22.0** stable (the wallet
      database; default features include multicore + orchard). Both were
      published 2026-10-06, so the stack is actively maintained.
      `zcash_proofs` handles the one-time Sapling params download (~51.5MB,
      hash-verified); Orchard needs no params download. Sidecar shape: axum +
      tokio serving a localhost JSON API (`/health`, `/address`, `/balance`,
      `/send` for the shielded z-to-z lesson tx, plus a transparent contrast
      send); the spending key and the SQLite DB never leave the sidecar's data
      directory. Fresh wallet = birthday at the current chain height, so the
      first sync scans only new blocks (minutes, not years). Windows note per
      D-026: the MSVC Build Tools provide the C compiler that rusqlite's
      bundled SQLite needs.

## F. The "real vs. represented" ledger

| Feature | Real or Represented | Why |
|---------|--------------------|-----|
| _(filled as scope is decided)_ | | |

## G. Sidecar API reference (verified against the downloaded source, 2026-10-11)

Every call below was read out of the exact crate sources cargo downloaded
(`zcash_client_backend` 0.24.0, `zcash_client_sqlite` 0.22.0,
`zcash_proofs` 0.30.0, `zcash_keys` 0.16.1, `zcash_protocol` 0.10.6),
not from memory or tutorials.

- **Wallet DB**: `WalletDb::for_path(path, Network::TestNetwork, SystemClock, OsRng)`
  then `init_wallet_db(&mut db, Some(Secret::new(seed)))` (idempotent, migrates).
- **Account**: `db.create_account("house", &Secret::new(seed), &birthday, None)`
  returns `(AccountUuid, UnifiedSpendingKey)`. Birthday =
  `AccountBirthday::from_parts(ChainState::empty(tip_height, BlockHash(hash)), None)`
  with the tip taken from lightwalletd, so the first sync is short.
- **Spending key on restart**: `UnifiedSpendingKey::from_seed(&Network::TestNetwork,
  &seed, zip32::AccountId::try_from(0u32)?)`. Index is always 0 because the
  sidecar creates exactly one account.
- **Deposit address**: `db.get_next_available_address(account,
  UnifiedAddressRequest::SHIELDED)` returns `(UnifiedAddress, DiversifierIndex)`;
  encode with `ua.encode(&Network::TestNetwork)`. Because this call advances the
  diversifier index, the address is generated once and cached in
  `data/address.txt` so it never rotates across restarts.
- **Parsing player/contrast addresses**: `Address::decode(&Network::TestNetwork, s)`
  (`zcash_keys::address::Address` covers both unified and transparent forms).
- **Sync**: `zcash_client_backend::sync::run(&mut client, &params, &cache,
  &mut wallet, batch_size)`. The cache must implement the `BlockCache` trait
  (`async_trait`: `get_tip_height`, `read`, `insert`, `delete`; `truncate` has a
  default) plus `BlockSource`. `zcash_client_sqlite::BlockDb` has no public write
  API, so the sidecar uses a small in-memory `MemBlockCache` (safe because the
  birthday is the tip: ranges are short and anything unscanned is re-downloaded).
  **`BlockSource::with_blocks(from_height, limit, f)` semantics (bug found +
  fixed 2026-10-11): iteration starts AT `from_height`, INCLUSIVE** — trait doc
  says "starting at from_height", and `scan_cached_blocks` asserts
  `from_height == from_state.height + 1`, so the first block fed back must be
  exactly `from_height`. An initial `+1` off-by-one made the first real sync
  fail with `Wallet(NonSequentialBlocks)` (sqlite's `put_blocks` checks both
  height continuity `from_state.height + 1 == first_block.height` and per-pool
  note-commitment-tree size continuity for Sapling, Orchard AND Ironwood).
  A fresh wallet masks the bug: its birthday scan range is empty, so boot sync
  is a no-op that just reports the birthday anchor height.
- **lightwalletd client**: built manually, copying zcash-devtool's
  `remote.rs` connect logic: `tonic::transport::Endpoint::from_shared(url)` +
  `ClientTlsConfig::new().domain_name(host).assume_http2(true).with_webpki_roots()`
  + `.connect()`, then `CompactTxStreamerClient::new(channel)`. (The backend's
  `connect()` helper exists with the `lightwalletd-tonic-transport` feature but
  skips the explicit TLS config; devtool sets `assume_http2`, so we do too.)
  `get_latest_block(ChainSpec{})` gives `BlockId { height: u64, hash: Vec<u8> }`;
  broadcast is `send_transaction(RawTransaction { data, height: 0 })` giving
  `SendResponse { error_code, error_message }` (0 = accepted).
- **Balance**: `db.get_wallet_summary(ConfirmationsPolicy::MIN)` then
  `summary.account_balances()[account].total()` (zatoshis).
- **Send**: `propose_standard_transfer_to_address(&mut db, &params,
  StandardFeeRule::Zip317, account, ConfirmationsPolicy::MIN, &to, amount,
  memo, None, ShieldedPool::Sapling, None, None)` then
  `create_proposed_transactions(&mut db, &params, &prover, &prover,
  &SpendingKeys::from_unified_spending_key(usk), OvkPolicy::Sender, &proposal,
  None)` returning `NonEmpty<TxId>`. Read back with `db.get_transaction(txid)`,
  serialize with `tx.write(&mut bytes)`.
- **Prover**: `zcash_proofs::prover::LocalTxProver::bundled()` (feature
  `bundled-prover`): Sapling parameters are embedded in the binary, so there is
  no 51.5MB runtime download. Constructed once at startup.
- **Memo**: `text.parse::<Memo>()` then `MemoBytes::from(memo)`.
- **Pools**: `zcash_protocol::ShieldedPool` has `Sapling`, `Orchard`, `Ironwood`;
  the wallet picks where notes live, we only set the change fallback.
- **Guardrails**: binds 127.0.0.1 only; `MAX_SEND_ZATOSHIS = 100_000` (0.001 TAZ)
  cap in the sidecar itself, on top of the fixed amounts the game logic sends;
  seed lives in `sidecar/data/seed.hex` (gitignored, testnet only, per D-025).

## H. The testnet chain split — FILLED 2026-10-11 (researched live, D-027/D-028)

**Headline:** since 2026-10-04 there are *two* Zcash testnets and only one is
canonical. Picking the wrong one produces a wallet that syncs perfectly,
without errors, and shows a zero balance forever.

### H1. What happened

NU7 activated on the public testnet at height **4,465,026** on 2026-10-04
(ZIP 259; the Zebra 7.0.0-rc.0 release notes say "Activate NU7 on public
Testnet at height 4,465,026" and warn that "Testnet operators should upgrade
before then to stay on the NU7 chain"). Nodes that did not upgrade kept mining
under the old rules and forked off. NU7 is testnet-only for now: the mainnet
decision was scheduled for 2026-10-20 with activation planned 2026-11-05.

What NU7 changes: block target drops from 75s to **25s**; the difficulty
averaging window widens from 17 to 102 blocks; **60% of transaction fees**
accrue to the Network Sustainability Mechanism; the legacy **Sprout** shielded
pool is suspended.

### H2. The two chains, identified

| | **Chain A (canonical)** | **Chain B (abandoned fork)** |
|---|---|---|
| Rules | NU7 active at 4,465,026 | pre-NU7 (NU6.3) forever |
| lightwalletd | `https://testnet.zec.rocks:443` (ECC LightWalletD v0.5.4) | none reachable |
| Explorers | `testnet.zecblock.com`, Zakura NU7 dashboard | `zexplorer.app`, `blockexplorer.one` |
| Faucet | **Zakura NU7 faucet** (`zakura.com/nu7`) | `fauzec.com`, `zcashfaucet.jinolabs.xyz` |
| Tip on 2026-10-11 | ~4,488,8xx, advancing every ~25s | stuck around ~4,473,9xx |
| Status | **the real testnet** | dead end, kept alive by un-upgraded miners |

Both chains share the network magic `fa1af9bf`; the split is by consensus
rules, not by magic, which is why a forked node looks healthy to itself.

Evidence that pinned it down:

- Block hashes from `zec.rocks` and `zecblock.com` agree at 4,465,026
  (`000089ba2710…`), 4,466,573 (`0000aee73b44…`) and 4,473,795
  (`0000121f8093…`), while `zexplorer.app` shows a **different** block at
  4,473,795.
- `zec.rocks` returns `NOT FOUND` for the fauzec txid `d97c0628…`, the very
  transaction `zexplorer.app` displays as confirmed.
- Chain B's block 4,473,795 reports difficulty ≈ 7.00, consistent with a chain
  mined by essentially one machine (fauzec advertises that it "mines on
  demand").

### H3. What it cost us, and the fix

Our first faucet claim (fauzec, 1 TAZ, tx `d97c0628…`, shown "confirmed" at
height 4,473,795 on that site) landed on Chain B. Our wallet follows Chain A
through `zec.rocks`, so it correctly reported `0`. Resetting the wallet
birthday and re-syncing all the way to 4,488,648 proved the wallet scans
Chain A properly; the coins simply are not on it.

Fix: re-claimed from the **Zakura NU7 faucet** on 2026-10-11. 0.125 TAZ,
claim id `7d6ef5be4cf32c1ce0e1a06dc909c4a5`, tx
`eaf1d074b6e93a64163e82055454d7bd3e1e5f7f159d8451abd28e78a6839b1b`,
**confirmed at height 4,488,820 on Chain A**. The house wallet then reported
**12,500,000 zatoshis (0.125 TAZ)** at synced height 4,488,822. That is about
125 sends at the `MAX_SEND_ZATOSHIS` cap, and the faucet refreshes every 24h,
so the treasury is workable for the demo.

### H4. NU7 and our Rust stack (D-028)

Receiving worked immediately. **Sending did not.** The network answered:

```
code -25: failed to validate tx: WtxId("private"), error: transaction did
not pass consensus validation: transaction uses an incorrect consensus
branch id
```

Cause: the last *stable* librustzcash set (backend 0.24.0 / protocol 0.10.6,
published 2026-08 and 2026-09) predates the NU7 schedule and ships NU7 as a
stub. Verified by unpacking the published crates:

- `zcash_protocol 0.10.6`: `NetworkUpgrade::Nu7 => None` for **both** mainnet
  and testnet, and `BranchId::Nu7 => 0xffff_ffff`, a placeholder rather than
  the real id. The NU7 code is gated behind `#[cfg(zcash_unstable = "nu7")]`,
  and even with that cfg the activation height is still `None`, so **no
  compiler flag can fix it**. The literal `4465026` appears nowhere in the
  crate.
- `zcash_protocol 0.11.0-pre.0` (published 2026-10-01): NU7 is **ungated and
  complete**. `BranchId::Nu7 => 0x7719_0ad9`, matching ZIP 259, and for
  testnet `NetworkUpgrade::Nu7 => Some(BlockHeight(4_465_026))`, plus
  `const TESTNET_NU7_ACTIVATION`. Only the *next* upgrade (`nutachyon`) is
  still behind `zcash_unstable`. Mainnet NU7 is correctly `None`.

So the sidecar moved to the NU7-aware pre-release set, all published
2026-10-06, two days after activation:

| crate | was | now |
|---|---|---|
| zcash_client_backend | 0.24 | `=0.25.0-pre.1` |
| zcash_client_sqlite | 0.22 | `=0.23.0-pre.1` |
| zcash_proofs | 0.30 | `=0.31.0-pre.1` |
| zcash_protocol | 0.10.6 | `=0.11.0-pre.0` |
| zcash_primitives | 0.30 | `=0.31.0-pre.1` |
| zcash_keys | 0.16 | `=0.17.0-pre.1` |
| shardtree | 0.7 | 0.8 |
| zip32 | 0.2 | 0.3 |
| rand_core | 0.6 | 0.10 |

`rand_core` 0.10 is the awkward one: it **removed `OsRng`** and deprecated
`RngCore` in favour of `Rng`. The Zcash crates now bound randomness by
`rand::Rng` and use `UnwrapErr(SysRng)` internally, so the sidecar adopted the
same idiom (`rand` 0.10 with the `sys_rng` feature).

**Trade-off accepted:** we depend on pre-release crates. They are the only
published build that is consensus-correct on the live testnet, and the `=`
pins make the build reproducible for the judges. If ECC ships stable 0.25.0
before the demo, moving to it is a one-line change per crate.

### H5. Standing rules learned

1. **Verify which chain an endpoint serves before trusting a faucet.** Compare
   a block hash at a known height across two independent sources.
2. **A wallet that syncs cleanly and shows zero is not necessarily broken.**
   It may be honestly reporting that the deposit is on another chain.
3. **Keep the birthday at or below the deposit height.** Recreating the wallet
   DB with a birthday above a deposit misses it permanently. The Zakura tx is
   at 4,488,820, so any rebuild must use a birthday at or below that height.
4. **A new network upgrade means a new consensus branch id, so check the SDK**
   even for testnet-only upgrades. Scanning can keep working while sending
   silently breaks.

### H6. What the canonical explorer says about our two transactions

Raw material for the game's "what the public sees" panel. Both sends came from
the same house wallet on the same chain, eight minutes apart, so the only
variable is the choice to shield or not. Links are
`https://testnet.zecblock.com/tx/<txid>`.

| | **Shielded send** | **Transparent send** |
|---|---|---|
| txid | `952a1959…f3299c77` | `7ffa8ea6…5bb914f2` |
| Block | 4,488,884 | 4,488,905 |
| Explorer label | `CONFIRMED` `IRONWOOD` | `CONFIRMED` `UNSHIELDING` |
| Privacy score | not shown, nothing to score | **0 / 100** |
| The explorer's own words | "Fully private transaction using the Ironwood shielded pool (NU6.3). All amounts, senders, and recipients are encrypted." | "0.0002 TAZ moved out of the private shielded pool to the public address tmA4rv…BvGb." |
| Amount visible to a stranger | no | **yes**, 0.0002 TAZ |
| Recipient visible to a stranger | no | **yes**, `tmA4rv…BvGb` |
| Fee | 0.00010000 TAZ | 0.00015000 TAZ |
| Size, version | 9,166 bytes, v6 | 9,200 bytes, v6 |
| Pool activity | Ironwood, 2 actions | Ironwood, 2 actions, leaving the pool |
| Memo allowed | yes | **no**, rejected as `Payment(TransparentMemo)` |

Two facts worth carrying into the design:

- **The house funds live in the Ironwood pool**, not Sapling or Orchard. The
  Zakura faucet paid there, our wallet scans it, and it spends from it without
  a pool crossing. Ironwood is the NU6.3 pool and NU7 keeps it. Anything in
  the OUTLINE that says "Sapling" should be read as "the shielded pool", and
  the game copy should probably say Ironwood, since that is what a player will
  see on the explorer.
- **ZecBlock runs a "Blend Check" and a "Privacy Risk Analysis"** on every
  transaction. For our transparent send it reported "No round-trip detected,
  0/100". Linking a player's real tx there gives us a third-party witness that
  grades the privacy for us, which is stronger evidence than anything we could
  render ourselves.

### H7. An open payment out of the shielded pool does not name its sender — FOUND 2026-10-12 (B5)

Found by playing the real game and reading the transaction it produced, rather
than by reasoning about it. The first version of the "what the public sees" panel
claimed an open payment published who paid. It does not.

The house funds sit in the Ironwood pool (H6), and the house's transparent address
holds nothing spendable (I4). So **every** open round is a z→t unshielding, never
a t→t payment. That distinction is the whole finding:

| | hidden round | open round |
|---|---|---|
| Real tx | `dc7c8de1…3746d6fe` | `c97af953…624fa7e5` |
| Block | 4,490,770 | 4,490,780 |
| Explorer label | `CONFIRMED` `IRONWOOD` | `CONFIRMED` `UNSHIELDING` |
| Explorer's own words | "Fully private transaction using the Ironwood shielded pool (NU6.3). All amounts, senders, and recipients are encrypted." | "moved out of the private shielded pool to the public address tmXbq7...Kfub." |
| Sender named | no | **no** |
| Recipient visible | no | yes, `tmXbq7ghCfNyszcBFT9sYiWvKZoHjt3Kfub` |
| Amount visible | no | yes, `0.00001000` TAZ (on the INPUTS/OUTPUTS tab; see the caveat below) |
| Inputs shown as | sealed Ironwood notes | 2 sealed Ironwood notes, no address on either |
| Fee | 0.00010000 TAZ | 0.00015000 TAZ |
| Blend Check | nothing to score | "No round-trip detected", risk **0/100**, "nothing here for an outside observer to connect" |

Three things worth carrying forward:

- **The sender stays hidden on both branches.** An unshielding reveals where the
  money went and how much, not who sent it, because the notes that paid for it are
  shielded and publish only nullifiers. ZecBlock's flow diagram agrees: it draws
  the source as `Ironwood Pool`, never as an address. Its Blend Check scores the
  privacy risk 0/100 and says there is nothing for an outside observer to connect.
  That is the third-party witness H6 hoped for, and it grades the open round as
  low risk too.
- **Both branches build a proof, and both take about the same time.** Measured on
  this machine: hidden 23s, open 21s. An open payment is not the cheap one with no
  maths in it; leaving the pool has to be proved either way. Copy that claimed
  otherwise was wrong and is corrected. What differs is what the proof protects:
  the hidden round's proof keeps destination and amount secret, the open round's
  does not.
- **Beware the explorer's headline number.** ZecBlock's summary flow showed
  "0.0002 TAZ" for a payment of 1,000 zatoshis. That figure is the *pool delta*
  rounded, not the output: the same page's pool activity reads `-0.00016000 TAZ`
  (16,000 zat leaving the pool = 1,000 payment + 15,000 fee), and the
  INPUTS/OUTPUTS tab shows the true output as `0.00001000`. Anyone verifying our
  amounts should read the outputs tab, not the diagram. Our own display was
  correct throughout.

Consequence for the game: an open round leaks **two** of the four things a stranger
could learn (who got paid, how much), not three. The note is not a leak because an
open payment cannot carry one (H6), and the sender is not a leak because the pool
absorbs it. The leak meter computes this from the server's facts rather than from
which button was pressed, so the two cannot disagree.

This sharpens round 2 rather than weakening it. "Prove you paid" now has a true
and surprising answer: the public record shows that *a* payment of 1,000 zatoshis
reached that address, but not that *you* sent it. Proving authorship out of a
shielded wallet needs a disclosure the chain itself does not provide.

## I. The rhythm of a real round — FILLED 2026-10-11 (measured live, B4)

Found by building the bridge and playing two real rounds through it. Everything
here was measured on this machine against the canonical chain, not estimated.

### I1. A round cannot follow a round straight away

After a payment, the house's remaining money is **change that has not been
mined**. `ConfirmationsPolicy::MIN` in backend 0.25 still requires **one
confirmation** for a shielded note (ZIP 315), so the wallet reports
`spendable: 0` until that block lands. A second attempt fails with:

```
InsufficientFunds { available: Zatoshis(0), ... }
```

This is not a bug and not a shortage of money. The house owns plenty; it just
cannot touch it yet. The sidecar now detects this before building anything and
answers `409 {"code":"settling"}` with the real numbers, which took the refusal
from a 72-second dead end to a 2-second explanation:

```
spendable_zatoshis: 0, pending_change_zatoshis: 12445000
```

**Consequence for the design:** "wait for the network to agree" is a real,
unavoidable beat in the game, not something to hide. It is also a teaching
opportunity, because it is the same confirmation every real Zcash user waits
for. Measured, it ran between 34 and 99 seconds against a block average of 23.6
seconds (I2), so it is one to four blocks and its length is not something we
control. Two ways to live with it, both worth an owner decision: pace the game
around one round per block, or split the pot into many confirmed notes up front
so each round spends a different one and rounds can follow quickly.

**The split option is verified feasible, not speculative.** `propose_transfer`
takes a `zip321::TransactionRequest`, and `TransactionRequest::new(payments:
Vec<Payment>)` accepts up to 9,999 payments in a single transaction. So one
"break up the pot" transaction can create many notes at once, all paid to the
house's own shielded address, and once it is mined every one of them is
confirmed and independently spendable.

The cost must be measured rather than assumed. ZIP 317 scales the fee with the
number of logical actions, and our two observed rounds cost 10,000 and 15,000
zatoshis, so a fair reading is a few thousand zatoshis per extra output. Even at
10,000 a note, making 30 rounds immediately playable would cost about 300,000
zatoshis, or 2.4% of one faucet claim. Two practical constraints: it has to be
done while the wallet holds confirmed funds, and its own change then has to
land, so it is a setup step and not something to attempt mid-game.

### I2. What each step actually costs

All figures measured live on 2026-10-11 on this machine, after optimizing the
dependency crates (`[profile.dev.package."*"] opt-level = 3`).

| Step | Measured | Note |
|---|---|---|
| `POST /sync`, caught up | 1–4s | Cheap. Polling is fine. |
| `GET /balance` | 2s | Includes a sync. |
| Settling refusal | 1–2s | Syncs, checks, refuses before proving. |
| Hidden round, first after a restart | 26s | Includes any one-off proving-key loading. |
| **Hidden round, steady state** | **21–22s** | Two consecutive rounds both measured 21s and 22s. |
| Open round, before optimization | 110s | Also spends a shielded note, so it also proves. |
| Hidden round, before optimization | 72s | Same machine, same chain, `opt-level = 0`. |
| **Wait for the network to agree** | **34s once, ~99s once** | Variable. One confirmation is required, and a block averages 23.6s. |
| **Average block time** | **23.6s** | 8 blocks in 189s, sampled through `POST /sync`. |

Three conclusions worth carrying into the design:

- **Optimizing the cryptography bought a 3.3x speedup** (72s to 22s), which is
  the difference between unplayable and playable. The remaining 22s is real
  proving work and is the floor for a round; it is what the D-020 signature
  animation has to cover, not hide.
- **The first-use overhead is small**, about 4s. The 72s figure was almost
  entirely the unoptimized build, not proving-key loading as feared.
- **The confirmation wait is the larger and more variable cost**, and it is
  outside our control. It measured between 34s and 99s, which is one to four
  blocks. Any design that makes a player wait for it is handing the network's
  variance straight to the person at the keyboard.

### I3. `GET /health` reports a stale height

`/health` reads the last-synced height from the wallet database and does **not**
sync. Sampling it every 30 seconds returned the same height for 5 minutes while
blocks were being produced. Heights must be sampled from `POST /sync`, which
does the work. Cost us one wasted measurement window; recorded so it is not
repeated.

### I4. The house's transparent address is owned but not watched

`tmXbq7ghCfNyszcBFT9sYiWvKZoHjt3Kfub` is correctly derived from the house seed
via `USK -> AccountPrivKey -> AccountPubKey -> external IVK -> default_address`,
and it really receives: the open round moved 1,000 zatoshis to it on chain.

But `transparent_zatoshis` reads **0**, because the address was derived beside
the wallet rather than registered inside it, so nothing scans for it. The coins
are real, visible on the explorer, and controlled by the house key, yet the
wallet will not spend them.

Judged acceptable and left alone: open rounds cost 1,000 zatoshis each against
a 12.5 million zatoshi faucet claim, so the loss is noise. It also happens to be
useful. Every open payment piles up on one public address that anyone can read
on the explorer, which is a permanent, third-party-visible record of every
visible payment the arcade ever made. Registering the address would spend that
exhibit for no real gain.

### I5. Balance trail, every real send

Seven payments, all accounted for to the zatoshi. Nothing was lost and nothing
was invented.

| Event | Total after | Cost |
|---|---|---|
| Zakura faucet (B2) | 12,500,000 | |
| B3 hidden + open capability tests | 12,472,000 | 28,000 |
| Open round `b2905c65…b7297d`, through the bridge | 12,456,000 | 16,000 |
| Hidden probe `edaecd0b…499650`, direct to the sidecar | 12,445,000 | 11,000 |
| Hidden round `9f9f8aa7…f9b4b`, through the bridge | 12,434,000 | 11,000 |
| Hidden round `6b5759eb…f0cff`, through the bridge | 12,423,000 | 11,000 |
| Hidden round `62aee111…9ee9`, through the bridge | 12,412,000 | 11,000 |

Fees observed again: 15,000 zatoshis open, 10,000 hidden, exactly as in H6. A
hidden round therefore costs 11,000 zatoshis all in, which is **eleven times the
payment itself**. That ratio is worth putting in front of a player, because it
runs against intuition: the privacy is not free, but it is cheap, and the fee
does not grow with the amount sent.

**One thing the wallet does not give back, and the reason why (SOLVED
2026-10-11).** Each hidden round pays 1,000 zatoshis to the house's own shielded
address, and that payment never reappears in the balance. After `edaecd0b…` the
total read 12,445,000 rather than 12,446,000, and it stayed there with
`pending_change` at 0 long after the block was mined.

The first guess, that the wallet summary ignores outputs an account sends to
itself, was **wrong**. Opening the wallet database directly with `node:sqlite`
(`sidecar/data/wallet.sqlite`, read-only) shows every one of those outputs stored
in `ironwood_received_notes` with a real `commitment_tree_position`, so the house
key does decrypt them and the wallet does see them. Four of them are sitting
there: note ids 4, 8, 10, 12 and 14, each `value = 1000`, each
`is_change = 1`, each with a proper witness.

What actually excludes them is a dust floor in the balance query. In
`zcash_client_sqlite::wallet::get_wallet_snapshot`, the first branch of the
classification is:

```rust
if value <= zip317::MARGINAL_FEE {
    (zero, zero, zero, zero, value)   // -> uneconomic_value
}
```

`zip317::MARGINAL_FEE` is **5,000 zatoshis**, and the crate's own test comments
state the consequence plainly: "`Balance::total` excludes uneconomic value, so
the dust does not appear in the account total." A 1,000-zatoshi note is
therefore not missing, it is *below the line the wallet draws*: worth less than
the fee it would cost to spend, so the wallet refuses to count it as money.

Three consequences, all acted on:

1. **This is a real Zcash rule, not a bug, and it is teachable.** Privacy has a
   floor price. Any note smaller than the marginal fee is economically dead.
2. **It sets a hard floor on the D-031 pot split.** Every note the split creates
   must be worth *more* than 5,000 zatoshis or it would be born unusable. This
   is now `MIN_SPLIT_NOTE_ZATOSHIS = 5_001` in `sidecar/src/wallet.rs`. Had the
   split been built on the original guess, it would have looked like it worked
   and quietly destroyed the pot.
3. **The house loses 1,000 zatoshis per hidden round to dust.** That is about
   1.2% of one faucet claim at the daily ceiling, so `ROUND_ZATOSHIS` stays at
   1,000 rather than being raised above the dust floor to recover it. Raising it
   to 6,000 would make the payment return and cut the cost per round from 11,000
   to 10,000, but the number the player sees is nicer at 1,000 and the saving is
   not worth the churn on a verified constant.

The method is worth keeping: when the wallet's numbers disagree with the
arithmetic, read the database rather than the documentation.

At the daily ceiling of 150 rounds, all costs together come to between 1.65 and
2.4 million zatoshis depending on how many players chose to hide, and one faucet
claim provides 12.5 million. The pot is safe for a full event day with room to
spare.

### I6. Backend 0.25 API changes worth remembering

- `min_confirmations: NonZeroU32` is gone. It is now
  `confirmations_policy: ConfirmationsPolicy`, whose `MIN` is 1 confirmation for
  shielded notes and 0 for transparent UTXOs, with `allow_zero_conf_shielding`.
  There is **no** setting that permits spending unconfirmed shielded change.
- `AccountBalance::spendable_value()` is the honest "can I pay right now"
  number, and `change_pending_confirmation()` is the "on its way" number. The
  pair is what makes a truthful waiting message possible.
- `AccountBalance::unshielded()` is deprecated in favour of
  `unshielded_regular_balance()` / `unshielded_coinbase_balance()`.
- `propose_standard_transfer_to_address` gained `lock_inputs:
  Option<LockRequest>`, which locks selected inputs so concurrent proposals
  cannot double-book them. We pass `None` because the sidecar holds one mutex
  over the whole wallet, but this is the right tool if that ever changes.
- `UnifiedSpendingKey::default_transparent_address` is compiled only under
  `any(test, feature = "test-dependencies")`. Production code must walk the
  derivation path by hand, which is what `load_or_create_transparent_address`
  does.
- `propose_standard_transfer_to_address` builds a `zip321::TransactionRequest`
  with exactly one payment and then calls `propose_transfer`. To pay the same
  address many times in one transaction, skip the helper and call
  `propose_transfer` directly with `GreedyInputSelector::new()`,
  `fees::standard::SingleOutputChangeStrategy::new(Zip317, None, pool,
  DustOutputPolicy::default())` and `SpendPolicy::default()`. That is the whole
  of the pot split; `Proposal` lives at `zcash_client_backend::proposal::Proposal`,
  not under `data_api`.

### I7. The pot split (D-031), measured on the real chain

Verified live 2026-10-11, not modelled.

**Setup, 5 notes of 20,000 zatoshis each, one transaction:**
`20f2527f0f7b27b13e544b39ecf5dc97bd7564704e400e1f4d418f7e4337f0e5`

| | value |
|---|---|
| spendable before | 12,412,000 |
| spendable after, settled | 12,382,000 |
| **fee actually paid** | **30,000** |
| build + prove + sign + broadcast | 69.3s |
| time until the notes were spendable | about 3 minutes (mine, then one confirmation) |

The fee is exactly `5,000 x (5 payments + 1 change)`. So the cost of a split is
**5,000 zatoshis per note plus 5,000**, and the notes themselves are not spent,
only moved: all 100,000 came straight back into `spendable`.

**The decisive test.** Three hidden rounds fired back to back with no pause
between them, straight at the sidecar to bypass the bridge's 30-second spacing:

```
round 1 OK in 22.7s  9cf8c5e1d651eb21...
round 2 OK in 21.5s  968c845f8d7c0d4d...
round 3 OK in 22.1s  a1998751e1fcc675...
```

Before the split this was impossible: the second request always came back 409
`settling`. Now the wait is gone and only the honest 22 seconds of cryptography
remains. Spendable afterwards was 12,322,000 with 27,000 pending, which is
exactly three 9,000-zatoshi change notes (20,000 in, 1,000 payment, 10,000 fee).
That also proves each round spent one *small* note and left the big change note
alone.

**Why the big note is left alone.** Note selection for a value target is
`ValueSelection::Accumulate` in
`zcash_client_sqlite::wallet::common::select_spendable_notes_matching_value`,
which orders by `commitment_tree_position`, i.e. strictly oldest first, and takes
the note whose running sum first reaches the target. The split transaction writes
its change output last, so that change is the **newest** note in the wallet and is
reached only after every small note is gone. The design depends on this; if a
future version reordered outputs, the burst would collapse to one round and the
symptom would be the settling refusal coming back.

**What this buys, honestly.** N pre-split notes give N back-to-back rounds, about
22 seconds each. After that the wallet falls through to the big change note, and
from then on the pace is roughly one round per block as each round's change
confirms. Re-running the split restores the burst. Build time scales at about
12 seconds per output, so 40 notes takes around 8 minutes and must be run before
a session, not during one.

**Bounds enforced in code** (`split_pot`): 2 to 200 notes, each between 5,001 and
100,000 zatoshis. The lower bound is the dust floor from I5; a note at or below
5,000 would be created unusable. The upper bound on count keeps the worst-case
fee near one faucet claim. All five refusal paths were exercised live and every
one returned 400 before touching the wallet or the network.

### I8. Corrections to I7, and refill behaviour, measured 2026-10-12

**The fee rule stated in I7 is wrong.** It is not `5,000 x (notes + 1)`. The real
rule is ZIP-317 logical actions, and for a shielded-only transaction that is
`5,000 x max(inputs, outputs)`. Four separate splits fit it exactly:

| split | inputs | outputs | actions | fee paid |
|---|---|---|---|---|
| 40 notes, funded by one large coin | 1 | 41 | 41 | 205,000 |
| 5 notes, funded by one large coin (`20f2527f…`) | 1 | 6 | 6 | 30,000 |
| 5 notes, gathered from small coins (`9b14aee0…`) | 7 | 6 | 7 | 35,000 |
| 2 notes, gathered from small coins (`55c6ad81…`) | 3 | 3 | 3 | 15,000 |
| 5 notes, gathered from small coins (`22bb043d…`) | 7 | 6 | 7 | 35,000 |
| 8 notes, gathered from small coins (`0f88cec0…`) | 13 | 9 | 13 | 65,000 |
| 3 notes, gathered from small coins (`1da8685f…`) | 6 | 4 | 6 | 30,000 |

Seven splits, no exceptions. Note how far the gather cases sit above the formula
I7 assumed: the 8-note split was predicted at 45,000 and cost 65,000, because it
took thirteen inputs to find the money. **The operator script therefore states the
fee as a floor, not an estimate**, which is exactly what `notes + 1` is, since
outputs are always at least that many and `max` can only raise it.

I7's formula held only because the pot was still one large coin at the time, so
inputs were always 1 and `max` was invisible. **The practical consequence:** once
the pot is mostly small coins, a split has to gather several of them, inputs
outnumber outputs, and the fee grows. Repeated small refills are therefore
progressively more expensive per coin than the first big one. This is why the
operator script states the fee as an estimate and the real figure comes from the
transaction record.

**A small split can leave its change as dust.** `55c6ad81…` spent 3 x 20,000,
created 2 x 20,000, paid 15,000 in fees and left exactly 5,000 in change, which
sits on the I5 dust floor and is unusable forever. Confirmed by prediction rather
than inference: spendable was 12,003,000 before and 11,983,000 after the
transaction landed, exactly the 15,000 fee plus the 5,000 dead change.
`MIN_SPLIT_NOTE_ZATOSHIS` guards the coins a split creates but not its change,
which the change strategy picks. Not worth engineering around: it only bites
small ad-hoc splits, and the default 40-note split takes change from the large
coin and is nowhere near the floor.

**One curiosity, harmless.** The 8-note split (`0f88cec0…`) spent exactly what it
needed and emitted a change output of **zero**, which the wallet still wrote as a
real output rather than omitting. It cost nothing extra, because thirteen inputs
already dominated the action count, and 225,000 in minus 160,000 out equals the
65,000 fee to the zatoshi. Recorded so that a zero-value note in the wallet is
not later mistaken for a lost payment.

**Reading the balance during an unmined split understates the pot badly.** Inputs
are marked spent the moment the transaction is built, but the new coins are not
recorded until it mines and gets scanned. Observed live: 12,003,000 down to
11,943,000 mid-flight, a 60,000 drop that is not a loss, recovering to 11,983,000
once mined. This is why the operator script waits for the transaction to land
before declaring the coins ready. An operator who reads `/balance` during a refill
will see a frightening number that is not real.

**Refill behaviour (D-035, D-036), measured during a live 5-coin split:**

| call | result |
|---|---|
| `/send` | refused in 23 to 33 ms, status 503, `code: "refilling"`, no money moved, three attempts |
| `/health` | answered in 1.6 ms with `refilling: true` and `synced_to: null` |
| `/health` when idle | 1.3 ms with a real height |
| after the split | flag cleared by itself, `/health` returned a height again |

The flag clearing is the safety-critical part, and it is guaranteed by a drop
guard rather than by remembering to reset it. That was tested by accident and
then deliberately: a client was killed mid-split, the sidecar handler was
abandoned, and the flag did not stick.

**One measurement to distrust.** An earlier attempt timed the same `/send` refusal
at 86 seconds. That was CPU starvation, not the logic: a Next.js dev compile and
five zero-knowledge proofs were running at the same time, so the request sat
before the handler ever saw it. The clean re-measurement above is the one to
trust, and it is also a fair warning that proving saturates this machine.

---

**Rule:** no scope or architecture decision is made until the relevant research
section above is filled and the owner says it clicks.
