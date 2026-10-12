"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Watcher, type WatcherMood } from "@/components/watcher";

/**
 * The shared game frame (A5, D-021). Every game sits inside this one shell so
 * the arcade feels like a single place. Four regions, identical across games:
 *   1. header  — game name (Syne) + the one-line teach.
 *   2. stage   — the scene, with a reserved Watcher slot on the right so the
 *                public is always in the room.
 *   3. explanation panel — plain words for what just happened (Layer 4).
 *   4. leak meter — one bar that fills with exactly what the public learned.
 *
 * The frame is PRESENTATIONAL only. Game logic lives in each game (Phase B);
 * it passes its current mood / leak / description down as props.
 */

const EASE_CREEP: [number, number, number, number] = [0.65, 0, 0.35, 1];
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function GameFrame({
  title,
  teach,
  watcherMood,
  leak,
  leakLabel,
  description,
  children,
}: {
  title: string;
  teach: string;
  watcherMood: WatcherMood;
  /** 0 = the public learned nothing, 1 = the public learned everything. */
  leak: number;
  leakLabel: string;
  description: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const pct = Math.round(Math.min(1, Math.max(0, leak)) * 100);

  return (
    <main className="relative flex-1 w-full">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(48rem 30rem at 30% 20%, color-mix(in oklch, var(--primary) 6%, transparent), transparent 62%)",
        }}
      />

      <div className="mx-auto w-full max-w-5xl px-6 py-10 md:py-14">
        {/* 1. header */}
        <header className="mb-6 space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          <p className="max-w-prose leading-7 text-muted-foreground">{teach}</p>
        </header>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] md:items-stretch">
          {/* 2. stage + Watcher slot */}
          <section
            aria-label="The scene"
            className="flex flex-col items-center gap-5 rounded-xl border border-border bg-background p-5 md:flex-row"
          >
            <div className="w-full flex-1">{children}</div>
            <div className="shrink-0">
              <Watcher mood={watcherMood} className="h-40 w-auto md:h-48" />
            </div>
          </section>

          {/* 3 + 4. explanation panel + leak meter */}
          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="text-xs font-medium text-muted-foreground">
                What just happened
              </p>
              <div className="mt-2 min-h-16">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={description}
                    initial={reduced ? { opacity: 1 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? { opacity: 1 } : { opacity: 0, y: -4 }}
                    transition={{ duration: reduced ? 0 : 0.18, ease: EASE_OUT }}
                    className="text-sm leading-6 text-foreground"
                  >
                    {description}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-secondary p-4">
              <p className="text-xs font-medium text-muted-foreground">
                What the public learned
              </p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "var(--leak)" }}
                  initial={false}
                  animate={{ width: `${pct}%`, opacity: pct > 0 ? 1 : 0 }}
                  transition={
                    reduced ? { duration: 0 } : { duration: 0.5, ease: EASE_CREEP }
                  }
                />
              </div>
              <p
                className={
                  "mt-2.5 text-sm font-medium " +
                  (pct > 2 ? "text-leak" : "text-valid")
                }
              >
                {leakLabel}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
