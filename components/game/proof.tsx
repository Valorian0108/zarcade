"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GameFrame } from "@/components/game/frame";
import type { WatcherMood } from "@/components/watcher";

/**
 * The Proof Puzzle (cabinet three), restaged after the owner's playtest
 * (2026-10-17). The promise on screen and the thing that happens are the
 * same thing now:
 *
 *   1. You type a three-digit code. It goes into the safe. While any digit
 *      sits in the box the Watcher's eye shuts (the "shut" mood), because
 *      the copy says he closes his eyes and he actually does.
 *   2. He cannot read the safe, so he asks it. Three yes-or-no questions,
 *      drawn fresh each run so the answers cannot be memorised, each read
 *      from its own slot. The safe checks every answer against the code
 *      inside it. The Watcher hears only open or shut (owner's question
 *      2026-10-17: who checks, if nobody knows the code? The safe does,
 *      because the code lives in the safe. On the live chain the same
 *      shape is carried by math built from the secret, named in one line
 *      on the receipt and left parked there).
 *   3. Three matching answers open the safe and the house makes one REAL
 *      shielded payment of 1,000 zatoshis through the single money route
 *      (D-103), sending the same one word Unseen sends. The zero-knowledge
 *      proof is built and checked inside the wallet, in the background,
 *      exactly as it is for every Unseen round. The receipt shows the real
 *      txid and its explorer link. A shut safe sends nothing, and the
 *      record card says the public record has nothing new in it.
 *
 * No wallet, no sidecar, no real transaction: the owner parked those while
 * this cabinet finds its feet. The room's teaches line carries the truth
 * about what the real chain does.
 */

type Step = "setup" | "ask" | "end";

type Question = { text: string; answer: boolean };

/**
 * The state of the real payment (D-103). It is never part of the puzzle:
 * the safe opens first, and the payment is the house keeping its side of
 * the story in the background.
 */
type PayState =
  | { kind: "none" }
  | { kind: "working" }
  | { kind: "waiting"; note: string }
  | { kind: "sent"; txid: string; explorerUrl: string }
  | { kind: "unsent"; note: string };

/**
 * The question pool. Every question is answerable by looking at your own
 * code on the screen (D-096), and no question asks for a digit itself, so
 * answering never says the code out loud.
 */
const QUESTION_POOL: { text: string; test: (d: number[]) => boolean }[] = [
  { text: "Is your first digit greater than five?", test: (d) => d[0] > 5 },
  { text: "Is your second digit an even number?", test: (d) => d[1] % 2 === 0 },
  { text: "Do all three digits add up to more than ten?", test: (d) => d[0] + d[1] + d[2] > 10 },
  { text: "Is your third digit smaller than four?", test: (d) => d[2] < 4 },
  { text: "Are your first and third digits different?", test: (d) => d[0] !== d[2] },
  { text: "Is your second digit larger than your first?", test: (d) => d[1] > d[0] },
];

