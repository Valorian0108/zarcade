"use client";

import { useState } from "react";
import { GameFrame } from "@/components/game/frame";
import type { ReactNode } from "react";
import type { WatcherMood } from "@/components/watcher";

type Step = "setup" | "ask1" | "ask2" | "ask3" | "end";

// Questions the Watcher can ask. Each one has a yes-or-no answer
// computed from the player's secret three-digit code.
const QUESTIONS = [
  {
    text: "Is your first digit greater than five?",
    test: (d: number[]) => d[0] > 5,
  },
  {
    text: "Is your second digit an even number?",
    test: (d: number[]) => d[1] % 2 === 0,
  },
  {
    text: "Do all three digits add up to more than ten?",
    test: (d: number[]) => d[0] + d[1] + d[2] > 10,
  },
  {
    text: "Is your third digit smaller than four?",
    test: (d: number[]) => d[2] < 4,
  },
  {
    text: "Are your first and third digits different?",
    test: (d: number[]) => d[0] !== d[2],
  },
  {
    text: "Is your second digit larger than your first?",
    test: (d: number[]) => d[1] > d[0],
  },
];

function pickQuestions(code: number[]): { text: string; answer: boolean }[] {
  const pool = [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map((q) => ({ text: q.text, answer: q.test(code) }));
}

export function Proof() {
  const [step, setStep] = useState<Step>("setup");
  const [mood, setMood] = useState<WatcherMood>("calm");
  const [code, setCode] = useState<string>("");
  const [questions, setQuestions] = useState<{ text: string; answer: boolean }[] | null>(
    null,
  );
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const setCodeDigits = (input: string) => {
    const cleaned = input.trim();
    if (/^\d{3}$/.test(cleaned)) {
      const ds = cleaned.split("").map((c) => parseInt(c, 10));
      setCode(cleaned);
      setQuestions(pickQuestions(ds));
      setStep("ask1");
      setAnswers([]);
      setFeedback(null);
      setMood("calm");
    }
  };

  const answer = (ans: boolean) => {
    const next = [...answers, ans];
    setAnswers(next);
    setMood("calm");
    setFeedback(null);

    if (next.length >= 3) {
      const allCorrect = questions!.every((q, i) => q.answer === next[i]);
      setStep("end");
      setMood(allCorrect ? "calm" : "alert");
      return;
    }

    const idx = next.length;
    const q = questions![idx];
    if (!q.answer === ans) {
      setFeedback("No. That does not match your code.");
    }
  };

  const allCorrect = questions
    ? questions.every((q, i) => q.answer === answers[i])
    : false;

  const stage = () => {
    switch (step) {
      case "setup": {
        return (
          <>
            <div className="gm-goalCard">
              <p className="gm-goalLabel">Set your code</p>
              <p className="gm-goalText">
                Pick any three-digit number. The Watcher turns his back. He never sees it.
              </p>
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <input
                type="text"
                maxLength={3}
                value={code}
                onChange={(e) => setCodeDigits(e.target.value)}
                className="w-32 h-12 text-center border border-input rounded-lg bg-background px-4 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="___"
              />
            </div>
          </>
        );
      }
      case "ask1":
      case "ask2":
      case "ask3": {
        const idx = step === "ask1" ? 0 : step === "ask2" ? 1 : 2;
        const q = questions![idx];
        return (
          <>
            <div className="gm-goalCard">
              <p className="gm-goalLabel">The Watcher asks</p>
              <p className="gm-goalText">{q.text}</p>
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button
                type="button"
                className="gm-btnPrimary"
                onClick={() => answer(true)}
              >
                Yes
              </button>
              <button
                type="button"
                className="gm-btnGhost"
                onClick={() => answer(false)}
              >
                No
              </button>
              {feedback && (
                <p className="gm-callSub gm-msgIn">{feedback}</p>
              )}
            </div>
          </>
        );
      }
      case "end": {
        return (
          <>
            <div className="gm-goalCard gm-cardIn">
              <p className="gm-goalLabel">The verdict</p>
              {allCorrect ? (
                <>
                  <p className="gm-goalText">
                    The Watcher is convinced. You know the code. He never saw it.
                  </p>
                  <p className="gm-goalText">
                    One thousand TAZ moves privately. The public record shows only that a payment happened.
                  </p>
                </>
              ) : (
                <p className="gm-goalText">
                  The answers do not match your code. The safe stays closed. Nothing moves.
                </p>
              )}
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button
                type="button"
                className={allCorrect ? "gm-btnGhost" : "gm-btnPrimary"}
                onClick={() => {
                  setStep("setup");
                  setCode("");
                  setQuestions(null);
                  setAnswers([]);
                  setFeedback(null);
                  setMood("calm");
                }}
              >
                {allCorrect ? "Back to the arcade" : "Try again"}
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
            </div>
          </>
        );
      }
    }
  };

  type PerStep = {
  chip: [string, string];
  panelLabel: string;
  caption: ReactNode;
  description: string;
  leak: number;
  leakLabel: string;
};

const perStep: Record<Step, PerStep> = {
    setup: {
      chip: ["Round 0 of 3", "Your secret code"],
      panelLabel: "The safe",
      caption: <p>Pick a secret three-digit code. The Watcher turns his back. He never sees it.</p>,
      description: "Your code is your spending key. Never say it out loud.",
      leak: 0,
      leakLabel: "Nothing pinned down yet.",
    },
    ask1: {
      chip: ["Round 1 of 3", "The first question"],
      panelLabel: "The question",
      caption: <p>The Watcher asks one question about your secret code. Answer yes or no.</p>,
      description: "Answer from your code alone. The Watcher does not know it.",
      leak: 0,
      leakLabel: "Nothing pinned down yet.",
    },
    ask2: {
      chip: ["Round 2 of 3", "The second question"],
      panelLabel: "The question",
      caption: <p>The Watcher asks another question about your secret code.</p>,
      description: "Answer from your code alone. The Watcher still does not know it.",
      leak: 0,
      leakLabel: "Nothing pinned down yet.",
    },
    ask3: {
      chip: ["Round 3 of 3", "The final question"],
      panelLabel: "The question",
      caption: <p>The Watcher asks the last question about your secret code.</p>,
      description: "Answer from your code alone. Three correct answers open the safe.",
      leak: 0,
      leakLabel: "Nothing pinned down yet.",
    },
    end: {
      chip: ["Done", "The verdict"],
      panelLabel: "The safe",
      caption: <p>The safe opens only if every answer matches your secret code.</p>,
      description: "A real payment happens privately. The public record shows nothing but that it was verified.",
      leak: 0,
      leakLabel: "Nothing pinned down, and that is the correct reading.",
    },
  };

  const s = perStep[step];

  return (
    <GameFrame
      title="The Proof Puzzle"
      teach="Show a guard you know a secret, without saying it."
      chip={s.chip}
      panelLabel={s.panelLabel}
      watcherMood={mood}
      leak={s.leak}
      leakLabel={s.leakLabel}
      description={s.description}
      showLeakMeter={false}
      caption={s.caption}
    >
      {stage()}
    </GameFrame>
  );
}
