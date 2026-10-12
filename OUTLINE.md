# OUTLINE — Master Build Blueprint

> **Status:** **APPROVED v1 (2026-10-10)** — D-012. This is the **complete
> inventory of what the build contains.** Items marked [PROPOSED] are AI
> suggestions the owner may still trim/correct when they see them (characters,
> microinteractions). Building proceeds per ROADMAP Phase A.

## 0. How to read this (accountability)

- Every checkbox is a **unit** the owner can approve or cut.
- Layers: Site map → Design system → Characters → Microinteractions → G1
  breakdown → Real-Zcash wiring → Future games → Build phases.
- `ROADMAP.md` says *when* we build; this says *what* exists.

---

## 1. The product at a glance

An **arcade** of mini-games, each teaching one Zcash feature by making you play
it. **Game 1 = "Unseen"** is built first. Real **testnet** transactions under
the hood. A tuned **design system** + a **custom character system** (no emoji)
keep it cohesive. The Rule (D-006): every game is passable but requires
understanding to win.

---

## 2. Site map (pages / routes)

- [ ] `/` — the **arcade hub / lobby**: pick a game; shows what each teaches.
- [ ] `/games/unseen` — **Game 1**.
- [ ] Loading + error + "not built yet" states (for future games).
- [ ] (optional, later) `/learn` — an index of the plain-language explanations.
- [ ] (future) `/games/proof`, `/games/doublespend`, `/games/auditor`,
      `/games/vaults` — stubbed as "coming soon" cabinets in the hub.

---

## 2b. Hub shell detail (A4) · [PROPOSED, D-019 pending]

**Concept: one lit cabinet in a dark arcade room.** The lobby is a dim room.
Five cabinets stand in it. Exactly one is plugged in and glowing: "Unseen",
the game you can play now. The others are dark, quiet, and honest about it:
"coming soon". One lit cabinet = one living star (Layer 3 amendment 3), and it
puts the player's eye exactly where the first click belongs.

**Layout (desktop):** one tall lit cabinet on the left (about double width),
four smaller dark cabinets on the right in a 2x2 stack. Asymmetric on purpose;
an even grid of identical tiles is a known slop shape. Mobile: single column,
lit cabinet first. Above everything, a small marquee sign with the working
title (until the owner names the project) and one plain line.

```
+--------------------+  +------------+  +------------+
|                    |  | The Proof  |  | The Double-|
|      UNSEEN        |  | Puzzle     |  | Spend Heist|
|  (screen alive:    |  | (dark)     |  | (dark)     |
|   the Watcher      |  +------------+  +------------+
|   watches back)    |  +------------+  +------------+
|   ready to play    |  | The        |  | The Vault  |
|                    |  | Auditor's  |  | Run        |
+--------------------+  | Key (dark) |  | (dark)     |
                        +------------+  +------------+
```

**The lit cabinet (Unseen):**
- Screen shows the Watcher itself (reuse `components/watcher.tsx`, calm mood,
  blink + pupil drift idle). The cabinet is the one living thing on the page.
- Gold marquee, game name in the display face (Syne), status line
  "ready to play", and an always-visible teach line:
  "Send money without the whole network watching."
- Soft static light pool on the floor under it (token color-mix, no motion).
- Click: a "power on" beat (~600ms flare of screen + marquee), then navigate.
  Target today: `/preview` (the world preview). After A5: `/games/unseen`.
- On first load: this cabinet powers on once. That is the page's single
  choreographed moment (one stagger rule).

**The dark cabinets (G2–G5, from approved SCOPE):**
- Screens off, names muted, small "coming soon" tag. Not clickable, so no
  dead links. Hover/focus: 1px lift + name brightens, 140ms (Layer 2 rule 2).
- Each carries a one-line teach, always visible (no hover-only content):
  - The Proof Puzzle: "Show a guard you know a secret, without saying it."
  - The Double-Spend Heist: "Catch a cheater spending the same coin twice."
  - The Auditor's Key: "Give a trusted person a key to look at your payments.
    Looking is not spending."
  - The Vault Run: "Move coins between the public side and the private side
    without leaving a trail."
