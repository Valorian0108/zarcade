# CABINET FOUR SCOPE — The Merchant's Window (proposed title)

> **Status:** APPROVED v1, 2026-10-26 (owner's yes in chat). D-115.
> **The section 3 gate passed 2026-10-26 (D-116) and build step 2 passed the
> same day (D-117): the merchant account exists, the incoming-only scan reads
> it, and the INV-204 memo rode a real payment and was read back. The build
> order in section 7 applies from step 3.**
> The name is proposed, not locked; it becomes final when the scene copy is
> written. This cabinet replaces the earlier "Auditor's Key" concept. The
> sample at `/sample/audit` is frozen as a scratchpad and is not the shipped
> game.

---

## 1. The experience and narrative (decided)

**Player perspective: the merchant.** First person, behind your own counter.
You own the account, you hold the key, you decide what to show.

**The question the game asks.**
Someone needs to verify a payment you received. How much of your private
financial information do you let them see?

**The story in one breath.**
You run a small shop. A customer has paid a deposit of 1,000 zatoshis for a
custom order, and the memo on that payment carries the order reference
INV-204. Your business partner needs confirmation that the deposit arrived
before releasing the materials. You hold the incoming viewing key for the
account. You preview what handing it over would reveal, you confirm that
showing it cannot touch your money, then you choose one of three ways to
answer the partner. The game ends when you see what your choice leaves open.

**Cast.** Two presences. You, the merchant, seen from behind your counter. The
auditor, the existing grey-coat figure, now standing on the far side of the
counter as the partner's representative. The partner is never on screen. The
Watcher does not appear in this cabinet as a separate character. The room,
lighting and restrained text carry the atmosphere.

**The window.** The partner's view is a window across the room, part of the
shop from the first beat. It is never a pop-up. Its light carries the
consequence: lit and staying lit, one receipt lit, or dark.

**Format.** One scene. Two to three minutes. No score, no timer, no fail state,
no moral scoring. One action per beat.

**The three lessons, in the order they land.**
1. The key shows what arrived: amount, your addresses, memo, time, block.
   It never names the sender.
2. The key cannot spend. Reading and spending are separate secrets.
3. A key shows one account's incoming side. It never shows outgoing spending,
   other accounts, or a complete balance. Sharing it is permanent.

**Voice.** Grandma rule. Short plain sentences. Name the real thing once, then
plain words. Gloss jargon in one gold word. After a gotcha, explain what
happened and why. No banned buzzwords. No em dashes in player copy.

---

## 2. The Zcash functionality the build must support

### 2.1 Account and payment

- A dedicated merchant account in the sidecar, with its own shielded account
  and viewing keys. The pot's key is never used and never exposed.
- One real testnet payment of 1,000 zatoshis from the house pot into that
  account, through the existing single money route (D-025). Read only from the
  cabinet's side: the cabinet never sends money.
- The payment carries the memo INV-204 from the customer. The memo must be set
  in the payment itself and read back through the incoming-only scan. If the
  single money route cannot carry it without adding a second route, the memo
  is dropped from the game, not faked. The readback test in the build order
  decides this. **The readback test passed on 2026-10-26, so the memo stays in
  the game (D-117).**
- The receipt shown in game carries the real transaction id and block of that
  payment. If the payment has not landed, the game says so and does not
  pretend.
- **The deposit was made on 2026-10-26 (D-117).** One thousand zatoshis left the
  house pot for the merchant account in transaction
  `1e829a3e7079ad20df4c9f0da5f445b557056de53338fcbd683d238dec95536a`, mined at
  height 4543955. The incoming-only scan reads it back as exactly one row:
  1,000 zatoshis, memo INV-204, Ironwood action 1, block 4543955, and no sender.
  The house paid a 10,000-zatoshi fee and its unspent total fell from
  23,790,000 to 23,779,000 zatoshis, which is the money really leaving the pot.

### 2.2 Incoming-viewing-key-only scan (settled)

- The sidecar derives the account's incoming viewing key and scans with only
  that key. The nullifier key slot stays empty. The full viewing key and the
  spending key never leave the sidecar.
- Evidence in our pinned versions:
  `zcash_client_backend 0.25.0-pre.1`, `src/scanning.rs` lines 142 to 224.
  `ScanningKey` holds `nk: Option<Nk>`, and `(AccountId, SaplingIvk)` implements
  scanning with no nullifier key. Orchard uses
  `ScanningKey::new(ivk, None, account, scope)`.
- Rows are built from notes actually decrypted by that scan: amount, receiving
  address, memo if present, transaction id, block height, time.
- The sender is never shown. "Who paid: still sealed" stays on every row,
  including lit ones. A receiving-side key does not name the payer.

**How the shipped scan works (built 2026-10-26, D-117).** It does not reuse the
house wallet's own sync. It asks lightwalletd for compact blocks from the
merchant's birthday to the chain tip, and trial-decrypts every Ironwood action
with the merchant's incoming viewing key alone
(`zcash_note_encryption 0.5.1`, `try_compact_note_decryption`, under
`orchard 0.16.0`'s `IronwoodDomain`). No nullifier key is derived, so the scan
cannot tell whether a note was later spent, and the response says so
(`can_spend: false`). A compact block carries no memo, so a note that opens is
fetched once in full and decrypted a second time to read the memo the payment
really carried; the two reads are cross-checked against each other (same value,
same note commitment) before a row is published. Worth knowing: the wallet's own
database stores `memo = NULL` for that note until a full decryption runs, so the
memo in the cabinet comes from the chain through the incoming key, not from a
stored field. Progress is cached in `data/merchant-scan.json`, which holds rows
and a height only; it was scanned for the seed and both accounts' viewing keys
and contains none.

### 2.3 Read-only surface

- One read-only endpoint serves the cabinet's rows and the disclosure result.
  No key material in any request or response. No write path from the web tier.
- Existing house rules apply: exact-body guards, no new money routes, the
  sidecar remains the only holder of keys.

**Shipped 2026-10-26 (D-117).** `GET /merchant` is the cabinet's window. It
takes no parameters and no body, and it answers with the rows, the address, the
name of the key that read them, `can_spend: false`, and the height range the
scan covered. POST, PUT and DELETE to it all return 405, measured on the running
sidecar: the router registers one verb, so there is no write path to find. The
response was scanned for the seed and for both accounts' incoming and full
viewing keys and contained none.

### 2.4 Single-payment disclosure (mechanism settled, wiring to verify)

The "one sealed note" path must be real or it does not ship.

- What is disclosed: one received note's plaintext (note version, value,
  recipient, randomness, memo), plus its transaction id, shielded output index
  and pool.
- How a verifier checks it without the viewing key:
  1. Fetch the transaction and confirm the claimed height.
  2. Recompute the note commitment from the revealed plaintext.
  3. Compare it with the commitment carried by that output in the transaction.
  4. If they match, the payment is proven. Nothing else about the account is
     revealed. No Merkle path and no tree state are needed for a receipt proof.
- Evidence in our pinned versions:
  `orchard 0.16.0`, `Note::commitment()` (`src/note.rs` line 407) against
  `Action::cmx()` (`src/action.rs` line 96). The wallet stores received notes
  (`ReceivedNotes`, `get_spendable_note`), the memo (`get_memo`) and the
  transaction (`get_transaction`).
- Out of scope for this path: spent status. A receipt proof does not need it.

### 2.5 The balance question

The closing question is answerable from the machine: the key alone cannot
compute what remains, because outgoing spending is outside its scope. The
answer on screen is "not from this key alone."

---

## 3. Single-payment disclosure: what is settled, what remains

**Settled by research (2026-10-26).**
- A transaction id alone cannot reveal the amount of a fully shielded payment.
  Any design that leans on an explorer to show the amount is false and is
  forbidden.
- The commitment-comparison path above is the honest verification mechanism,
  and the required functions exist in our pinned crate versions.
- No new money route and no extra key exposure are required.

**Remaining: one time-boxed implementation spike, with a gate.**
Acceptance criteria, all four:
1. Export a plaintext disclosure for one real received note from the sidecar.
2. Recompose its commitment and match it against the on-chain output for that
   transaction.
3. Confirm the transaction sits at the claimed height on testnet.
4. Return the verification result through the read-only endpoint, with no key
   material in the payload.

**Gate.** If all four pass, three disclosure paths ship. If any fails, the
cabinet ships two paths (the key, or nothing), the single-note path is removed
from the build, and the reason is written in DECISIONS.md. It is never
simulated in its place.

**Gate result: PASSED (2026-10-26).** The spike ran against a real
external-scope note in the house wallet:
- Note 182, 1,000 zatoshis, Ironwood action 1, transaction
  `c47a2f0aae8cc774f66bd3a6378aa497fd4e2f40c1b1c4430ba268c7752131a6`,
  claimed height 4498411.
- Recomputed commitment and on-chain output commitment both
  `65fe2f47a7308747d7cdbe9d4173c9b8400c3205ef27d27f33a78aad5fb56a0f`.
- lightwalletd reported the same height, 4498411.
- The read-only endpoint returned no seed, full viewing key or incoming
  viewing key text, and refused a POST with 405.
- The note is unspent. The first version of the report read the nullifier column
  as spend status, which marked every detected note spent; the report now reads
  the spend table. Receipt verification does not depend on spent status, as
  recorded in section 2.4.
- The gate path selects external-scope notes, the kind the merchant receives at
  the account address. Change notes at internal addresses are outside this
  receipt path.
- This note carries no memo, so the INV-204 memo readback is still part of
  build step 2. The gate itself does not test the memo.

**End-card sentence.** The line "A single-payment disclosure can let someone
verify one payment without giving them your incoming viewing key" ships. The
gate passed on 2026-10-26. The mechanism itself was already settled; the gate
tested our wiring, not the protocol.

---

## 4. Exact scenes, interactions and visual states

One room, seven beats. Every beat has one action.

### Beat 0. The curtain
- **See:** approved oxblood velvet, one warm leak masked away from the copy,
  title and entry lines, one Open button.
- **Do:** press Open.
- **State:** closed, parting.

### Beat 1. The request
- **See:** the same room from behind the counter. The auditor stands opposite
  with a letter. Your slip on the wood, your key beside it, your drawer (the
  till), your record board with two sealed rows, the lamp.
- **Copy:** who you are, what arrived, what the partner needs, what you will not
  give up.
- **Do:** one button, take the key.

### Beat 2. The preview
- **See:** the key travels to the board and turns. Rows warm one by one. Each
  reveals amount, your receiving address, time and block. The deposit row also
  shows its memo, INV-204, if the chain really carries it. Each keeps "who
  paid: still sealed". The rows draw a quiet link between them, because they
  belong to one account. A teach line names the real thing once: this is what
  the incoming viewing key shows.
- **Do:** one button, try the drawer.

### Beat 3. The boundary
- **See:** the same key enters your drawer and refuses. It does not turn. No
  alarm, no punishment. The drawer stays shut.
- **Copy:** reading is not spending. Sharing this key cannot move your money.
- **Do:** one button, decide.

### Beat 4. The choice
- **See:** three physical cards on the counter, each with one plain line:
  1. Hand over the key.
  2. Hand over one sealed note.
  3. Hand over nothing.
- **Do:** choose one. No option is scored as morally right or wrong.

### Beat 5. The consequence
The window across the room is the partner's view. Three distinct states:
- **Key:** the window lights and stays lit. New incoming records arrive one by
  one after the visit, each lighting in the partner's view, the addresses still
  linked. A line says the window stays open, and there is no undo.
- **One note:** only the single receipt lights. One record, one amount, one
  time. Everything else stays dark. A line says this proves one payment and
  nothing else.
- **Nothing:** the window stays dark. No evidence. Trust only.
- The light is noticeable but quiet. It changes the room; it does not shout.
- **Do:** one button, continue.

### Beat 6. The balance question
- **See:** the auditor asks how much money is left. The answer: not from this
  key alone. The outgoing side of the account is outside the key's scope.
- **Do:** one button, finish.

### Beat 7. The end card
- **See:** what you chose, what it revealed, and the three boundaries. If the
  gate passed, one plain sentence names the single-payment mechanism. The
  receipt stays as a keepsake. Replay and return.
- **Do:** play again or leave.

### Visual rules
- Gold means readable. Sealed grey violet means hidden. The oxblood curtain is
  approved (D-113) and its shades are house tokens (D-114).
- No red and no green as verdict colours.
- Motion follows the More and Less setting, including the global kill rule.
- The window consequences are animations of a real property, not decoration:
  the key's scope is ongoing, the note's is single, refusal is none.

---

## 5. What the build is forbidden to invent or change

1. No full viewing key, spending key or any key material on the web tier or in
   any HTTP payload. Incoming-only scan in the sidecar, always.
2. No claim that a transaction id reveals a shielded amount. No explorer
   screenshot as proof of an amount.
3. No revoke, expiry or "take it back" language for a shared key. Sharing is
   permanent, and the copy must say so.
4. No sender identity. "Who paid: still sealed" stays on every row.
5. No new characters. No separate Watcher. The auditor speaks. The partner is
   never on screen.
6. No new beats, no score, no timer, no fail state, no moral scoring, no
   branching beyond the one choice.
7. No new money routes (D-025). No spending, sweeping or pot changes from the
   cabinet. One real testnet payment, one direction.
8. No fabricated chain data presented as real. Anything modelled must be
   labelled on screen. Sample values only while the receipt says Sample.
9. No palette, font, curtain or room-design changes without approval. No red or
   green verdicts. No screenshots in README or submission.
10. No changes to the hub, the other cabinets or the site chrome as part of
    this cabinet.

If the machine cannot do something in this document, the build stops and asks.
It does not fake the feature.

---

## 6. Decisions taken forward (proposed)

| Item | Direction | Status |
|------|-----------|--------|
| Name | The Merchant's Window | Proposed, owner's yes needed |
| Story | Deposit for a custom order; partner confirms before releasing materials | Proposed |
| Memo | INV-204 in the real payment, read back through the key | Proposed, tested in the build |
| Window | Part of the room; lit and staying lit, one receipt, or dark | Proposed |
| End card | One plain sentence on single-payment disclosure | Only if the gate passes |
| Third path | One sealed note, commitment verification | Gate in section 3 |
| Fallback | Key or nothing, labelled honestly | If the gate fails |

Only one approval remains: the owner's yes to this document. The gate is
technical, not creative. If the gate fails, the scope is amended before the
scene copy is written.

---

## 7. Build order (after approval, not before)

1. Implementation spike for the single-note path, with the gate in section 3.
   **DONE 2026-10-26; gate passed (D-116).**
2. Sidecar: merchant account, incoming-only scan endpoint, read-only rows, and
   the INV-204 memo readback test. **DONE 2026-10-26; the memo read back from a
   real payment (D-117).**
3. Sidecar: disclosure export and verifier, if the gate passes.
4. Web: read-only route, then the seven beats in the approved order.
5. Copy pass, grandma and banned-word checks, typecheck.
6. Owner playtest on film, then the decision rows in DECISIONS.md.
