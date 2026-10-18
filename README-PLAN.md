# README-PLAN.md — the plan for the public README (APPROVED 2026-10-12, executed as D-054)

Owner approved with: AGREEMENT.md for the agreement, license picked now
(MIT), screenshots are not requested. All four files are written; no screenshots wait on anyone's window.

## The problem with the current README.md

It is a good document aimed at the wrong reader. Today it is the project home:
the accountability agreement, the document map, status lines. That serves the
owner, not a stranger. A Zecathon judge spends about two minutes per repo and
has read a hundred of them. Stale lines also hurt us: it says "B5 is next"
(B6 is done and pushed), it calls the track an open decision (resolved, Track
05 Wildcard), and it counts decisions to D-030 (we are at D-053).

Senior pattern: the README is the front door for outsiders. Operating details
live in their own file and get linked.

## The split

| File | Reader | Content |
|---|---|---|
| `README.md` (rewritten) | judges, players, curious devs | what it is, proof it is real, what you see, how it works, run it, limits |
| `OPERATING.md` (new, at the root like all house docs) | whoever runs the arcade | today's run steps, pot split, troubleshooting table, wallet-safety notes, updated |
| The agreement + doc map | stays internal | moves to the top of `DECISIONS.md` as a short preamble, or a new `AGREEMENT.md`; owner picks one |

## Section plan for the new README.md

Every section lists the exact facts it uses. No fact is invented at write time.

**1. Name + one sentence.** "Zarcade is an arcade that teaches Zcash privacy.
Every machine is a small game that moves real practice money on the Zcash test
network." Plus one line: built for the Zecathon, Track 05 Wildcard. No status
block, no badge wall.

**2. The ask (three lines).** You are asked to send a small payment. You pick
hide or open. Then you see exactly what a stranger can see. That is the lesson;
nobody has to know what a zero-knowledge proof is to feel it.

**3. Proof it is real (the hook, kept short).** Two mined testnet transactions,
linked to testnet.zecblock.com:
- shielded: `952a1959…f3299c77`, block 4,488,884. Explorer label: fully
  private, all amounts, senders and recipients encrypted.
- transparent: `7ffa8ea6…45bb914f2`, block 4,488,905. Explorer privacy score
  0/100, naming the amount and the recipient.
One sentence each. This section is why a judge believes the rest.

**4. What you see.** No screenshots are included. The reader is invited to play any round and check the real txid link on the explorer instead.

**5. How a round works (numbered, five steps).** Pick hide or open. The house
wallet sends 1,000 zatoshis, real testnet money. Hide: the payment goes to the
shielded pool. Open: it goes to a transparent address and the explorer shows
everything. You get the receipt with the txid and the block. The next player
can go right away because the pot is split into confirmed coins ahead of time.

**6. How it is built (short, for devs).** Two boxes and one arrow: Next.js 16
front end; a Rust sidecar (axum + librustzcash) that holds the house wallet,
seed never leaves `sidecar/data/`, listens on localhost only. Exactly one
route can move money. It accepts `{"choice": "hide" | "open"}` and nothing
else; amount and destination are fixed server-side; unexpected fields are
refused, not ignored. Three limits: global pause, per-visitor hourly share,
daily ceiling. Real numbers: ZIP-317 fees of 5,000 zatoshis per logical
action; about 12 seconds to build one proof; measured rounds 21 to 27 seconds;
confirmation waits 34 to 99 seconds against a 23.6 second average block.

**7. Run it locally.** Exact commands, updated from today's README: needs Rust
(plus VS Build Tools C++ on Windows) and Node. `cd sidecar; cargo run`, wait
for the first sync. Fund the house wallet from the Zakura NU7 faucet
(zakura.com/nu7). One honest warning line here, the fork story: faucets paying
on the abandoned pre-NU7 fork show money that does not exist on the canonical
chain; we learned it the hard way (D-027). `powershell -File
sidecar\split-pot.ps1` before a session, about eight minutes for 40 coins.
Then `npm install; npm run dev`, check `/api/house/status` says `ok: true`.
Troubleshooting table lives in OPERATING.md, linked.

