# Contributing to Zarcade

Zarcade is an arcade that teaches Zcash privacy with real testnet money. This
file says how to work on it without breaking the two things that make it worth
anything: the money rules and the honesty rules.

Read `AGREEMENT.md` first. It explains who decides what.

## Before you write code

- Open an issue and say what you want to change and why.
- A material decision goes into `DECISIONS.md` before the code lands. The record
  needs the choice, the reason, the alternatives that were rejected, who decided,
  and the date.
- The owner decides. Nothing is built on an assumption. If a question is open,
  it stays visible in the open decisions list.

## Set up

Requirements:

- Node.js 20 or newer, with npm.
- A stable Rust toolchain, with `cargo`.

Install:

```sh
npm ci
```

The website reads two variables:

- `ZARCADE_SIDECAR_URL`, default `http://127.0.0.1:9070`.
- `ZARCADE_SEND_TOKEN`, empty by default. When set, the wallet service requires
  it on the pay door.

The wallet service reads:

- `ZARCADE_DATA_DIR`, where the seed and the wallet database live.
- `PORT`, default `9070`.
- `ZARCADE_SEND_TOKEN`, the same value as the website.
- `ZARCADE_ADMIN_TOKEN`, for the admin split route. Never the same value.
- `ZARCADE_DAILY_SEND_CAP`, default 150 sends per day.
- `ZARCADE_LIGHTWALLETD_URL` and `ZARCADE_LIGHTWALLETD_HOST`, for the testnet
  lightwalletd. The default host is `testnet.zec.rocks`.
- `ZARCADE_GATE`, set to `1` only for the gate mode described in the deployment
  notes.

Never commit a seed, a token, a `.env` file, or wallet data. If one appears in a
screenshot or a log, rotate it before doing anything else.

## Run it

```sh
npm run dev
```

In another terminal, from `sidecar/`:

```sh
cargo run
```

The site runs on port 3000 and talks to the wallet service on 9070. Both are
local only.

## Check before you send a change

Every change passes these, in this order:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

And inside `sidecar/`:

```sh
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

A change that touches a screen also gets a screenshot in the pull request, on a
phone width and a desktop width, with motion set to more and to less.

## Code style

TypeScript and React:

- TypeScript strict mode. No `any` without a written reason in a comment.
- `"use client"` only where the component needs state or effects.
- An effect body never calls a state setter directly. Reset state in the event
  that caused the change, or derive it.
- Names say what the thing is. No abbreviations that need a decoder.
- Shared logic lives in `lib/`. A component does not talk to the chain directly.

Rust:

- `rustfmt` and `clippy` with warnings denied.
- Style guides, branch, merge, pull request and commit conventions follow the
  [`librustzcash` CONTRIBUTING guide](https://github.com/zcash/librustzcash/blob/main/CONTRIBUTING.md#styleguides)
  as the primary reference, with the local rules in this file taking precedence
  where they are stricter.
- The wallet service returns finished facts, never key material. A route that
  could return a key does not get merged.

CSS:

- Global stylesheets, not CSS modules. The build forces every `.css` file
  through the Tailwind plugin with `as: "*.css"`, which disables module scoping.
- Prefix every class per room: `gm-` for the arcade, `mrc-` for the merchant
  room, `smp-` for the reveal sample.
- Gold means public. Cool shadow means sealed. No red and no green as a verdict.

## Money rules

These are not style preferences. A change that breaks one is rejected.

- Exactly one route can move money: `POST /api/game/unseen/send`. Do not add a
  second money route.
- The amount is fixed at 1,000 zatoshis. The destination is one of the arcade's
  own addresses. Both checks run inside the wallet service, not in the browser.
- The service token, the fixed policy and the durable daily cap stay in place.
  Removing a lock needs a decision record and a review.
- No key material on the web tier. The seed stays in the wallet service data
  directory.
- Any change to a money path needs tests that fail if the rule is broken.

## Honesty rules

- No invented chain data, ever. If the chain cannot be read, the screen says so.
- Every number on screen comes from a live read or a receipt.
- Every challenge must be answerable from what the player just watched.
- Jargon gets one plain gloss the first time it appears.
- A visual effect points at a truth. If it does not, it is cut.

## Branches, commits and pull requests

Branches:

- `feat/<short-name>` for a new machine or feature.
- `fix/<short-name>` for a defect.
- `docs/<short-name>` for documents only.

Commits:

- Subject in the imperative, under 72 characters.
- Body says why, not what. The diff already says what.
- Reference the decision, for example `D-126`, when one applies.
- One topic per commit. Do not mix a copy fix with a dependency upgrade.

Pull requests:

- Say what changed, why, and which files carry the risk.
- List the checks you ran, with the result.
- Name the decision that authorises the change.
- Link the live room or a screenshot for anything a player sees.
- Keep it small. A reviewer should be able to hold the whole change in their
  head.

Do not rewrite pushed history on `main`.

## Review

- The owner reviews copy, characters, props and every visual change. A build is
  not approval.
- A change to a money path needs a second pair of eyes, and a recorded decision.
- Green checks are required, not optional. A skipped test is a broken test.

## Security

Do not open a public issue for a vulnerability. Report it to the maintainer
privately, through the repository's private reporting or a direct message, and
give a day to answer before disclosing anything.

## Licence

Zarcade is released under the MIT licence. By contributing, you agree that your
work ships under the same licence. See `LICENSE`.
