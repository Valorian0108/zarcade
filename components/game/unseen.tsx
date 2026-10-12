"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/zcash/format";
import {
  AFTER_HIDDEN_LINE,
  leakFromFacts,
  leakLabelFor,
  metGoal,
  parseProgressOutcome,
  parseSendOutcome,
  POOL_FIRST_MENTION,
  POOL_LATER,
  ROUNDS,
  scoreGame,
  summaryLine,
  waitInWords,
  type Branch,
  type ProgressOutcome,
  type RoundOutcome,
  type SendOutcome,
} from "@/lib/unseen";
import { GameFrame } from "./frame";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import { PublicPanel } from "./public-panel";

/**
 * Unseen, the full game (B5).
 *
 * Three rounds, three different asks, and a real Zcash testnet payment behind
 * every one of them. The screen never states what a payment revealed from memory:
 * the leak meter, the sealed rows, and the "what a stranger can see" panel are all
 * driven by facts the server read back off the chain, and the explorer link is
 * right there so a player can check this screen against the real record.
 *
 * Scoring is about matching the ask, not about leaking as little as possible. Two
 * of the three rounds are supposed to be open, and one of those has no other
 * option, so a lower-is-better meter would punish the player for doing the right
 * thing. See lib/unseen.ts.
 *
 * Copy follows the Layer 4 voice rule (D-018): plain words, short sentences, no em
 * dashes. Every motion honours prefers-reduced-motion (Layer 2 rule 7).
 */

/** How often to ask where the payment has got to. Matches the server's brake. */
const POLL_MS = 4_000;
/** Stop asking after this long and say so honestly rather than spinning forever. */
const GIVE_UP_MS = 180_000;

type Paid = Extract<SendOutcome, { ok: true }>;

type Phase =
  | { name: "intro" }
  | { name: "brief"; index: number }
  | { name: "sending"; index: number; choice: Branch; startedAt: number }
  | { name: "paid"; index: number; choice: Branch; send: Paid }
  | { name: "summary" };

type Problem = {
  text: string;
  kind: "settling" | "refilling" | "limited" | "other";
  retryAfterSeconds: number | null;
} | null;

type House = { refilling: boolean; ready: boolean } | null;

