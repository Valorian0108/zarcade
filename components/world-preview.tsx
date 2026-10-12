"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Watcher, type WatcherMood } from "@/components/watcher";

/**
 * World preview (D-015): a living slice of the first game, "Unseen".
 * One choice, hide the payment or don't, and the world reacts:
 * the chain card rewrites itself, the Watcher changes mood, the leak
 * meter shows exactly what the public learned. Motion teaches (Layer 2).
 *
 * Copy follows the Layer 4 voice rule (D-018, owner-approved):
 * plain words, short sentences, no em dashes, lesson words explained
 * on the same screen.
 */

type Phase = "intro" | "sealed" | "leaked";

// STYLEGUIDE Layer 2 timings: controls 140–220ms, teaching beats up to ~600ms.
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_CREEP: [number, number, number, number] = [0.65, 0, 0.35, 1];

/* ---------------------------------------------------------------- glyphs
   Custom inline SVGs only — start of the site-wide icon set (D-010). */

function CheckGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="8.5"
        fill="none"
        stroke="var(--valid)"
        strokeWidth="1.5"
      />
      <path
        d="M6 10.2 L8.8 13 L14 7.2"
        fill="none"
        stroke="var(--valid)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 shrink-0" aria-hidden="true">
      <path
        d="M2 10 C5 5.2 15 5.2 18 10 C15 14.8 5 14.8 2 10 Z"
        fill="none"
        stroke="var(--leak)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" fill="var(--leak)" />
    </svg>
  );
}

/* ------------------------------------------------------------ chain rows
   Monospace is allowed HERE and only here — it is real chain data
   (Layer 3 amendment 2). */

function Redacted({ width, delay }: { width: string; delay: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      className="inline-block rounded-[3px] bg-foreground/70 align-middle"
      style={{ width, height: "0.85em", transformOrigin: "left" }}
      initial={reduced ? { opacity: 0 } : { scaleX: 0, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { scaleX: 1, opacity: 1 }}
      transition={{
        duration: reduced ? 0.15 : 0.22,
        ease: EASE_OUT,
        delay: reduced ? 0 : delay,
      }}
    />
  );
}

function ChainRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{children}</span>
    </div>
  );
}

function SeenMark() {
  return (
    <span className="ml-2 inline-block text-xs font-medium text-leak">
      seen
    </span>
  );
}

const FROM = "you · t1a7v…3f9e";
const TO = "friend · t1k2p…8bzd";

function ChainContents({ phase }: { phase: Phase }) {
  if (phase === "sealed") {
    // The single choreographed stagger moment (Layer 3 amendment 3):
    // the redaction sweep IS the lesson — data being covered, row by row.
    return (
      <>
        <ChainRow label="status">
          <span className="inline-flex items-center gap-1.5 text-valid">
            <CheckGlyph /> the math checked out
          </span>
        </ChainRow>
        <ChainRow label="pool">hidden pool</ChainRow>
        <ChainRow label="from">
          <Redacted width="11ch" delay={0.06} />
        </ChainRow>
        <ChainRow label="to">
          <Redacted width="9ch" delay={0.12} />
        </ChainRow>
        <ChainRow label="value">
          <Redacted width="6ch" delay={0.18} />
        </ChainRow>
        <ChainRow label="memo">
          <Redacted width="4ch" delay={0.24} />
        </ChainRow>
      </>
    );
  }

  if (phase === "leaked") {
    return (
      <>
        <ChainRow label="status">on the public list, in plain text</ChainRow>
        <ChainRow label="from">
          {FROM}
          <SeenMark />
        </ChainRow>
        <ChainRow label="to">
          {TO}
          <SeenMark />
        </ChainRow>
        <ChainRow label="value">
          5.00 ZEC<SeenMark />
        </ChainRow>
        <ChainRow label="memo">
          &quot;rent&quot;<SeenMark />
        </ChainRow>
      </>
    );
  }

  return (
    <>
      <ChainRow label="status">waiting for you to choose</ChainRow>
      <ChainRow label="from">{FROM}</ChainRow>
      <ChainRow label="to">{TO}</ChainRow>
      <ChainRow label="value">5.00 ZEC</ChainRow>
      <ChainRow label="memo">&quot;rent&quot;</ChainRow>
    </>
  );
}

/* ---------------------------------------------------------------- scene */

const WATCHER_LINES: Record<Phase, string> = {
  intro:
    "It watches every payment that is not hidden. It is not mean. It is just everyone, looking.",
  leaked: "It just read your payment. Who paid, how much, and the note. All of it.",
  sealed:
    "It only sees that the payment is real. Nothing else. Your business stays yours.",
};

