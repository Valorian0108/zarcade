"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { GameFrame } from "@/components/game/frame";
import type { WatcherMood } from "@/components/watcher";

/**
 * The Proof Puzzle (cabinet three), restaged after the owner's playtest
 * (2026-10-17). The promise on screen and the thing that happens are the
 * same thing now:
 *
 *   1. You type a three-digit code. While any digit sits in the box the
 *      Watcher's eye shuts (the "shut" mood), because the copy says he
 *      closes his eyes and he actually does.
 *   2. He asks three yes-or-no questions computed from your code, drawn
 *      fresh each run so the answers cannot be memorised. Each question
 *      reads from its own slot, so you meet three different questions.
 *   3. Three matching answers open the safe and a SIMULATED payment of
 *      1,000 TAZ moves. The public record shows only that a payment passed
 *      the check, and says plainly that the receipt is a model.
 *
 * No wallet, no sidecar, no real transaction: the owner parked those while
 * this cabinet finds its feet. The room's teaches line carries the truth
 * about what the real chain does.
 */

type Step = "setup" | "ask" | "end";

type Question = { text: string; answer: boolean };

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

export function Proof() {
  const [step, setStep] = useState<Step>("setup");
  const [code, setCode] = useState("");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const stage = () => {
    if (step === "setup") {
      return (
        <>
          <div className="gm-goalCard">
            <p className="gm-goalLabel">Set your code</p>
            <p className="gm-goalText">
              Pick any three-digit number and type it in the box. The Watcher closes his
              eyes while you type. He never sees the code.
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
            <p className="gm-callSub">
              {code.length > 0
                ? "His eye is shut now. It opens again when the questions start."
                : "His eye stays open until you type."}
            </p>
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
              Answer from the code you can see on your screen. Saying yes or no never
              tells him the digits.
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
                The safe opens. Every answer matched your code, and you never said the
                code out loud.
              </p>
              <p className="gm-goalText">
                One thousand TAZ moves. The public record shows only that a payment
                passed the check.
              </p>
            </>
          ) : (
            <p className="gm-goalText">
              The safe stays closed. At least one answer did not match your code, so the
              Watcher is not convinced. Nothing moves.
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
          <p className="gm-goalLabel">Public record</p>
          <p className="gm-goalText">Transaction ID: 0x8f93…4a2c</p>
          <p className="gm-goalText">Sender: [ENCRYPTED / HIDDEN]</p>
          <p className="gm-goalText">Receiver: [ENCRYPTED / HIDDEN]</p>
          <p className="gm-goalText">Amount sent: [ENCRYPTED / HIDDEN]</p>
          <p className="gm-goalText">
            Verdict: {allCorrect ? "SUCCESS (Fully Private)" : "FAILED"}
          </p>
          <p className="gm-callSub">
            This receipt is a model of the real thing. The live chain hides the same
            three lines on a shielded payment.
          </p>
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
            Pick a secret three-digit code. The Watcher closes his eyes while you type
            it, so he cannot see it.
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
            The Watcher asks three questions about your code, one at a time. Answer yes
            or no. He checks each answer against the code he never saw.
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
          The safe opens only if every answer matched your secret code. The record below
          is what the public gets to see.
        </p>
      ),
      description: allCorrect
        ? "He is convinced without ever seeing the code. That is the whole trick."
        : "A wrong answer means no proof, and no proof means no payment.",
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
