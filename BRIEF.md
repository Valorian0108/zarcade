# BRIEF — what each screen must say, before any look

> **Status: APPROVED by the owner (2026-10-12, D-042), except section 2 which is
> DEFERRED (D-043).** The owner answered "yes, yes, yes. yes" to the four
> questions in section 6, and clarified that "amusement park" was always a
> metaphor for the feeling of places like arcades and gaming/fun centres, never
> a literal redesign. Section 2 (the hub / front door) is on hold until the game
> redesign has taken effect: the owner will revisit whether Unseen should be the
> first page afterwards. Nothing here is a visual decision yet. This is the job description the visuals must be derived
> from. The order matters: we spent several messages picking moods (dark, gold,
> lantern, amusement park) before pinning down what the screens actually have to
> communicate. That is backwards, and it is why the result kept feeling like a
> costume. This document fixes the order. Once the owner approves it, the look is
> designed FROM it, and every visual choice must trace to a line here or get cut.

---

## 0. Why this document exists (the anti-slop anchor)

The test for whether a design is "AI slop" is simple: **could you pour a
different app into the same skin and nothing would break?** If yes, the skin is a
costume. If the design could only ever belong to THIS subject, it is real.

So far the mood I proposed (dark + one gold glow + a poetic lantern metaphor + a
mascot) is pourable. A weather app or a bank could wear it. That makes it
slop-adjacent, and the owner was right to smell it.

The fix is not a prettier mood. The fix is to make the design grow out of the one
thing only this product has: **it moves real Zcash testnet money and shows you,
from the actual chain, what the public could see.** No other app can wear that
skin. This brief writes down what that means screen by screen, so the design has
something un-pourable to grow from.

**The senior rule for everything downstream:** spectacle amplifies the truth; it
never replaces it. The most impressive moment on screen should be the moment a
real, surprising, on-chain fact lands — not a glow.

---

## 1. The product's one promise (the whole arcade)

> You learn how Zcash privacy really works by moving **real test money** and
> watching **what the public can actually see.** It is real, not a simulation.
> You need no wallet, no seed, no key.

Every screen serves this. "Real" is the differentiator and the source of the
wow. The design must make the realness felt (real numbers, real transaction
links, facts read off the chain), never hide it behind fake flourish.

---

## 2. Screen: the hub (arrival) — DEFERRED (D-043), revisit after the redesign

> The owner's unease: with one game built, Unseen is effectively the first page,
> and that does not sit right. Options (arcade floor / Unseen title screen /
> light front door) are logged in DECISIONS.md. The front door should match the
> world the game establishes, so this section gets rewritten after the game
> redesign lands, not before. D-019 stays approved and untouched meanwhile.

- **One idea:** this is a place where games teach you privacy by doing it for
  real, not a webpage listing links.
- **One action:** pick a game and enter it.
- **One moment:** the sense of arriving somewhere that is not a regular website.
  This must be earned by atmosphere and clarity, not by drawing literal arcade
  cabinets or carnival stripes (the owner's correction: amusement park as a
  *metaphor*, not a redesign).
- **Real content it must show:** the games that exist, what each teaches in one
  plain line, which one is playable now, and the honesty that the rest are not
  built yet.
- **Must not confuse:** that this is real testnet money and that the player needs
  no wallet or keys.

---

## 3. Screen: Unseen (the built game)

This is the screen that matters most, because it is real and finished. Its
communication job, taken straight from the built rounds (`lib/unseen.ts`):

### 3a. The Rule (what you must understand to win)

> **The right choice changes every round.** This is not "hide as much as
> possible." One round needs hiding, one needs showing, and one gives you no
> choice at all. You pass by reading what each round is really asking for.

If the design implies "lower leak = better," it has broken the lesson. The leak
meter is a **readout of what the public learned**, not a score and not a penalty
bar.

### 3b. The one idea

> The same payment, hidden or shown, changes exactly what a stranger can see —
> **and even an open payment never names the sender**, because the coins come out
> of the private pool.

That second half is the surprise, and it is the most memorable thing in the game.
Round 2 exists to deliver it.

### 3c. The one action

> Each round: choose **hide it** or **don't hide it** (round 3: the hide control
> is really unavailable, not greyed out for drama), then send real test money.

### 3d. The one moment (the payoff, the "drop")

> After your **real** transaction lands, the screen shows what the public can
> actually see, read back off the chain, with a real explorer link beside it.

