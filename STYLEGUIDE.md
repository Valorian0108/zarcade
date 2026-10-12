# STYLEGUIDE.md — the design foundation

> **Status:** v1.3 (2026-10-10). **All four layers APPROVED** (D-013, D-014,
> D-015, D-018). Display font = **Syne** (D-017). The Layer-4 copy pass and the
> font swap were applied together on 2026-10-10 after the owner approved the
> rewrite table ("everything passes move on").

---

## Layer 1 — The floor (anti-slop gates) · APPROVED (D-013)

Nothing visual reaches the owner until it passes, in order:

1. **Six-axis self-critique** — philosophy, hierarchy, execution, specificity,
   restraint, variety. Scored 1–5. Anything under 3 gets revised privately.
2. **The 58-gate slop test** (hallmark `references/slop-test.md`). Every gate
   must answer "no."
3. **Scorecard attached** — every visual shown to the owner arrives with a
   one-line report: axis scores + gate result. No scorecard = not reviewed.
4. **Documented overrides** — Layer 2 deliberately overrides hallmark's motion
   quieting (its ban on idle loops, "fade-in only" rules). Each override is
   named in the scorecard. Reduced-motion accessibility is NEVER overridden.
5. **Skill usage** — the hallmark skill itself is not invoked; only its
   slop-test document is used as the checklist (owner instruction, 2026-10-10).
6. **Reference skills (D-016, installed 2026-10-10)** — `frontend-design`
   (Anthropic), `animation-vocabulary` (Emil Kowalski), `emilkowalski-motion`
   (nexu-io), `design-motion-principles` (kylezantos) live in
   `C:\Users\USER\agent\skills` and inform Layers 2–3. Where a reference
   conflicts with this STYLEGUIDE (e.g. its quieting of ambient motion),
   **this STYLEGUIDE wins** — it is the owner-approved constitution.

## Layer 2 — The soul (game-feel spec) · APPROVED (D-014)

1. **The world breathes when idle.** Characters have idle loops (float, blink,
   drift). A screen with no input must never look frozen. (Deliberate override
   of hallmark's infinite-loop ban — hallmark designs pages; we design a game.)
2. **Every input answers in under ~150ms.** Press states are instant, hover is
   a 1px lift, nothing makes the player wait for feedback.
3. **Characters react to choices.** The Watcher leans in when data leaks; goes
   blind when data is shielded. Reaction is feedback, and feedback is teaching.
4. **Motion is the teacher.** Every mechanic has a signature animation (the
   seal sweep *is* the lesson on shielding; the meter fill *is* exposure). If
   we can't state what a motion explains, it gets cut.
5. **Tension and release.** Leaks escalate (meter, red, Watcher stirs);
   shields resolve (calm, green, quiet).
6. **Anticipation and follow-through.** Big state changes telegraph first;
   characters settle with secondary motion (motes, sway) after moving.
7. **Reduced motion is non-negotiable.** Under `prefers-reduced-motion`, all
   loops and spatial motion collapse to crossfades and the lesson still reads.
   This rule outranks every other rule in this layer.

## Layer 3 — The look ("night arcade") · APPROVED (D-015)

- **Canvas:** deep charcoal, faintly violet-tinted; one fixed subtle warm bloom
  behind the stage. No glassmorphism, no gradient text, no mesh gradients.
- **One accent:** Zcash gold, under 5% of any viewport — reserved for what is
  important or interactive. Rationale: it is Zcash's actual brand color, so the
  accent carries meaning instead of decorating.
- **Meaning colors:** green = valid/sealed, red = leak/exposed. Desaturated —
  signals, never alarm paint.
- **Type:** display face **TBD** (see note), Geist for body, Geist Mono ONLY
  for on-chain data — mono means "the machine is talking." Rationale: players
  learn to tell real chain data from game dressing by font alone.
  - ⚠️ **Open item from the skills research (2026-10-10):** the scaffold's
    current display face (Space Grotesk) is explicitly listed as *overused* by
    Anthropic's frontend-design skill. Alternatives will be proposed (2–3
    options with reasoning) at the D-015 review. Owner picks.
- **Surfaces:** cards one step lighter than canvas, 1px borders at 10% white,
  0.5rem radius.
- **Art:** custom vector characters and icons only; no emoji, no mixed icon
  libraries (D-010).
- **Copy voice:** plain words, present tense, second person. Names chain
  concepts exactly (shielded pool, proof, transparent chain). No marketing
  shine, no fabricated claims.