export function Unseen() {
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [progress, setProgress] = useState<ProgressOutcome | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [house, setHouse] = useState<House>(null);

  // Nothing should set state after the player has navigated away.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Is the arcade playable right now? Read-only, and it keeps working during a
  // refill because the route asks /health first (D-036).
  useEffect(() => {
    let alive = true;
    fetch("/api/house/status")
      .then(async (response) => {
        const body = (await response.json()) as Record<string, unknown>;
        if (!alive) return;
        setHouse({ refilling: body.refilling === true, ready: body.readyForRound === true });
      })
      .catch(() => {
        // Say nothing. If the wallet really is down, the round itself will produce
        // an accurate message, and guessing here would only be wrong twice.
      });
    return () => {
      alive = false;
    };
  }, []);

  // A real clock while the wallet works. A shielded payment builds a real proof,
  // which takes about twenty seconds on this machine, and showing the seconds is
  // more honest than a looping animation that implies a fixed duration.
  //
  // The clock is state and the number shown is worked out from it, rather than the
  // number being state. Nothing is reset on entering the phase, so there is no
  // setState in the effect body and no extra render to cascade from.
  const [clockMs, setClockMs] = useState(0);
  useEffect(() => {
    if (phase.name !== "sending") return;
    const id = setInterval(() => {
      if (mounted.current) setClockMs(Date.now());
    }, 500);
    return () => clearInterval(id);
  }, [phase.name]);

  const elapsed =
    phase.name === "sending" && clockMs > phase.startedAt
      ? Math.round((clockMs - phase.startedAt) / 1000)
      : 0;

  // Ask where the payment has got to until it lands. The block number is the
  // network's, not ours, which is what makes the landing a fact (D-031).
  const watchedTxid = phase.name === "paid" ? phase.send.txid : null;
  useEffect(() => {
    if (!watchedTxid) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const tick = async () => {
      let result: ProgressOutcome | null = null;
      try {
        const response = await fetch(
          `/api/game/unseen/progress?txid=${encodeURIComponent(watchedTxid)}`,
        );
        result = parseProgressOutcome(response.status, await response.text());
      } catch {
        result = null;
      }
      if (!alive || !mounted.current) return;
      if (result && result.ok) {
        setProgress(result);
        if (result.landed) return;
      }
      // A "too-soon" answer or a network blip is not worth telling the player
      // about. Keep waiting, and stop after a while rather than spin forever.
      if (Date.now() - startedAt > GIVE_UP_MS) return;
      timer = setTimeout(tick, POLL_MS);
    };

    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [watchedTxid]);

  const choose = useCallback(
    async (choice: Branch, index: number) => {
      setProblem(null);
      setPhase({ name: "sending", index, choice, startedAt: Date.now() });

      let outcome: SendOutcome;
      try {
        const response = await fetch("/api/game/unseen/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ choice }),
        });
        outcome = parseSendOutcome(response.status, await response.text());
      } catch {
        outcome = {
          ok: false,
          code: "other",
          problem: "The arcade could not be reached. Nothing has been sent.",
          retryAfterSeconds: null,
        };
      }
      if (!mounted.current) return;

      if (!outcome.ok) {
        // Nothing was paid on any of these paths, so the round is offered again.
        setProblem({
          text: outcome.problem,
          kind: outcome.code,
          retryAfterSeconds: outcome.retryAfterSeconds,
        });
        setPhase({ name: "brief", index });
        return;
      }
      setProgress(null);
      setPhase({ name: "paid", index, choice, send: outcome });
    },
    [],
  );

  const continueOn = useCallback(() => {
    if (phase.name !== "paid") return;
    const { index, choice, send } = phase;
    const round = ROUNDS[index];
    const record: RoundOutcome = {
      roundId: round.id,
      choice,
      metGoal: metGoal(round, choice),
      leak: leakFromFacts(send.publicFacts),
      txid: send.txid,
      explorerUrl: send.explorerUrl,
      block: progress && progress.ok && progress.landed ? progress.block : null,
    };
    const next = [...outcomes, record];
    setOutcomes(next);
    setProgress(null);
    setPhase(next.length >= ROUNDS.length ? { name: "summary" } : { name: "brief", index: index + 1 });
  }, [phase, outcomes, progress]);

  const restart = useCallback(() => {
    setOutcomes([]);
    setProgress(null);
    setProblem(null);
    setPhase({ name: "intro" });
  }, []);

  // What the frame shows. The mood, the meter, and the panel all come from the
  // real facts once a payment exists, and stay empty until then.
  const facts = phase.name === "paid" ? phase.send.publicFacts : null;
  const hidden = phase.name === "paid" && phase.choice === "hide";
  const watcherMood = facts ? (hidden ? "blind" : "alert") : "calm";
  const leak = facts ? leakFromFacts(facts) : 0;
  const leakLabel = facts ? leakLabelFor(facts) : "Nothing yet. You have not sent anything.";

  const landed = progress !== null && progress.ok && progress.landed;
  const block = landed && progress && progress.ok ? progress.block : null;
  const confirmations = progress && progress.ok ? progress.confirmations : 0;

  return (
    <GameFrame
      title="Unseen"
      teach="Send money without the whole network watching, and learn when hiding helps."
      watcherMood={watcherMood}
      leak={leak}
      leakLabel={leakLabel}
      description={descriptionFor(phase, outcomes, elapsed, landed)}
    >
      {phase.name === "intro" && (
        <Intro house={house} onStart={() => setPhase({ name: "brief", index: 0 })} />
      )}

      {phase.name === "brief" && (
        <Brief
          index={phase.index}
          house={house}
          problem={problem}
          onChoose={(choice) => void choose(choice, phase.index)}
        />
      )}

      {phase.name === "sending" && <Sending choice={phase.choice} elapsed={elapsed} />}

      {phase.name === "paid" && (
        <div className="space-y-4">
          <PaymentRows rows={rowsFor(phase.send, phase.choice)} caption={ROWS_CAPTION} />

          {hidden && (
            <p className="rounded-lg border border-valid/30 bg-valid/5 p-3.5 text-sm leading-6 text-foreground">
              {AFTER_HIDDEN_LINE}
            </p>
          )}

          <PublicPanel
            facts={phase.send.publicFacts}
            txid={phase.send.txid}
            explorerUrl={phase.send.explorerUrl}
            amountTaz={phase.send.amountTaz}
            landed={landed}
            block={block}
            confirmations={confirmations}
            poolName={POOL_LATER}
          />

          <Result
            index={phase.index}
            choice={phase.choice}
            landed={landed}
            block={block}
            onNext={continueOn}
          />
        </div>
      )}

      {phase.name === "summary" && <Summary outcomes={outcomes} onRestart={restart} />}
    </GameFrame>
  );
}

/* -------------------------------------------------------------------------- */

