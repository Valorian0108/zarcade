"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

export type WatcherMood = "calm" | "alert" | "blind";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * The Watcher — "the public" as a character (STYLEGUIDE.md cast, D-010/D-015).
 * Custom vector, drawn here. No emoji, no icon libraries.
 *
 * Idle loops (float, blink, mote) are DELIBERATE infinite animations —
 * documented exception per STYLEGUIDE.md Layer 2 rule 1 (D-014, owner-approved)
 * and design-motion-principles' "explicit design rationale" clause: the Watcher
 * idling IS the status — the public never stops watching the transparent chain.
 * Under prefers-reduced-motion every loop stops and moods crossfade instead.
 */
export function Watcher({
  mood = "calm",
  className = "h-52 w-auto md:h-64",
}: {
  mood?: WatcherMood;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [blink, setBlink] = useState(false);
  const [drift, setDrift] = useState({ x: 0, y: 0 });

  // Blink: the character feels alive when it blinks at irregular intervals.
  useEffect(() => {
    if (reduced || mood === "blind") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          schedule();
        }, 130);
      }, 2400 + Math.random() * 3400);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reduced, mood]);

  // Pupil drift: it looks around the stage while it watches.
  useEffect(() => {
    if (reduced || mood === "blind") return;
    const id = setInterval(() => {
      setDrift({
        x: (Math.random() - 0.5) * 12,
        y: (Math.random() - 0.5) * 7,
      });
    }, 1700);
    return () => clearInterval(id);
  }, [reduced, mood]);

  const lidClosed = blink || mood === "blind";

  return (
    <motion.svg
      viewBox="0 0 200 240"
      role="img"
      aria-label={`The Watcher. It stands for everyone who can see the public record of payments. Right now it is ${
        mood === "alert"
          ? "alert: it just read a payment that was not hidden"
          : mood === "blind"
            ? "blind: you hid the payment, so it sees nothing"
            : "calm: watching for payments it can read"
      }`}
      className={className}
      animate={reduced ? { y: 0 } : { y: [0, -7, 0] }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { duration: 4.6, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {/* mood pose: leans IN when it can read your data (alert), recoils
          shut when shielded (blind). Character motion — gentle spring is
          allowed on playful elements per STYLEGUIDE Layer 3 amendment 4. */}
      <motion.g
        animate={{
          y: mood === "alert" ? 10 : mood === "blind" ? -5 : 0,
          scale: mood === "alert" ? 1.05 : mood === "blind" ? 0.96 : 1,
          rotate: mood === "blind" ? -4 : mood === "alert" ? 2 : 0,
        }}
        transition={
          reduced
            ? { duration: 0.15 }
            : { type: "spring", stiffness: 150, damping: 17 }
        }
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        {/* orbiting mote — secondary motion (Layer 2 rule 6) */}
        <motion.g
          animate={reduced ? { rotate: 0 } : { rotate: 360 }}
          transition={
            reduced
              ? { duration: 0.15 }
              : { duration: 14, repeat: Infinity, ease: "linear" }
          }
          style={{ transformOrigin: "100px 112px" }}
        >
          <circle cx="100" cy="34" r="3.5" fill="var(--primary)" opacity="0.5" />
        </motion.g>

        {/* body — a floating sentinel */}
        <path
          d="M100 26 C 142 26 168 62 168 112 C 168 168 140 200 100 200 C 60 200 32 168 32 112 C 32 62 58 26 100 26 Z"
          fill="var(--secondary)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        {/* cloak seam for a little depth */}
        <path
          d="M44 152 Q100 178 156 152"
          fill="none"
          stroke="var(--input)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* alert glow — it sees exposed data (graphic, 3:1 exempt) */}
        <motion.circle
          cx="100"
          cy="112"
          r="40"
          fill="var(--leak)"
          animate={{ opacity: mood === "alert" ? 0.22 : 0, scale: 1.15 }}
          transition={reduced ? { duration: 0.15 } : { duration: 0.3, ease: EASE_OUT }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />

        {/* eye socket */}
        <circle cx="100" cy="112" r="36" fill="var(--background)" />

        {/* iris + pupil, clipped to the socket so the lid can cover them */}
        <g clipPath="url(#watcher-socket)">
          <motion.g
            animate={{ x: mood === "blind" ? 0 : drift.x, y: mood === "blind" ? 0 : drift.y }}
            transition={reduced ? { duration: 0.15 } : { duration: 0.6, ease: EASE_OUT }}
          >
            <motion.circle
              cx="100"
              cy="112"
              fill="var(--primary)"
              animate={{
                r: mood === "alert" ? 21 : mood === "blind" ? 16 : 18,
                opacity: mood === "blind" ? 0.35 : mood === "alert" ? 1 : 0.85,
              }}
              transition={reduced ? { duration: 0.15 } : { duration: 0.22, ease: EASE_OUT }}
            />
            <ellipse cx="100" cy="112" rx="5" ry="13" fill="var(--background)" />
            <circle cx="92" cy="102" r="3.5" fill="var(--foreground)" opacity="0.85" />
          </motion.g>

          {/* lid — blink + blind (mood). transform, not height (gate 14). */}
          <motion.rect
            x="60"
            y="72"
            width="80"
            height="80"
            fill="var(--secondary)"
            animate={{ scaleY: lidClosed ? 1 : 0 }}
            transition={reduced ? { duration: 0.15 } : { duration: 0.09, ease: EASE_OUT }}
            style={{ transformBox: "fill-box", transformOrigin: "top" }}
          />
        </g>
      </motion.g>

      <defs>
        <clipPath id="watcher-socket">
          <circle cx="100" cy="112" r="36" />
        </clipPath>
      </defs>
    </motion.svg>
  );
}