This is the climax. It is impressive **because it is true and checkable**, not
because it glows. The signature animation (the seal covering or uncovering the
value) is staged here, synchronised with the real facts appearing.

### 3e. The three beats

1. **Round 1 — "Keep it to yourself."** Correct: hide. The network learns
   nothing. Teaches what shielding hides.
2. **Round 2 — "Prove you paid."** Correct: show. A stranger can now find it and
   read where it went and how much. **The twist:** look at the one row that
   stayed sealed anyway — *who sent it.* Going open gave away the destination and
   the amount, not the sender. This is the beat the whole screen should build
   toward.
3. **Round 3 — "An address with no choice."** Correct: send (hide is genuinely
   impossible). Teaches that privacy needs both ends to agree; it is a fact about
   the real address, not a rule the game invented.

### 3f. The real content it must show

- The two choices in plain words.
- The payment amount (real zatoshis).
- What the public can see, as the four things a stranger could learn: **who paid,
  who got paid, how much, the note** — each shown as revealed or sealed from the
  real facts.
- The leak readout (how many of the four are on show), computed from the chain.
- The real transaction id, the real block, and a real explorer link to check it.
- The honest proof-build wait (about 21–23 seconds), stated as normal, not broken.

### 3g. What must be undeniable (the honesty line)

Real transaction id, real explorer link, facts read off the chain, no simulation.
The screen will not claim a payment happened unless the server returned a real
transaction id and a full set of facts. This is the product's integrity and the
source of its wow. The design must surface it, never bury it.

### 3h. What must never confuse a first-timer (grandma rule)

- **No verdict colours.** Nothing on screen uses colour to say "good/bad." A
  correct answer must never be painted red. Meaning comes from the seal picture
  (covered vs revealed) and the Watcher's reaction.
- **Hiding is not "wrong" and showing is not "wrong."** Both are valid; the
  lesson is what each one reveals and when each is asked for.
- **"Leak" is a readout, not a score.** More revealed is not a failing grade; in
  round 2 it is the correct answer.
- **The waits are normal.** Proof-building, the pot settling, the arcade
  refilling, and the hourly limit are waits with a plain explanation and a time,
  never errors. Nothing was sent during a wait, so the round is still yours.

---

## 4. The Watcher's communication job

The Watcher is not decoration and not a corner mascot. It is the character that
says, without words or colour: **"the public is watching — and here is whether it
can see your payment."**

- When you hide: it cannot see (blind, turned away, light out).
- When you show: it sees (alert, looking at the revealed rows).
- Its reaction is the emotional statement of the one idea, and it is the reason we
  do not need red or green to tell the player how they did.

This is the "one living star" the style guide wanted, finally given a job tied to
the lesson.

---

## 5. Where the owner's "amusement park feeling" is earned

The owner's instinct (impressive, alive, not a regular webpage, cool animations)
is right. Translated into the job above, it becomes specific and un-pourable:

- **Arrival** = the hub feels like a place, not a link list (section 2).
- **Boldness** = confident type and scale so the lesson is unmistakable, not
  timid (this is what made it read as "regular webpage").
- **One spectacular payoff** = the reveal moment, staged because it is the truest
  thing on screen (3d).
- **A living mascot** = the Watcher reacting to what you just did (section 4).
- **The climb** = the proof-build wait made alive and part of the lesson, not dead
  time (3f).
- **Delight** = satisfying, tactile controls and small rewarding motion, each tied
  to an action that teaches.

What is explicitly OUT, because it is the literal costume trap: drawn arcade
cabinets, joysticks, ticket booths, carnival stripes, fake machine chrome, and any
glow or gradient that does not trace to a line in this brief.

---

## 6. What I need from the owner

React in plain terms. You do not have to picture anything; just judge the
sentences:

1. Is **the one idea** for Unseen (3b) what the game should teach? Especially the
   surprise that an open payment still hides the sender.
2. Is **the one moment** (3d) the right climax: the reveal of the real, checkable
   facts?
3. Is **The Rule** (3a) stated the way you understand it: the right choice
   changes every round?
4. Does section 5 capture the feeling you were reaching for, now tied to the job
   instead of floating free?

"yes", "no", or "this part is wrong, here is what I meant" is all I need. When
this is approved I will log the direction in DECISIONS.md and only then start
deriving the actual look from it.