- [PROPOSED, owner option] A faint custom glyph on each dark screen (puzzle
  piece, split coin, key, vault door). Would be the first four pieces of the
  site-wide custom icon set (D-010). Include or skip: owner call.
- Not shown: G6 (One Mailbox) and G7 (Jar vs. Seal). SCOPE marks them
  optional/low and unranked; adding cabinets for unbuilt optional games would
  overpromise.

**Sign copy (grandma rule, D-018):**
- Heading: "Pick a game and learn by playing."
- One line under it: "Each game shows one way Zcash keeps payments private.
  No reading required."

**Motion plan (Layer 2 + amendments):** idle life only inside the lit screen;
140ms hover/press on every cabinet; one power-on on load, one on click;
`prefers-reduced-motion`: no flares, no idle, instant states, all text still
readable. Everything transform/opacity only. Dark-cabinet glyphs are static and
faint on the hub; a tiny hover teaser is allowed (input feedback), but no
ambient loops, so the lit cabinet stays the one living star (Layer 3 amend. 3).
Each game's full **signature animation** (e.g. the key turning and the vault
opening in G4) lives *inside that game*, built in Phase B, per Layer 2 rule 4
"motion is the teacher" — not on the hub.

**Tech notes:** replaces the template home page. `app/page.tsx` (server)
renders `<Hub />` (client) from `components/hub/`: `cabinet.tsx` (vector
cabinet, props: lit/dark, name, teach, href, glyph) + `hub.tsx` (sign +
asymmetric grid). All colors via tokens, all art custom inline SVG, no emoji,
no icon libraries. Ships under the D-013 gate with a scorecard.

**Owner decision points (become D-019 when all four are answered):**
1. Concept + asymmetric layout: **CONFIRMED by owner** ("ok yes", 2026-10-10).
   Build the hub **data-driven** from a `games` config (each entry:
   name, teach line, `status: playable | soon`). Sort playable first; give the
   hero (double-width) treatment to the *first playable* cabinet, not hardcoded
   to Unseen. Then lighting up G2 later is a one-line config flip, not a
   redesign. Layout is safe for the full scope this way.