function pickQuestions(code: number[]): Question[] {
  const pool = [...QUESTION_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map((q) => ({ text: q.text, answer: q.test(code) }));
}

/**
 * The thousand-code wall, shown as one row at the interface's own text
 * size (D-102, resized in D-104 after the owner's playtest: the full
 * print of all one thousand codes deformed the card). The row plus the
 * trailing dots carries the same truth: every three-digit code is still
 * possible for the Watcher, and the dots keep going to 999. The player
 * knows their own code because they typed it. He does not, because one
 * word is all he ever got.
 */
const CODE_ROW =
  Array.from({ length: 12 }, (_, i) => String(i).padStart(3, "0")).join(" ") + " …";

export function Proof() {
  const [step, setStep] = useState<Step>("setup");
  const [code, setCode] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pay, setPay] = useState<PayState>({ kind: "none" });
  const payStarted = useRef(false);

  /**
   * Every keystroke lands in the box, so typing always works. The round
   * starts by itself the moment the third digit lands.
   */
  function onCodeChange(value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 3);
    setCode(cleaned);
    if (cleaned.length === 3) {
      const digits = cleaned.split("").map((c) => parseInt(c, 10));
      setQuestions(pickQuestions(digits));
      setAnswers([]);
      setFeedback(null);
      setStep("ask");
    }
  }

  function answer(ans: boolean) {
    if (!questions) return;
    const next = [...answers, ans];
    setAnswers(next);
    const asked = questions[next.length - 1];
    if (asked.answer !== ans) {
      setFeedback("That answer does not match your code. The safe only opens when all three match.");
    } else {
      setFeedback(null);
    }
    if (next.length === 3) setStep("end");
  }

  function reset() {
    setStep("setup");
    setCode("");
    setQuestions(null);
    setAnswers([]);
    setFeedback(null);
    payStarted.current = false;
    setPay({ kind: "none" });
  }

  const allCorrect = questions
    ? questions.length === 3 && questions.every((q, i) => q.answer === answers[i])
    : false;

  /**
   * The mood is read off what is true on screen, never stored: while a
   * digit sits in the code box the Watcher's eye is shut, and at the end
   * he is alert only if the answers did not match.
   */
  const mood: WatcherMood =
    step === "end"
      ? allCorrect
        ? "calm"
        : "alert"
      : step === "setup" && code.length > 0
        ? "shut"
        : "calm";

  /**
   * The real payment (D-103). The moment the safe opens, the website sends
   * the same one word Unseen sends, to the same single money route, and
   * the wallet does the zero-knowledge work in the background where it
   * already lives. One automatic retry when the wallet answers that it is
   * busy (429) or still settling (409), capped at 90 seconds, never a
   * loop, never a second route. A shut safe never reaches this effect.
   */
  useEffect(() => {
    if (step !== "end" || !allCorrect || payStarted.current) return;
    payStarted.current = true;

    let timer: number | null = null;

    async function trySend(attempt: number) {
      setPay({ kind: "working" });
      let res: Response;
      try {
        res = await fetch("/api/game/unseen/send", {
          method: "POST",
          body: JSON.stringify({ choice: "hide" }),
        });
      } catch {
        setPay({
          kind: "unsent",
          note: "The arcade could not reach its wallet. Nothing has been sent.",
        });
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { txid: string; explorerUrl: string };
        setPay({ kind: "sent", txid: data.txid, explorerUrl: data.explorerUrl });
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        problem?: string;
        retryAfterSeconds?: number;
      } | null;
      const note =
        data?.problem ?? "The payment did not go through. Nothing has been sent.";
      if ((res.status === 429 || res.status === 409) && attempt === 0) {
        const wait = Math.min(Math.max(data?.retryAfterSeconds ?? 30, 1), 90);
        setPay({ kind: "waiting", note });
        timer = window.setTimeout(() => void trySend(1), wait * 1000);
        return;
      }
      setPay({ kind: "unsent", note });
    }

    void trySend(0);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [step, allCorrect]);

  const stage = () => {
    if (step === "setup") {
      return (
        <>
          <div className="gm-goalCard">
            <p className="gm-goalLabel">Set your code</p>
            <p className="gm-goalText">
              Pick any three-digit number and type it in the box. The code goes into the
              safe. The Watcher closes his eyes while you type, and he never sees it.
            </p>
          </div>
          <div
            className="gm-actions"
            style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder="___"
              aria-label="Your secret three digit code"
              className="w-32 h-12 text-center text-xl tracking-widest border border-input rounded-lg bg-background px-4 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </>
      );
    }

    if (step === "ask" && questions) {
      const q = questions[answers.length];
      return (
        <>
          <div className="gm-goalCard">
            <p className="gm-goalLabel">The Watcher asks</p>
            <p className="gm-goalText">{q.text}</p>
            <p className="gm-callSub">
              You answer to the safe, not to him. The safe checks each answer against the
              code inside it. He hears only open or shut.
            </p>
          </div>
          <div
            className="gm-actions"
            style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}
          >
            <button type="button" className="gm-btnPrimary" onClick={() => answer(true)}>
              Yes
            </button>
            <button type="button" className="gm-btnGhost" onClick={() => answer(false)}>
              No
            </button>
            {feedback && <p className="gm-callSub gm-msgIn">{feedback}</p>}
          </div>
        </>
      );
    }

    return (
      <>
        <div className="gm-goalCard gm-cardIn">
          <p className="gm-goalLabel">The verdict</p>
          {allCorrect ? (
            <>
              <p className="gm-goalText">
                The safe opens. Every answer matched the code inside it, and you never
                said the code out loud.
              </p>
              <p className="gm-goalText">
                The Watcher saw only the safe open. One thousand zatoshis is on its way,
                and the public record below shows only that a payment passed the check.
              </p>
            </>
          ) : (
            <p className="gm-goalText">
              The safe stays closed. At least one answer did not match the code inside
              it. The Watcher sees a closed safe, and nothing moves.
            </p>
          )}
        </div>
        <div
          className="gm-actions"
          style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}
        >
          <button type="button" className="gm-btnPrimary" onClick={reset}>
            Play again
          </button>
        </div>
        <div className="gm-goalCard gm-crowdFacts">
          <p className="gm-goalLabel">What the Watcher heard</p>
          <p className="gm-goalText">He asked three questions.</p>
          {(questions ?? []).map((q) => (
            <p className="gm-goalText" key={q.text}>
              {q.text}
            </p>
          ))}
          <p className="gm-goalText">
            The safe said one word back: {allCorrect ? "open" : "shut"}.
          </p>
          <p className="gm-goalText">
            From where he sits, your code is still any of the thousand below. Yours is
            in there. You can find it because you typed it. He cannot, because one word
            is all he ever got.
          </p>
          <p className="gm-goalText" aria-hidden="true">
            {CODE_ROW}
          </p>
        </div>
        <div className="gm-goalCard gm-crowdFacts">
          <p className="gm-goalLabel">Public record</p>
          {!allCorrect ? (
            <>
              <p className="gm-goalText">Verdict: FAILED</p>
              <p className="gm-goalText">
                No payment moved. The public record has nothing new in it.
              </p>
            </>
          ) : pay.kind === "sent" ? (
            <>
              <p className="gm-goalText">
                Transaction ID:{" "}
                <a
                  className="gm-receiptLink"
                  href={pay.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pay.txid.slice(0, 8)}…{pay.txid.slice(-4)}
                </a>
              </p>
              <p className="gm-goalText">Sender: [ENCRYPTED / HIDDEN]</p>
              <p className="gm-goalText">Receiver: [ENCRYPTED / HIDDEN]</p>
              <p className="gm-goalText">Amount sent: [ENCRYPTED / HIDDEN]</p>
              <p className="gm-goalText">Verdict: SUCCESS (Fully Private)</p>
              <p className="gm-callSub">
                This payment is real. It moved on the testnet when the safe opened. The
                record hides the same three lines you see here, and the link opens the
                explorer so you can check for yourself.
              </p>
            </>
          ) : pay.kind === "unsent" ? (
            <>
              <p className="gm-goalText">The safe opened, but the payment did not move.</p>
              <p className="gm-goalText">{pay.note}</p>
              <p className="gm-goalText">
                Nothing has been sent. The public record has nothing new in it.
              </p>
            </>
          ) : (
            <>
              <p className="gm-goalText">The safe opened. The payment is moving.</p>
              <p className="gm-goalText">
                {pay.kind === "waiting"
                  ? pay.note
                  : "The wallet is working. The record appears here when it lands."}
              </p>
            </>
          )}
        </div>
      </>
    );
  };

  const meta = (): {
    chip: [string, string];
    panelLabel: string;
    caption: ReactNode;
    description: string;
    leakLabel: string;
  } => {
    if (step === "setup") {
      return {
        chip: ["Round 0 of 3", "Your secret code"],
        panelLabel: "The safe",
        caption: (
          <p>
            Pick a secret three-digit code. It goes into the safe. The Watcher closes
            his eyes while you type it, so he cannot see it.
          </p>
        ),
        description: "Type your code in the box. Three digits start the round.",
        leakLabel: "Nothing pinned down yet.",
      };
    }
    if (step === "ask") {
      return {
        chip: [`Round ${answers.length + 1} of 3`, "The Watcher asks"],
        panelLabel: "The question",
        caption: (
          <p>
            The Watcher cannot read your code, so he asks the safe instead. The safe
            checks each answer against the code inside it, and only says open or shut.
          </p>
        ),
        description: "Three matching answers open the safe.",
        leakLabel: "Nothing pinned down yet.",
      };
    }
    return {
      chip: ["Done", "The verdict"],
      panelLabel: "The safe",
      caption: (
        <p>
          The safe opens only if every answer matched your secret code. Below sits what
          the Watcher heard, and then what the public gets to see.
        </p>
      ),
      description: allCorrect
        ? "The safe checked every answer without the code ever leaving it. The Watcher saw only the verdict. That is the whole trick."
        : "A wrong answer means the safe stays shut. A shut safe proves nothing, so no payment moves.",
      leakLabel: "Nothing pinned down, and that is the correct reading.",
    };
  };

  const s = meta();

  return (
    <GameFrame
      title="The Proof Puzzle"
      teach="Show a guard you know a secret, without saying it."
      chip={s.chip}
      panelLabel={s.panelLabel}
      watcherMood={mood}
      leak={0}
      leakLabel={s.leakLabel}
      description={s.description}
      showLeakMeter={false}
      caption={s.caption}
    >
      {stage()}
    </GameFrame>
  );
}
