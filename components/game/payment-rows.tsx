"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The seal sweep: Unseen's one signature animation (D-020, Layer 2 rule 4).
 *
 * The motion IS the lesson, so it is driven by facts rather than by which button
 * was pressed. Each row is sealed or left exposed according to what the network
 * really reports about that payment, and the bars sweep over the rows the chain
 * hides. A player who watches this three times has learned what shielding does
 * without reading a word.
 *
 * Sealed rows are covered from the right, one after another, because the data
 * goes away in a sequence you can follow. Exposed rows are never covered; they
 * sit in the leak colour instead, so the contrast is visible in the same instant.
 *
 * Under reduced motion the sweep collapses to a crossfade with no stagger. The
 * bars still land, so the lesson still reads (Layer 2 rule 7).
 *
 * Only transform and opacity animate, never width or height (Layer 1 gate).
 */

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type PaymentRow = {
  label: string;
  /** What the player sees on their own side of the payment. */
  value: ReactNode;
  /**
   * Taken from the real facts, never guessed.
   *   "sealed" the network hides it, so a bar covers it.
   *   "open"   anyone can read it, so it stays and wears the leak colour.
   *   "none"   there is nothing there to see, which is not the same as hiding it.
   * The third state matters: an open payment cannot carry a note at all, and
   * painting that row red would claim the network learned something it did not.
   */
  state: "sealed" | "open" | "none";
  /** Bar width per row, so four seals do not look like one copied four times. */
  barWidth: string;
};

export function PaymentRows({
  rows,
  caption,
}: {
  rows: readonly PaymentRow[];
  caption?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">Your payment</p>

      <div className="mt-3 space-y-3">
        {rows.map((row, index) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="shrink-0 text-xs text-muted-foreground">{row.label}</span>

            <span className="relative inline-flex min-h-5 flex-1 items-center justify-end overflow-hidden">
              <span
                className={
                  "truncate text-sm font-medium " +
                  (row.state === "open"
                    ? "text-leak"
                    : row.state === "sealed"
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70")
                }
              >
                {row.value}
              </span>

              {row.state === "sealed" && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 rounded-sm bg-foreground/90"
                  style={{ width: row.barWidth, transformOrigin: "right center" }}
                  initial={reduced ? { opacity: 0 } : { scaleX: 0, opacity: 1 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={
                    reduced
                      ? { duration: 0.18, delay: 0 }
                      : { duration: 0.34, ease: EASE_OUT, delay: index * 0.14 }
                  }
                />
              )}
            </span>
          </div>
        ))}
      </div>

      {caption && <p className="mt-3.5 text-xs leading-5 text-muted-foreground">{caption}</p>}
    </div>
  );
}
