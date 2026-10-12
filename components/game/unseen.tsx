"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  leakFromFacts,
  metGoal,
  parseProgressOutcome,
  parseSendOutcome,
  POOL_FIRST_MENTION,
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
import { Reveal } from "./reveal";

/**
 * Unseen, the full game (B5).
 *
 * Three rounds, three different asks, and a real Zcash testnet payment behind
 * every one of them. The screen never states what a payment revealed from memory:
 * the shuttered rows, the pips, and the twist line in the reveal (Layer 5,
 * D-044) are all driven by facts the server read back off the chain, and the
 * explorer link is right there so a player can check this screen against the
 * real record. The paid phase belongs to the Reveal component outright: two
 * panels, the Watcher on the hinge, and the truth landing last.
 *
 * Scoring is about matching the ask, not about leaking as little as possible. Two
 * of the three rounds are supposed to be open, and one of those has no other
 * option, so a lower-is-better meter would punish the player for doing the right
 * thing. See lib/unseen.ts.
 *
 * Copy follows the Layer 4 voice rule (D-018): plain words, short sentences, no em
 * dashes. Motion level follows the page's motion preference (D-045), which starts
 * from the computer's own prefers-reduced-motion setting.
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

  // The frame's readouts. With no payment on screen yet there is nothing to
  // report, and the frame says exactly that. The paid phase never reaches the
  // frame: the reveal below owns it.
  const landed = progress !== null && progress.ok && progress.landed;
  const block = landed && progress && progress.ok ? progress.block : null;
  const confirmations = progress && progress.ok ? progress.confirmations : 0;

  if (phase.name === "paid") {
    return (
      <Reveal
        index={phase.index}
        choice={phase.choice}
        amountTaz={phase.send.amountTaz}
        facts={phase.send.publicFacts}
        txid={phase.send.txid}
        explorerUrl={phase.send.explorerUrl}
        landed={landed}
        block={block}
        confirmations={confirmations}
        onNext={continueOn}
      />
    );
  }

  return (
    <GameFrame
      title="Unseen"
      teach="Send money without the whole network watching, and learn when hiding helps."
      chip={chipFor(phase)}
      panelLabel={panelLabelFor(phase)}
      watcherMood="calm"
      leak={0}
      leakLabel="Nothing yet. You have not sent anything."
      description={descriptionFor(phase, outcomes, landed)}
      caption={captionFor(phase, outcomes)}
      showLeakMeter={phase.name !== "summary"}
      receipts={
        phase.name === "summary"
          ? outcomes.map((outcome, i) => ({
              label: ROUNDS[i].label,
              txid: outcome.txid,
              block: outcome.block,
              url: outcome.explorerUrl,
            }))
          : []
      }
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

      {phase.name === "sending" && <Sending elapsed={elapsed} />}

      {phase.name === "summary" && <Summary outcomes={outcomes} onRestart={restart} />}
    </GameFrame>
  );
}

/* -------------------------------------------------------------------------- */

/** The round chip in the marquee, one identity across every screen. */
function chipFor(phase: Phase): [string, string] {
  switch (phase.name) {
    case "intro":
      return ["Before round 1", "Three asks"];
    case "brief":
    case "sending":
      return [ROUNDS[phase.index].label, ROUNDS[phase.index].title];
    case "paid":
      return [ROUNDS[phase.index].label, ROUNDS[phase.index].title];
    case "summary":
      return ["After round 3", "The whole game"];
  }
}

/** The eyebrow over the left panel, per moment. */
function panelLabelFor(phase: Phase): string {
  switch (phase.name) {
    case "intro":
      return "Before you start";
    case "brief":
      return "The ask";
    case "sending":
      return "The wallet at work";
    case "paid":
      return "Your side";
    case "summary":
      return "The whole game";
  }
}

/** One status sentence for the record panel (D-046). Teaching prose lives in
    the caption slot below the stage, not here. */
function descriptionFor(
  phase: Phase,
  outcomes: readonly RoundOutcome[],
  landed: boolean,
): string {
  switch (phase.name) {
    case "intro":
      return "Nothing on the chain yet.";
    case "brief":
      return "No payment sent this round yet.";
    case "sending":
      return phase.choice === "hide"
        ? "A hidden payment is building its proof now."
        : "An open payment is building its proof now.";
    case "paid":
      return landed ? "The payment is in a block." : "The payment is on its way into a block.";
    case "summary":
      return `Three real payments. ${outcomes.length} of ${ROUNDS.length} rounds read back.`;
  }
}

/** The teaching prose for the caption slot below the stage (D-046). Two short
    paragraphs maximum, in the big voice. */
function captionFor(phase: Phase, outcomes: readonly RoundOutcome[]): ReactNode {
  switch (phase.name) {
    case "intro":
      return (
        <>
          <p className="gm-teach" data-on={true}>
            Every round sends a real payment on the Zcash test network, and you get a link to the
            public record so you can check what this screen claims.
          </p>
          <p className="gm-teach" data-on={true}>
            The one thing to work out is when hiding helps and when it gets in the way. The rounds
            do not all want the same answer.
          </p>
        </>
      );
    case "brief":
      return (
        <p className="gm-teach" data-on={true}>
          {ROUNDS[phase.index].brief}
        </p>
      );
    case "sending":
      return (
        <p className="gm-teach" data-on={true}>
          {phase.choice === "hide"
            ? "The proof is real mathematics, and it is what lets the network check the payment without being told anything about it. On this machine that takes about twenty seconds."
            : "An open payment needs a proof too, because the coins sit in the private pool and leaving it has to be proved. That is why it takes about as long. What changes is what the proof lets stay secret. Here anybody can read the destination and the amount."}
        </p>
      );
    case "paid":
      return null;
    case "summary":
      return (
        <>
          <p className="gm-teach" data-on={true}>
            {summaryLine(scoreGame(outcomes))}
          </p>
          <p className="gm-teach" data-on={true}>
            Every payment above is real and stays on the test network for good. The hidden ones
            cannot be read by anyone, and the open ones can be read by everyone, forever. The
            receipts on the right open the real record.
          </p>
        </>
      );
  }
}

