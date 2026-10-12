"use client";

import { motion } from "motion/react";
import type { GlyphName } from "@/lib/games";

/**
 * The custom icon set (D-010), first four pieces. Hand-drawn vectors, one
 * stroke style, no emoji, no icon library. Each glyph carries ONE small
 * cursor-triggered tease (D-019, "customized cursor movement"): the check
 * pops, the slash sweeps, the key turns, the arrow crosses. Transform and
 * opacity only (Layer 2 / slop gate). The cabinet passes active=false under
 * prefers-reduced-motion, so the teases simply never fire.
 *
 * They inherit `currentColor`; the cabinet sets them faint and brightens on
 * hover. Colors stay muted because these cabinets are "coming soon".
 */

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const T = { duration: 0.16, ease: EASE_OUT };

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function Glyph({ name, active }: { name: GlyphName; active: boolean }) {
  switch (name) {
    case "proof":
      return <ProofGlyph active={active} />;
    case "doublespend":
      return <DoubleSpendGlyph active={active} />;
    case "auditor":
      return <AuditorGlyph active={active} />;
    case "vault":
      return <VaultGlyph active={active} />;
  }
}

/** A closed padlock with a check: proved it is real without opening it. */
function ProofGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className="size-10" aria-hidden="true">
      <path d="M18 21v-4a6 6 0 0 1 12 0v4" {...S} />
      <rect x="15" y="21" width="18" height="14" rx="3" {...S} />
      <motion.path
        d="M20 28.5l3 3 5.5-7"
        {...S}
        initial={false}
        animate={{ opacity: active ? 1 : 0.4, scale: active ? 1 : 0.8 }}
        transition={T}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}

/** One coin with a faded twin, slashed: you cannot spend the same coin twice. */
function DoubleSpendGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className="size-10" aria-hidden="true">
      <circle cx="20" cy="24" r="8" {...S} />
      <circle cx="29" cy="24" r="8" {...S} opacity="0.45" />
      <motion.path
        d="M13 15l23 18"
        {...S}
        initial={false}
        animate={{ opacity: active ? 1 : 0.4, scaleX: active ? 1 : 0.5 }}
        transition={T}
        style={{ transformBox: "fill-box", transformOrigin: "left center" }}
      />
    </svg>
  );
}

/** An eye whose pupil is a keyhole that turns: look, but do not spend. */
function AuditorGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className="size-10" aria-hidden="true">
      <path d="M6 24c6-9 30-9 36 0-6 9-30 9-36 0z" {...S} />
      <motion.g
        initial={false}
        animate={{ rotate: active ? 22 : 0, opacity: active ? 1 : 0.55 }}
        transition={T}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <circle cx="24" cy="21.5" r="3.2" {...S} />
        <path d="M22.4 24h3.2l1.1 6h-5.4z" {...S} />
      </motion.g>
    </svg>
  );
}

/** A glass room and a solid room with an arrow crossing: move between pools. */
function VaultGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className="size-10" aria-hidden="true">
      <rect x="6" y="14" width="15" height="20" rx="2" {...S} />
      <circle cx="13.5" cy="24" r="3" {...S} opacity="0.6" />
      <rect x="27" y="14" width="15" height="20" rx="2" {...S} />
      <path d="M31 19h7M31 24h7M31 29h7" {...S} opacity="0.3" />
      <motion.g
        initial={false}
        animate={{ x: active ? 4 : -4, opacity: active ? 1 : 0.45 }}
        transition={T}
      >
        <path d="M16 24h14" {...S} />
        <path d="M27 21l3 3-3 3" {...S} />
      </motion.g>
    </svg>
  );
}
