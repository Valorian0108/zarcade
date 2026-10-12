# AGREEMENT.md: how this project is worked on

Moved out of README.md by D-054 so the README can face the public. This is
the internal agreement between the owner and the assistant, and the map of
the documents that hold the truth.

## The accountability agreement

1. **The owner proposes and decides. The AI advises and drafts.** Every
   material decision is presented with options, trade-offs and a
   recommendation, but the owner approves or changes it. Nothing is built on
   an AI assumption.
2. **Nothing is built until it is written down and approved.** Order of
   work: Vision, Research, Scope, Architecture, Decisions, Roadmap, Code.
3. **Every decision is logged** in `DECISIONS.md` with the why, the
   alternatives considered, and who decided.
4. **Open questions stay visible.** Gaps are never silently filled with
   generic defaults; they live in the open-decisions list until the owner
   chooses.
5. **The owner owns the documents.** The AI drafts; the owner reviews,
   edits, and approves. The docs are the source of truth, not the chat
   history.

**The gate has been passed:** all foundation documents existed and were
approved before any code was written. Code changes only what a logged
decision authorises.

## Document map

| # | Document | Purpose | State |
|---|----------|---------|-------|
| 1 | `VISION.md` | The why, audience, goal, core promise, what it IS / IS NOT | **Approved v1** (2026-10-10) |
| 2 | `RESEARCH.md` | The Zcash knowledge base; what is real vs. simulated | Filled A–E, G, H, I; researched live, including the testnet chain split and measured round timings |
| 3 | `SCOPE.md` | What is IN / OUT; the games; priorities; MVP definition | **Approved v1** (2026-10-10) |
| 4 | `ARCHITECTURE.md` | Stack, Zcash integration, visual system, layout | **Approved v1** (2026-10-10); network and honesty sections rewritten 2026-10-11 to match what was actually built |
| 4b | `OUTLINE.md` | Master blueprint: pages, components, characters, microinteractions, G1 breakdown, wiring | **Approved v1** (2026-10-10) |
| 4c | `STYLEGUIDE.md` | Design foundation: the slop gate, the motion spec, the look | Layers 1–3 **approved** (D-013/D-014/D-015/D-017); Layer 5 system **approved** via the sample (D-044) |
| 4d | `BRIEF.md` | The anti-slop brief: every effect must point at a truth | **Approved** (D-042) |
| 5 | `DECISIONS.md` | Running log of every decision + why + who decided | Ongoing; D-001…D-054 logged, plus a visible list of what is still open |
| 6 | `ROADMAP.md` | Phases in order, each with a definition of done | Ongoing; Phase 1 DONE; Phase 2 B1–B6 DONE; Phase 3 to be defined; Phase N is the Zecathon submission |
| 7 | `OPERATING.md` | Running the arcade: sidecar, funding, pot split, troubleshooting | **Live** (D-054) |
| 8 | `AGREEMENT.md` | This file: the agreement and the document map | **Live** (D-054) |
| 9 | `README-PLAN.md` | The plan the public README was written from | **Executed** (D-054) |

## Ground rules that bind all writing, code and UI

- The Grandma rule (D-018): plain words, short sentences, no em dashes, no
  buzzwords. It binds UI copy and the assistant's own messages.
- The anti-slop anchor (D-042): every effect points at a truth. Light means
  public, shadow means sealed.
- No red and no green anywhere. Gold is lit and public; cool shadow is
  sealed and private.
- Real Zcash testnet interactions only (D-003): no simulation of the thing
  being taught.