function Intro({ house, onStart }: { house: House; onStart: () => void }) {
  const blocked = house !== null && (house.refilling || !house.ready);

  return (
    <>
      <ol className="gm-introList">
        <li className="gm-introItem">
          <span className="gm-introNum">01</span> Keep a payment to yourself.
        </li>
        <li className="gm-introItem">
          <span className="gm-introNum">02</span> Prove a payment happened.
        </li>
        <li className="gm-introItem">
          <span className="gm-introNum">03</span> Pay an address that can only be reached in the
          open.
        </li>
      </ol>

      <div className="gm-goalCard">
        <p className="gm-goalLabel">About the money</p>
        <p className="gm-goalText">
          This is practice money, and both destinations belong to the arcade, so nothing leaves the
          building. You never need a wallet, a seed, or a key of your own.
        </p>
        <p className="gm-goalText" style={{ marginTop: 10 }}>
          When you hide a payment it goes into {POOL_FIRST_MENTION}. A pool is just a group of
          payments that all look the same from outside, and that is what makes any one of them hard
          to single out.
        </p>
      </div>

      {house !== null && house.refilling && (
        <Notice tone="wait">
          The arcade is refilling its coins. That takes a few minutes and nobody can play during
          it. Nothing is broken.
        </Notice>
      )}
      {house !== null && !house.refilling && !house.ready && (
        <Notice tone="wait">
          The wallet has no coin ready to spend this second. The last payment is probably still
          landing. Try again in about a minute.
        </Notice>
      )}

      <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
        <button type="button" className="gm-btnPrimary" onClick={onStart} disabled={blocked}>
          Start round 1
        </button>
      </div>
    </>
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
    <>
      <p className="gm-callChoice" style={{ marginBottom: 12 }}>
        {round.title}
      </p>

      <div className="gm-goalCard">
        <p className="gm-goalLabel">What doing this well means</p>
        <p className="gm-goalText">{round.goal}</p>
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

      <div
        className="gm-actions"
        style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}
      >
        <button
          type="button"
          className="gm-btnPrimary"
          onClick={() => onChoose("hide")}
          disabled={!canHide}
        >
          Hide it
        </button>
        <button type="button" className="gm-btnGhost" onClick={() => onChoose("open")}>
          Do not hide it
        </button>
      </div>

      {!canHide && round.lockedWhy && (
        <p className="gm-callSub">
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>Why you cannot hide this one. </span>
          {round.lockedWhy}
        </p>
      )}
    </>
  );
}

function Sending({ elapsed }: { elapsed: number }) {
  return (
    <>
      <p className="gm-amountLabel">Building the payment and its proof</p>
      <p className="gm-amount">
        {elapsed}
        <span className="gm-amountUnit"> SECONDS</span>
      </p>

      {/* The wait teaches (D-059, lever A). The seconds stay honest, and the
          real pipeline appears under them. Only the build is marked live,
          because that is the one step this screen can vouch for: the wallet
          call reports nothing until it returns, and guessing a switch to
          "broadcasting" from elapsed time would be a lie with a timer on it.
          Both branches really do build a proof (an open payment spends
          shielded coins, which has to be proved), so one honest track fits
          both. */}
      <p className="gm-sendTruth">Real math takes real seconds.</p>
      <ol className="gm-steps" aria-label="What happens to this payment">
        <li className="gm-step" data-state="live">
          <span className="gm-stepDot" aria-hidden="true" />
          Building the proof
        </li>
        <li className="gm-step" data-state="next">
          <span className="gm-stepDot" aria-hidden="true" />
          Broadcasting to the network
        </li>
        <li className="gm-step" data-state="next">
          <span className="gm-stepDot" aria-hidden="true" />
          Watching for the block
        </li>
      </ol>

      <p className="gm-callSub" style={{ marginTop: "auto", paddingTop: 22 }}>
        Please leave this page open. Closing it does not stop the payment, but you would miss
        seeing it land.
      </p>
    </>
  );
}

function Summary({ outcomes, onRestart }: { outcomes: RoundOutcome[]; onRestart: () => void }) {
  const score = scoreGame(outcomes);

  return (
    <>
      <p className="gm-callChoice" style={{ marginBottom: 14 }}>
        {score.passed ? "All three rounds read correctly" : `${score.met} of ${score.total} matched`}
      </p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {outcomes.map((outcome, index) => {
          const round = ROUNDS[index];
          return (
            <li key={outcome.txid} className="gm-sumRow">
              <span className="gm-sumTitle">
                <span className="gm-sumLabel">{round.label}. </span>
                {round.title}
              </span>
              <span className="gm-sumMeta">
                <span className="gm-sumState" data-met={outcome.metGoal}>
                  {outcome.metGoal ? "matched" : "missed"}
                </span>
                <span>learned {Math.round(outcome.leak * 100)}%</span>
                {outcome.block !== null ? (
                  <span className="gm-mono">block {outcome.block}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className="gm-actions"
        style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}
      >
        <button type="button" className="gm-btnGhost" onClick={onRestart}>
          Play it again
        </button>
      </div>
    </>
  );
}

function Notice({ tone, children }: { tone: "wait" | "bad"; children: ReactNode }) {
  return (
    <p role="status" className="gm-notice" data-tone={tone} style={{ margin: 0 }}>
      {children}
    </p>
  );
}