/** The four rows, worked out from what the chain really says about this payment. */
function rowsFor(send: Paid, choice: Branch): PaymentRow[] {
  const facts = send.publicFacts;
  const address =
    facts.recipient ?? (choice === "hide" ? "The arcade's private address" : "The arcade's open address");

  return [
    {
      label: "Sent from",
      value: "The arcade's wallet",
      state: facts.senderVisible ? "open" : "sealed",
      barWidth: "8.5rem",
    },
    {
      label: "Sent to",
      value:
        facts.recipientVisible && facts.recipient ? (
          <span className="font-mono text-xs">{shortenAddress(facts.recipient)}</span>
        ) : (
          address
        ),
      state: facts.recipientVisible ? "open" : "sealed",
      barWidth: "9.5rem",
    },
    {
      label: "Amount",
      value: <span className={facts.amountVisible ? "font-mono text-xs" : ""}>{send.amountTaz} TAZ</span>,
      state: facts.amountVisible ? "open" : "sealed",
      barWidth: "8rem",
    },
    {
      label: "Note",
      value: facts.notePossible ? "A note rides along with it" : "No note is possible here",
      // An open payment cannot carry a note at all, so there is nothing there to
      // seal and nothing there to leak.
      state: facts.notePossible ? (facts.noteSecret ? "sealed" : "open") : "none",
      barWidth: "10.5rem",
    },
  ];
}

const ROWS_CAPTION =
  "The dark bars are not decoration. Each one covers something the network was not told.";

/** Plain words for the panel beside the stage, one sentence per moment. */
function descriptionFor(
  phase: Phase,
  outcomes: readonly RoundOutcome[],
  elapsed: number,
  landed: boolean,
): string {
  switch (phase.name) {
    case "intro":
      return "Three rounds, three different asks. Every round sends a real payment.";
    case "brief":
      return ROUNDS[phase.index].brief;
    case "sending":
      return phase.choice === "hide"
        ? `The wallet is building a real proof. ${elapsed} seconds so far, and about twenty is normal here.`
        : `Sending now. ${elapsed} seconds so far. This one still needs a proof, because the coins are leaving the private pool.`;
    case "paid": {
      const round = ROUNDS[phase.index];
      const teach = phase.choice === "hide" ? (round.teachHidden ?? round.teachOpen) : round.teachOpen;
      return landed ? teach : `${teach} The payment is on its way into a block.`;
    }
    case "summary":
      return summaryLine(scoreGame(outcomes));
  }
}

function Intro({ house, onStart }: { house: House; onStart: () => void }) {
  const blocked = house !== null && (house.refilling || !house.ready);

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm leading-6 text-foreground">
        <li>1. Keep a payment to yourself.</li>
        <li>2. Prove a payment happened.</li>
        <li>3. Pay an address that can only be reached in the open.</li>
      </ol>

      <p className="text-sm leading-6 text-muted-foreground">
        Every round sends a real payment on the Zcash test network, and you get a link to the public
        record so you can check what this screen claims.
      </p>

      <p className="text-sm leading-6 text-muted-foreground">
        The one thing to work out is when hiding helps and when it gets in the way. The rounds do not
        all want the same answer.
      </p>

      <div className="rounded-lg border border-border bg-secondary p-4 text-sm leading-6 text-foreground">
        <p>
          About the money. This is practice money, and both destinations belong to the arcade, so
          nothing leaves the building. You never need a wallet, a seed, or a key of your own.
        </p>
        <p className="mt-2.5">
          When you hide a payment it goes into {POOL_FIRST_MENTION}. A pool is just a group of
          payments that all look the same from outside, and that is what makes any one of them hard
          to single out.
        </p>
      </div>

      {house !== null && house.refilling && (
        <Notice tone="wait">
          The arcade is refilling its coins. That takes a few minutes and nobody can play during it.
          Nothing is broken.
        </Notice>
      )}
      {house !== null && !house.refilling && !house.ready && (
        <Notice tone="wait">
          The wallet has no coin ready to spend this second. The last payment is probably still
          landing. Try again in about a minute.
        </Notice>
      )}

      <Button onClick={onStart} disabled={blocked} size="lg">
        Start round 1
      </Button>
    </div>
  );
}