const LEAK_CAPTIONS: Record<Phase, string> = {
  intro: "Nothing yet. You have not sent anything.",
  leaked: "Everything. Who paid, who got paid, how much, and the note. Forever.",
  sealed: "Nothing. The network checked the math and learned no secrets.",
};

const LESSONS: Record<"sealed" | "leaked", string> = {
  sealed:
    "You put 5 ZEC into the hidden pool. The network ran a math check (that is what “proof” means here) that the coins are real. The check never shows who paid, who got paid, or how much. The Watcher learned only that a real payment happened.",
  leaked:
    "The payment was written on the public list in plain text. Anyone can read it now, the Watcher included. Who paid, who got paid, how much, and the note. Nothing went wrong. This is just what “public” means.",
};

export function WorldPreview() {
  const [phase, setPhase] = useState<Phase>("intro");
  const reduced = useReducedMotion();

  const mood: WatcherMood =
    phase === "leaked" ? "alert" : phase === "sealed" ? "blind" : "calm";

  return (
    <main className="relative mx-auto grid min-h-screen w-full max-w-5xl grid-cols-1 items-center gap-x-12 gap-y-10 px-6 py-16 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* atmosphere: one static gold bloom, token-mixed (Layer 3) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(58rem 38rem at 72% 14%, color-mix(in oklch, var(--primary) 7%, transparent), transparent 62%)",
        }}
      />

      {/* left column: the Watcher + its line */}
      <div className="flex flex-col items-center gap-5 md:items-start">
        <Watcher mood={mood} />
        <div className="space-y-1 text-center md:text-left">
          <p className="text-sm font-semibold text-foreground">The Watcher</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={phase}
              className="max-w-64 text-sm leading-6 text-muted-foreground"
              initial={{ opacity: 0, y: reduced ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              {WATCHER_LINES[phase]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* right column: the scene */}
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-[2.6rem] md:leading-tight">
            You are sending a friend 5 ZEC.
          </h1>
          <p className="max-w-prose leading-7 text-muted-foreground">
            Everyone on the network can watch this payment. You get to choose
            one thing: how much they see. This is a first look at{" "}
            <span className="text-foreground">Unseen</span>, the first game.
          </p>
        </div>

        {/* the chain card */}
        <section
          aria-label="What the network can see"
          className="rounded-lg border border-border bg-card p-5"
        >
          <h2 className="text-sm font-semibold text-card-foreground">
            What the network can see
          </h2>
          <div className="mt-3 space-y-1.5 font-mono text-sm leading-7">
            <ChainContents phase={phase} />
          </div>
        </section>

        {/* the choice */}
        <div className="flex min-h-12 flex-wrap items-center gap-3">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "intro" ? (
              <motion.div
                key="choice"
                className="flex flex-wrap items-center gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <Button
                  size="lg"
                  className="h-12 px-6 text-base"
                  onClick={() => setPhase("sealed")}
                >
                  hide it
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 px-6 text-base"
                  onClick={() => setPhase("leaked")}
                >
                  don&apos;t hide it
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="reset"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              >
                <Button
                  variant="ghost"
                  className="h-10 px-4"
                  onClick={() => setPhase("intro")}
                >
                  try the other way
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* leak meter */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            What the public learned
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Leak meter: ${LEAK_CAPTIONS[phase]}`}
          >
            <motion.div
              className="h-full rounded-full bg-leak"
              style={{ transformOrigin: "left" }}
              initial={false}
              animate={{ scaleX: phase === "leaked" ? 1 : 0 }}
              transition={
                phase === "leaked"
                  ? { duration: reduced ? 0.15 : 0.6, ease: EASE_CREEP }
                  : { duration: reduced ? 0.15 : 0.3, ease: EASE_OUT }
              }
            />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={phase}
              className={`text-sm leading-6 ${
                phase === "leaked"
                  ? "text-leak"
                  : phase === "sealed"
                    ? "text-valid"
                    : "text-muted-foreground"
              }`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              {LEAK_CAPTIONS[phase]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* the teacher — why the world just changed */}
        <AnimatePresence initial={false}>
          {phase !== "intro" && (
            <motion.div
              key={phase}
              className={`flex gap-3 rounded-lg border p-4 ${
                phase === "sealed"
                  ? "border-valid/30 bg-valid/5"
                  : "border-leak/30 bg-leak/5"
              }`}
              initial={{ opacity: 0, y: reduced ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
              {phase === "sealed" ? <CheckGlyph /> : <EyeGlyph />}
              <p className="text-sm leading-6 text-muted-foreground">
                {LESSONS[phase]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
