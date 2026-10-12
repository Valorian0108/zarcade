# SCOPE

> **Status:** **APPROVED v1 (2026-10-10)** — D-004/005/006/007. Structure, the
> design rule, and G1 ("Unseen", corrected) are confirmed by the owner. G2–G7
> are queued, not committed.

## Structure (DECIDED — D-004, D-005)

- An **arcade**: a hub where the player picks which mini-game to learn from.
  Each Zcash feature = its own game.
- Build **one game first**; add others only after the first works as planned.

## The Rule for every game (DECIDED — D-006)

- A **real mini-game** (simple is fine) that **shows how the feature works**.
- **Passable** — never an impossible puzzle.
- **But you cannot pass without learning:** the win condition requires
  understanding the mechanic. No mindless wins. The feature's real behavior IS
  the rule you must internalize to win. **Success = comprehension.**

## Candidate games (one per feature)

| ID | Game | Feature it teaches |
|----|------|--------------------|
| G1 | **Unseen** — hide payments from the *public* watcher (the person you pay still sees them); learn when you can and can't hide | Shielded vs. transparent (the thesis) |
| G2 | **The Proof Puzzle** — convince a guard you know a secret without saying it | zk-SNARK / zero-knowledge proof |
| G3 | **The Double-Spend Heist** — catch (or play) a cheater reusing a coin | Nullifiers |
| G4 | **The Auditor's Key** — read a locked diary with the right key; read ≠ spend | Viewing keys / selective disclosure |
| G5 | **The Vault Run** — move coins between rooms without leaking on the glass side | Pools / crossing leaks |
| G6 | One Mailbox — one address, letters route to the right box | Unified Addresses *(optional/low)* |
| G7 | Jar vs. Seal — crowded jar + wait vs. instant sealed proof | Why Zcash ≠ mixer *(optional/low)* |

## MVP = Game #1 only (for now)

- Build **G1 "Unseen"** to a playable, passable-but-requires-understanding state,
  grounded in real testnet transactions where feasible.
- Everything else is **queued, not committed.** We add games only after G1
  validates the approach (per D-005).

## Priority order (for later games)

G1 first. Owner to rank G2–G5 when G1 is validated.

## OUT of scope (for now)

- All games except G1.
- Real in-browser zk-SNARK *proving* (very heavy) — revisit later.
- Mainnet — we build/demo on **testnet**.

## Open (owner to confirm)

- [x] **G1 = "Unseen"** confirmed as the first game (corrected version, D-007).
- [ ] Rank G2–G5 for the build-after-G1 order.