function Brief({
  index,
  house,
  problem,
  onChoose,
}: {
  index: number;
  house: House;
  problem: Problem;
  onChoose: (choice: Branch) => void;
}) {
  const round = ROUNDS[index];
  const canHide = round.allows.includes("hide");
  // Only a limit needs this spelled out. The settling and refilling messages already
  // say how long to wait in their own words.
  const wait = problem && problem.kind === "limited" ? waitInWords(problem.retryAfterSeconds) : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{round.label}</p>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">
          {round.title}
        </h2>
      </div>

      <p className="text-sm leading-6 text-foreground">{round.brief}</p>

      <div className="rounded-lg border border-border bg-secondary p-4">
        <p className="text-xs font-medium text-muted-foreground">What doing this well means</p>
        <p className="mt-1.5 text-sm leading-6 text-foreground">{round.goal}</p>
      </div>

      {problem && (
        <Notice tone={problem.kind === "other" ? "bad" : "wait"}>
          {problem.text}
          {wait && ` A slot frees up in ${wait}.`}
          {problem.kind !== "other" && " Nothing has been sent, so this round is still yours."}
        </Notice>
      )}

      {house !== null && house.refilling && (
        <Notice tone="wait">
          The arcade is refilling its coins. Please wait a few minutes and try this round again.
        </Notice>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button onClick={() => onChoose("hide")} disabled={!canHide} size="lg">
          Hide it
        </Button>
        <Button variant="outline" onClick={() => onChoose("open")} size="lg">
          Do not hide it
        </Button>
      </div>

      {!canHide && round.lockedWhy && (
        <p className="text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">Why you cannot hide this one. </span>
          {round.lockedWhy}
        </p>
      )}
    </div>
  );
}

function Sending({ choice, elapsed }: { choice: Branch; elapsed: number }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-foreground">Building the payment and its proof now.</p>
      <p className="font-mono text-3xl text-foreground tabular-nums">{elapsed}s</p>
      <p className="text-xs leading-5 text-muted-foreground">
        {choice === "hide"
          ? "The proof is real mathematics, and it is what lets the network check the payment without being told anything about it. On this machine that takes about twenty seconds."
          : "An open payment needs a proof too, because the coins sit in the private pool and leaving it has to be proved. That is why it takes about as long. What changes is what the proof lets stay secret. Here anybody can read the destination and the amount."}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        Please leave this page open. Closing it does not stop the payment, but you would miss seeing
        it land.
      </p>
    </div>
  );
}

function Result({
  index,
  choice,
  landed,
  block,
  onNext,
}: {
  index: number;
  choice: Branch;
  landed: boolean;
  block: number | null;
  onNext: () => void;
}) {
  const round = ROUNDS[index];
  const good = metGoal(round, choice);
  const last = index >= ROUNDS.length - 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={
            "rounded-full px-3 py-1 text-xs font-medium " +
            (good ? "bg-valid/15 text-valid" : "bg-leak/15 text-leak")
          }
        >
          {good ? "That matched the round" : "Not what this round asked for"}
        </span>

        {landed && block !== null ? (
          <span className="rounded-full bg-muted px-3 py-1 font-mono text-xs text-foreground">
            landed in block {block}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            still landing
          </span>
        )}
      </div>

      <Button onClick={onNext} size="lg">
        {last ? "See how you did" : `Go to round ${index + 2}`}
      </Button>

      {!landed && (
        <p className="text-xs leading-5 text-muted-foreground">
          You do not have to wait for it. The payment is already broadcast and the network will agree
          on it in its own time. The link above shows the real record either way.
        </p>
      )}
    </div>
  );
}

function Summary({ outcomes, onRestart }: { outcomes: RoundOutcome[]; onRestart: () => void }) {
  const score = scoreGame(outcomes);

  return (
    <div className="space-y-4">
      <p className="font-display text-xl font-semibold tracking-tight text-foreground">
        {score.passed ? "All three rounds read correctly" : `${score.met} of ${score.total} matched`}
      </p>

      <ul className="space-y-2.5">
        {outcomes.map((outcome, index) => {
          const round = ROUNDS[index];
          return (
            <li
              key={outcome.txid}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-card p-3.5"
            >
              <span className="text-sm text-foreground">
                <span className="text-muted-foreground">{round.label}. </span>
                {round.title}
              </span>
              <span className="flex items-baseline gap-3">
                <span className={"text-xs font-medium " + (outcome.metGoal ? "text-valid" : "text-leak")}>
                  {outcome.metGoal ? "matched" : "missed"}
                </span>
                <span className="text-xs text-muted-foreground">
                  leaked {Math.round(outcome.leak * 100)}%
                </span>
                {outcome.block !== null ? (
                  <span className="font-mono text-xs text-muted-foreground">block {outcome.block}</span>
                ) : (
                  <a
                    href={outcome.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
                  >
                    check it
                  </a>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-sm leading-6 text-muted-foreground">{summaryLine(score)}</p>

      <p className="text-sm leading-6 text-foreground">
        Every payment above is real and stays on the test network for good. That is the part worth
        sitting with: the hidden ones cannot be read by anyone, and the open ones can be read by
        everyone, forever.
      </p>

      <Button onClick={onRestart} size="lg" variant="outline">
        Play it again
      </Button>
    </div>
  );
}

function Notice({ tone, children }: { tone: "wait" | "bad"; children: ReactNode }) {
  return (
    <p
      role="status"
      className={
        "rounded-lg border p-3.5 text-sm leading-6 " +
        (tone === "wait"
          ? "border-border bg-secondary text-foreground"
          : "border-leak/30 bg-leak/5 text-foreground")
      }
    >
      {children}
    </p>
  );
}