**8. The look, five lines.** Gold means lit and public. Cool shadow means
sealed and private. No red and no green anywhere, nothing is graded by color.
The Watcher stands for everyone who can read the public record. Every entrance
asks the motion question and remembers the answer. Fonts: Syne, Space Grotesk,
Geist Mono for chain data. Links to STYLEGUIDE.md.

**9. Limits (the senior signal).** Testnet only, no real money, ever. One
machine is live; four cabinets are dark and the floor says so. One
confirmation cannot be skipped, so pacing depends on the chain. First sync is
slow. The house wallet serves one operator; it is not multi-tenant production
software.

**10. Repo map + credits.** One line per folder (app, components, lib,
lib/zcash, sidecar, assets, plus the doc set). House docs named in one
sentence: every decision with its why is in DECISIONS.md, the exact state of
each build step is in ROADMAP.md. License: owner decides (open question
below). Zecathon mention.

## Writing rules applied at write time (checklist)

- Grandma rule (D-018): plain short sentences, one idea each.
- No em dashes. No banned words: seamless, robust, leverage, unlock, elevate,
  delve, game-changer, blazing, effortless, "in today's fast-paced world".
- No rule of three. Pick the one true word.
- Specifics over adjectives: numbers, block heights, txids, crate versions.
- The first draft paragraph of every section gets deleted before commit.
- Read-aloud test on the whole file.
- Length target: about 150 lines. No badges, no emoji, no table of contents.
- Real failure notes stay in (the fork story); they cannot be faked.

## Assets we need from the owner

No screenshots are needed for the README. The README links to real receipts
on the explorer instead.

Optional, only if time allows before the submission: `round.gif`, one full
round from pick to receipt, about 25 seconds.

## Open questions — ANSWERED by the owner 2026-10-12

1. Agreement + doc map move to a new `AGREEMENT.md` (owner: "ok agrees").
2. License: picked now, MIT (assistant recommendation, owner said "pick now";
   one word from the owner changes it). A `LICENSE` file is created with it.
3. Screenshots are not requested; the gif only if time allows (owner: "ok screenshots withdrawn").

## Addendum - cool native GitHub elements, each pointing at a truth [PROPOSED]

Owner asked what cool implements exist for showing the approach. Menu, with the
assistant's picks. D-042 applies to prose too: no decoration, every element
carries a real fact.

1. **Mermaid diagram of the money path** - withdrawn. Was proposed but removed from README.md because it focused on one game's route, not the whole arcade.
2. **Collapsible field notes** (`<details><summary>`): the abandoned-fork
   faucet story (D-027), the self-audit hydration bug (D-051), the dust floor
   (RESEARCH I5). Main file stays short; verifiable war stories reward the
   curious. AI slop cannot fake these.
3. **"How this was built", three lines**: owner decides, AI drafts, nothing
   built until written down, every decision logged with its why. Links into
   DECISIONS.md and to single decisions (e.g. #d-027). The process IS the
   differentiator at an AI-flavored hackathon.
4. **Hide-versus-open comparison table**: two columns, real explorer labels,
   the 0/100 privacy score. The whole lesson in one glance.
5. **Footnotes** (`[^1]`): ZIP-317 fees, explorer labels, block heights.
6. **Real JSON block from `/api/house/status`**: actual output, actual
   numbers, proves the wallet is live.

Not used, on purpose: badge wall, emoji, table of contents, centered logo
banner.

## After approval

Log D-054 (this plan, the three answers, MIT, the addendum picks). Write the
new README.md, OPERATING.md, AGREEMENT.md, LICENSE. Docs only: no code
changes, gates unaffected. Commit only when the owner says.