2. Faint glyphs on dark screens: **CONFIRMED include by owner** ("include them",
   2026-10-10) **plus a tiny cursor tease** ("yes a customized cursor
   movement"). The four custom vectors seed the D-010 icon set and match the
   preview's CheckGlyph/EyeGlyph stroke style.
3. Sign copy: **CONFIRMED by owner** ("fine", 2026-10-10).
4. G6 + G7 stay hidden for now: **CONFIRMED by owner** ("stay hidden for now",
   2026-10-10).

---

## 3. The design system (the tuned "senior kit")

- [ ] **Color tokens:** charcoal neutral ramp · one gold/amber accent ·
      green = valid · red = leak. WCAG-checked. (OKLCH/Radix method.)
- [ ] **Type:** one display face + one **monospace for on-chain data** + one
      readable body face; a modular size scale.
- [ ] **Spacing:** 8pt scale; readable column for text; full-bleed game stage.
- [ ] **Shape/motion tokens:** corner radii, shadows, animation durations +
      one easing curve.
- [ ] **Component library** (shadcn/ui + Radix): button, card, dialog, meter,
      panel — engineered & accessible, not hand-rolled.
- [ ] **Layout system:** hub grid of "cabinets"; game = stage + watcher +
      plain-language explanation panel.
- [ ] **Accessibility:** contrast, visible focus, keyboard operable.

---

## 4. Custom character & illustration system (D-010) — NO emoji

- [ ] **Rule:** one consistent custom cast + a custom icon set, used everywhere.
- [ ] **The cast** [PROPOSED — owner to confirm/trim]:
  - [ ] **The Watcher** — the nosy public observer; reacts to leaks (the core
        teaching character for G1).
  - [ ] **The Seal / Lock** — the "shielded" symbol; stamps/animates when data
        hides.
  - [ ] **The Coin / Note** — the thing being sent; has a *clear* state and a
        *sealed* state.
  - [ ] **The Auditor** — holds viewing keys (for Game 4 later).
  - [ ] **You / player avatar** (optional).
- [ ] **Custom icon set** [PROPOSED] — send, hide, reveal, key, lock, etc.
      (drawn in-style, not emoji).
- [ ] **Style guide** [PROPOSED] — line weight, palette, shapes, an expression
      set per character, so a character on the hub matches one in a game.
- [ ] **Format:** vector (SVG / CSS-drawn) — crisp, consistent, animatable,
      lightweight, no external illustrator or image-gen.

---

## 5. Microinteractions inventory (the small moves that teach)

> A microinteraction = a small animation/response to an action. Each one here
> has a **teaching purpose** (not decoration).

- [ ] **Hub:** cabinet hover-lift; a cabinet "powers on" when opened.
- [ ] **G1 — the belt:** the coin travels across the stage when you send.
- [ ] **G1 — hide it:** a **seal stamps** the coin; the Watcher's eyes go
      blank/confused; leak meter stays flat.
- [ ] **G1 — don't hide it:** data labels **light up** (who / how much); the
      Watcher reads them; leak meter fills.
- [ ] **G1 — result:** a "what leaked" panel reveals the **real** on-chain
      fields.
- [ ] **Core teaching motion:** a **seal/encrypt** transition (data hides) and
      a **reveal** transition (data shows) — reused across all games.
- [ ] **Feedback:** button press states, focus rings, round transitions,
      win/lose reactions from the Watcher.

### Signature animation per game (Phase B motion spec · D-020)

Layer 2 rule 4 ("motion is the teacher") made concrete. Each game gets ONE
signature animation, and that animation IS the lesson. If we cannot say what a
motion teaches, it gets cut. All honor `prefers-reduced-motion` (collapse to a
crossfade; the lesson still reads). Owner-approved ("yes write it", 2026-10-10).

- **G1 Unseen — the seal sweep.** Black bars cover the name, amount, and note,
  row by row (already built in the preview). Teaches: shielding hides the data.
  The Watcher's eye shuts (blind).
- **G2 Proof Puzzle — the gate opens, the box stays sealed.** A guard's gate
  opens and you pass, but your secret box never opens. Teaches: a
  zero-knowledge proof convinces without revealing the secret.
- **G3 Double-Spend Heist — the second shadow matches the first.** Spending a
  coin drops a shadow (nullifier) on a public board. Spend the same coin again
  and the second shadow lands exactly on the first; the board flashes "already
  here" and rejects it. Teaches: nullifiers stop double-spends without showing
  which coin.
- **G4 Auditor's Key — the key turns, the vault opens, the coins stay put.** The
  key moves to the lock, slides in, turns; the vault/diary opens and the
  payments are readable. But no coin moves, nothing is spent. Teaches: a
  viewing key lets someone look, not take.
- **G5 Vault Run — the crossing leaks on the glass side.** A coin travels from
  the glass room (public) to the solid room (private). At the crossing, the
  glass side briefly shows the source and amount. Teaches: crossing pools leaks;
  staying shielded-to-shielded does not.

Hub note: these run INSIDE each game in Phase B, not on the hub. On the hub the
dark cabinets show a static faint glyph plus a tiny cursor tease; only the lit
cabinet (Unseen) is alive.

### Shared game frame (A5)

Every game lives inside ONE reusable frame so the arcade feels like a single
place, not five different apps. The frame has four regions, identical across
all games:
- **Header:** game name in the display face (Syne) + the one-line teach.
- **Stage:** the scene, with a reserved **Watcher slot** on the right so the
  public is always in the room (watching, or blind when you hide things).
- **Explanation panel:** plain words for what just happened (Layer 4 voice).
- **Leak meter:** one bar that fills with exactly what the public learned.
The frame is presentational only; game logic lives in each game (Phase B). For
A5 the frame ships with a minimal Unseen beat (hide it / leave it open) so every
region is demonstrable and alive; Phase B replaces that beat with full rounds.

---

## 6. Game 1 — "Unseen" (full breakdown)

- [x] **Goal / win condition (CORRECTED 2026-10-12):** each round states what
      doing it well means, and the round is met when the player's choice matches
      that. Pass by getting all three right, which needs understanding *when* to
      hide (The Rule).
      The earlier wording, "keep the leak meter under the limit across all
      rounds", cannot be satisfied and was dropped: R2 has to be open to be
      provable and R3 has no other option, so a lower-is-better meter would
      punish the player for doing the right thing. The leak meter stays, but as a
      readout of what the public actually learned rather than a penalty bar. It is
      computed from facts the server read back off the chain, so it cannot
      disagree with the explorer link sitting beside it.
- [x] **What an open round really leaks (H7, verified on a real transaction):**
      two of the four things a stranger could learn, not three. The destination
      and the amount are public. The note is not a leak, because an open payment
      cannot carry one at all. The sender is not a leak either, because the coins
      leave the shielded pool and the pool never says which of its users they came
      from. ZecBlock's own Blend Check scores our real open tx 0/100 and finds
      "nothing here for an outside observer to connect". R2's teaching beat is
      exactly that surprise: paying in the open still does not name you.
- [x] **The two controls:** **"hide it"** (shielded) / **"don't hide it"**
      (transparent).
- [x] **Rounds** (corrected set):
  - [x] R1 — make a payment and keep it from the *public* → hide it. A real
        shielded payment to the arcade's own private address.
  - [x] R2 — the same payment, shown → don't hide it. A real open payment to the
        arcade's own open address. See the contrast.
  - [x] R3 — the destination is a bare open address, which the network cannot pay
        shielded, so the hide control is unavailable (D-039). **This constraint is
        REAL, not represented:** it is a property of the exact address the arcade
        already pays, not a rule the game invented. The lesson is that privacy
        needs both ends to agree.
  - [x] Both destinations belong to the arcade, and the game says so in one plain
        sentence rather than through a recipient character (D-040).
- [x] **Screens / states:** intro & explain → round play → result (what leaked,
      from the real tx) → next round → final summary → replay. Also three waits
      that are not errors: the pot settling, the arcade refilling, and the
      player's share of the hour being used up. Each says what to do next and how
      long it will take, and each leaves the round unspent.
- [x] **The leak meter** (in the shared frame, driven by the real tx).
- [x] **The "what the public sees" panel** (real on-chain fields, plus the real
      block number and a link to check both).
- [x] **Plain-language explanation panel** per round (the teaching text).

Built 2026-10-12, verified live on the canonical testnet. Awaiting owner
validation of the gameplay before B5 is called DONE.

---

## 7. Real-Zcash wiring (the honesty line)

- [ ] **REAL:** transparent send · shielded send · "what the public sees" panel
      (pulled from actual testnet transactions).
- [ ] **REPRESENTED (game layer):** the Watcher, the belt, rounds, win/lose.
- [ ] **Testnet:** the canonical NU7 chain (D-027), reached through a lightwalletd
      server at `testnet.zec.rocks`. Test coins come from the Zakura faucet.
- [ ] **CORRECTED 2026-10-12.** This section previously described a browser
      gRPC-web proxy and a WASM decoder running in the page. Both were superseded
      by D-024: a small Rust program on the same machine owns the wallet and does
      the proving, and nothing in the browser needs a viewing key, so client-side
      decoding was dropped rather than deferred. See ARCHITECTURE.md.
- [ ] **v1** sends every payment through that helper. Live in-browser proving
      remains a later upgrade, not a launch requirement.

---

## 8. Future games (queued, NOT built — from SCOPE.md)

- [ ] G2 Proof Puzzle (zk-SNARK) · G3 Double-Spend Heist (nullifiers) ·
      G4 Auditor's Key (viewing keys) · G5 Vault Run (pools) ·
      G6 One Mailbox (UA, optional) · G7 Jar vs. Seal (mixer, optional).

---

## 9. Build phases (summary — detail in ROADMAP.md)

- [ ] **Phase A — Foundation:** design system + custom characters + hub shell.
- [ ] **Phase B — G1 playable:** rounds + real wiring + microinteractions.
- [ ] **Phase C — Polish + submission:** demo video, writeup, docs.
- [ ] (later) G2…G7, one validated game at a time.

---

## 10. Open decisions (owner to confirm)

- [ ] Approve / cut / correct this whole outline.
- [ ] The character cast (trim or add).
- [ ] The art style sign-off (after seeing the first drawn characters).
- [ ] The microinteraction list.
- [ ] The route / page list.