### Amendments from the installed references (2026-10-10)

Grading Layer 3 against `frontend-design`, `design-motion-principles`, and
`emilkowalski-motion` produced these binding amendments:

1. **Display font must change.** frontend-design: choose typefaces "not the
   default families you would reach for on any other project." Space Grotesk
   is such a default → dead. 2–3 distinctive options will be proposed; owner picks.
2. **Mono discipline is absolute.** "A monospace face for small data labels" is
   a listed template tell. Our mono appears ONLY as actual on-chain data —
   never as labels, eyebrows, or decoration.
3. **Boldness in one place.** frontend-design: "let one element be the
   memorable thing, keep everything around it quiet." Per screen, ONE living
   star (in the preview: the Watcher). The stage stays quiet; no scattered
   ambient effects; stagger only on the single deliberate moment (≤1 per view).
4. **Motion timings.** UI answers 140–220ms (matches D-014's ~150ms); character
   moments may run longer; exits subtler than entrances; no animation over
   300ms on controls; springs/bounce only on playful/celebration elements
   (the Watcher), never on utility buttons.
5. **Idle-loop exception is documented.** design-motion-principles flags
   looped motion "unless it communicates status" or carries "explicit design
   rationale stated in code comments or design docs." The Watcher's idle IS
   the status ("the public is always watching") and the rationale lives here
   (D-014) + in code comments. Legitimate by the reference's own exception.

### Cast

- **The Watcher** [PROPOSED as first build] — "the public" as a character:
  floating sentinel, single gold eye. Moods: calm / alert (it saw your data) /
  blind (you shielded). It is G1's mechanic embodied.
- Seal, Coin (clear + sealed), Auditor — later passes, per OUTLINE.md.

### Why this and not a catalogue theme (rationale trace)

Every Layer-3 element traces to documents the owner already approved — this is
an assembly, not an invention:

| Element | Source |
|---|---|
| Charcoal + one gold accent + green/red + mono-for-data | ARCHITECTURE.md design foundation, approved v1 (D-012) |
| Custom characters, no emoji | D-010 |
| Watcher, Seal, Coin, Auditor cast | OUTLINE.md, approved v1 (D-012) |
| Two buttons + leak meter scene | G1 "Unseen", SCOPE.md (D-007) |
| Living/moving first look, not a static sheet | Owner feedback 2026-10-10 ("i thought id see characters and movents") |
| No hallmark/theme-factory catalogue theme | Catalogue themes are pre-made identities for *pages*; adopting one dresses our game in someone else's costume and fails the specificity axis |

Honest caveat recorded per D-013: "dark background + single accent" is also a
common AI-default *shape*. What makes it a choice here: every element has a
reason (Zcash's brand gold, the secrecy subject, mono as a teaching device),
and the specificity must come from the characters, the scene, and the motion —
not from the palette. The scorecard for the world preview must demonstrate it.

## Layer 4 — The voice (how words read) · APPROVED (D-018)

Owner feedback, 2026-10-10: the wording reads like corporate AI. It is not
helpful. The em dash in the UI is called out by name. The fix is a hard rule.

### The rule (the grandma test)

1. **A grandparent must get it.** Every sentence on screen has to make sense to
   someone with no crypto background and no one there to explain. If a reader
   would have to ask "what does this mean?", rewrite it.
2. **No em dashes in UI copy.** Not one. Use a period, a comma, or split the
   sentence in two. (This document is internal and predates the rule; UI copy
   is held to it strictly.)
3. **No buzzwords.** Banned on sight, in UI and in my messages to the owner:
   seamless, robust, leverage, empower, unlock, dive deep / delve, landscape,
   ecosystem, "in today's world", elevate, cutting-edge, state-of-the-art,
   game-changer, revolutionize, streamline, holistic, journey, "look no
   further", "whether you're a beginner or an expert", rest assured, it's
   important to note, tapestry, realm, foster, facilitate, utilize.
4. **Short sentences. One idea each.** Plain Anglo words beat Latin ones:
   "use" not "utilize", "show" not "demonstrate", "check" not "verify".
5. **Lesson words are allowed only when the same screen teaches them.** The
   words "proof", "shielded", and "memo" are the point of the game, so they
   stay, but the first time each appears, plain words next to it say what it
   means. No unexplained jargon.
6. **This binds me too.** My replies to the owner follow rules 1, 3, and 4.
   Plain talk, no buzzwords, no walls of text.

### The rewrite · every string on the preview screen · APPROVED + APPLIED

Owner approved the whole table verbatim ("everything passes move on",
2026-10-10). Every row below was applied to code the same day, together with
the Syne font swap (D-017).

| Where | Now (fails) | Proposed (passes) |
|---|---|---|
| Tab title | World preview — night arcade | A first look at the game |
| Heading | You are paying a friend 5 ZEC. | You are sending a friend 5 ZEC. |
| Under heading | The whole network can watch the transaction happen. You have one choice: what it gets to see. This scene is the world preview — a slice of the first game, Unseen. | Everyone on the network can watch this payment. You get to choose one thing: how much they see. This is a first look at Unseen, the first game. |
| Card title | What the chain shows | What the network can see |
| Card, before you choose | waiting for your choice | waiting for you to choose |
| Card, if you hide it | proof valid · pool: shielded | the math checked out · hidden pool |
| Card, if you don't | confirmed · transparent chain | on the public list, in plain text |
| Watcher, idle | It watches every transparent transaction. Not evil — just… everyone. | It watches every payment that is not hidden. It is not mean. It is just everyone, looking. |
| Watcher, you hid it | It sees a valid proof and nothing more. Your business is yours. | It only sees that the payment is real. Nothing else. Your business stays yours. |
| Watcher, you did not | It just read your payment. Sender, amount, memo. All of it. | It just read your payment. Who paid, how much, and the note. All of it. |
| Meter, before | Nothing yet — you haven't sent anything. | Nothing yet. You have not sent anything. |
| Meter, you hid it | Nothing. A valid proof, and that is all. | Nothing. The network checked the math and learned no secrets. |
| Meter, you did not | Everything: who paid, who received, how much, and the memo. Forever. | Everything. Who paid, who got paid, how much, and the note. Forever. |
| Lesson, you hid it | You moved 5 ZEC into the shielded pool. The network verified a zero-knowledge proof that the coins are real — without revealing who sent them, who received them, or the amount. The Watcher learned only that a valid transaction happened. | You put 5 ZEC into the hidden pool. The network ran a math check (that is what "proof" means here) that the coins are real. The check never shows who paid, who got paid, or how much. The Watcher learned only that a real payment happened. |
| Lesson, you did not | The transaction was written to the transparent chain in plain text. Anyone — the Watcher — can now read the sender, the recipient, the amount, and the memo. Nothing broke; this is simply what "transparent" means. | The payment was written on the public list in plain text. Anyone can read it now, the Watcher included. Who paid, who got paid, how much, and the note. Nothing went wrong. This is just what "public" means. |
| Buttons | hide it · don't hide it · try the other choice | hide it · don't hide it · try the other way |

### Why this is not dumbing it down

The game still teaches the real ideas: shielded pool, proof, public chain. It
just refuses to make the reader feel stupid while doing it. Plain words carry
a hard idea further than fancy words carry an easy one.

## Layer 5 — The reveal system (light vs. shadow) · APPROVED (D-044) — applied to the real game and validated by the owner on live testnet payments, 2026-10-12

### Amendment 3 (D-046, approved 2026-10-12): the slot grammar

The sample is one composed moment with fixed content. The game screens are flows
with variable content (notices, errors, a locked round). This amendment is the
rule that lets flow screens wear the sample's composition without clustering:

- **Panels hold objects, never prose.** Left panel slots, top to bottom:
  eyebrow, then the display line and at most one card in whichever order the
  moment needs (the sample puts the card first when the big number is the
  star), open space, bottom anchor (the button or the decision note). The
  open space is structural, not leftover: it is what makes a panel feel
  composed.
- **Conditional objects** (refill notice, send error) enter between the card
  and the anchor, styled as cards, only when true. They are state, not prose.
- **Right panel slots:** eyebrow, one status sentence, open space, receipts,
  then pips and readout anchored to the bottom.
- **Prose lives below the stage** in the caption slot, in the big teach voice,
  two short paragraphs maximum. This is the single teaching place on every
  screen except the reveal, where the twist caption already holds it.
- **Three text weights per panel, never more:** display, object, micro.
- A screen that needs a new slot changes this spec first, in writing, not in
  code.

> Proven in the throwaway sample at `/sample` and approved by the owner
> ("this is brilliance", 2026-10-12). This layer is the visual system that
> carries BRIEF.md's one idea into pixels. It becomes APPROVED when the owner
> lifts the sample-only restriction and it is applied to the real game.

### The one rule

Light versus shadow IS the lesson. Gold light falls on what the public can
read. Cool shadow holds what is sealed. There is no third state and no verdict
colour: nothing is ever red or green, and nothing is ever coloured to say
"good" or "bad." Meaning comes from covered versus revealed, and from the
Watcher's reaction, never from a traffic-light colour.

### Palette (scoped values from the sample)

- Base `#141119` with two motivated glows: a faint gold radial from the
  lantern side (top-right), a faint violet radial bottom-left. Not a flat
  poster; the light has a source.
- Panel `#1b1724`, raised surface `#221d2e`, hairline `rgba(255,255,255,0.08)`.
- Ink `#f4efe4`, body `#c8c2d0`, muted `#8b8496`.
- Gold `#edb64a`, gold-bright `#ffcf6e` (the "lit / public / look here" colour).
- Shadow-side `#a89fc4` (the "sealed / private" colour, cool and receding).

### Layout: two panels, one hinge

The reveal screen is two perspectives side by side. Left = your side (the goal,
the amount, your decision). Right = what a stranger can see (the four facts the
chain records). Between them, on a vertical hairline, sits the Watcher as the
hinge: it is the public personified, and it leans toward whichever side the
record lights up. On narrow screens the panels stack in the same order and the
hinge becomes a horizontal line; the Watcher stays the hinge.

Amended by D-048 (approved 2026-10-12): **the left panel is the wide panel.**
The stage split is `1.3fr : 170px : 1fr`. The left box carries the sentences
players read, so it gets the comfortable measure (near 60 characters a line at
full width); the right panel keeps roughly the width the owner approved for the
reveal rows. One rule in the shared frame, inherited by every screen and every
future game.

### The Watcher

A hooded sentinel with one gold eye and a lantern on its arm. The lantern is
its job made visible: it lights what the public can read. It idles (slow float,
blink, flame flicker, two drifting motes) and it reacts: when the record starts
lighting up, the lantern flares and the eye widens. Custom vector, part of the
D-010 cast. It never judges with colour; it only watches and lights.

### The seal

The choice and the sealed facts use one mark: a wax seal. Pressed and intact =
sealed (cool shadow, filled). Never pressed, ring broken open at the top with a
speck of light in the gap = open (gold). The same mark scales from the small
decision note to the "Sealed by the private pool" bar. No lock emoji, no
off-the-shelf icon.

### Type · amended by D-047 (approved 2026-10-12): the two voices

- **Voice 1, Syne (display):** everything you act on or stare at. The big
  amount, the decision, the twist line, titles, the intro list, primary
  buttons. Used expressively. The twist line gets the largest Syne on screen,
  with the public word lit gold and the hidden word in cool shadow.
- **Voice 2, Space Grotesk (prose):** every sentence that talks to the player.
  Teaching captions, round briefs, status lines, card text, notices. The prose
  keeps the cabinet's techy energy, cut from the same machine as the titles.
  Picked by the owner on the /sample/type specimen (Direction 2), first as
  Newsreader (D-047) and then flipped to the grotesk (D-049). Worn at the
  system's default prose sizes; the serif-era 16px/1.7 tuning was reverted.
- **Mono (Geist Mono):** reserved strictly for on-chain data (addresses,
  amounts on the public list, the transaction id).
- **Banned:** Geist Sans, the Next.js framework default. It was never chosen,
  only inherited, and the owner spotted exactly that. No screen of the arcade
  may fall back to an unchosen voice.

### The reveal is the climax

The four public rows start shuttered. They open one at a time on a short
staggered schedule; sealed rows settle with a seam flash, lit rows slide open
and catch a gold left edge. The leak readout (pips) fills as facts become
public. The Watcher flares when the record lights. The twist line and its
teaching paragraph land last. Nothing decorative competes with the moment a
real, checkable on-chain fact appears.

### Reduced motion

Under `prefers-reduced-motion`, the final state renders immediately: every
shutter is open, the twist line is shown, the Watcher holds still. The lesson
reads fully without any animation. (Keep versus remove is still an open owner
decision; this layer assumes keep.)

### What this layer forbids

- Any red or green, or any colour used as a verdict.
- Any generic UI badge (pill chip with icon + label) standing in for a decision
  or a fact. Decisions are margin notes; facts are rows.
- Any emoji or off-the-shelf icon set.
- Spectacle that does not point at a real on-chain fact.
