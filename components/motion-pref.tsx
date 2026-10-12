"use client";

/**
 * Motion preference (D-045): the page asks the visitor how much motion they
 * want, remembers the answer, and uses the computer's own setting only as the
 * starting default.
 *
 *   "more"  -> play the full reveal choreography (loops, stagger, sweeps).
 *   "less"  -> land the finished state with crossfades and no loops.
 *   null    -> not chosen yet; follow prefers-reduced-motion.
 *
 * Every animated component reads `reduced` from useMotionPref() instead of
 * calling useReducedMotion() directly, so one control governs the whole game.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";

export type MotionPref = "more" | "less" | null;

type MotionPrefValue = {
  /** true = play the calm version (crossfades, no infinite loops). */
  reduced: boolean;
  pref: MotionPref;
  setPref: (pref: Exclude<MotionPref, null>) => void;
};

const STORAGE_KEY = "zarcade-motion";

const MotionPrefContext = createContext<MotionPrefValue | null>(null);

function readStored(): MotionPref {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "more" || value === "less" ? value : null;
  } catch {
    return null;
  }
}

export function MotionPrefProvider({ children }: { children: ReactNode }) {
  const osReduced = useReducedMotion();
  const [pref, setPrefState] = useState<MotionPref>(() => readStored());

  const value = useMemo<MotionPrefValue>(() => {
    const reduced = pref === "less" ? true : pref === "more" ? false : osReduced === true;
    const setPref = (next: Exclude<MotionPref, null>) => {
      setPrefState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode and the like. The choice still applies for this visit.
      }
      // D-051: keep the pre-paint attributes on <html> in step with the click,
      // so the styles follow without waiting for a reload.
      const html = document.documentElement;
      html.setAttribute("data-pref", next);
      html.setAttribute("data-motion", next === "less" ? "less" : "more");
    };
    return { reduced, pref, setPref };
  }, [pref, osReduced]);

  return <MotionPrefContext.Provider value={value}>{children}</MotionPrefContext.Provider>;
}

/**
 * Reads the governing motion preference. Outside the provider (a standalone
 * render or test) it falls back to the OS setting so nothing animates against
 * a user who asked their computer for less motion.
 */
export function useMotionPref(): MotionPrefValue {
  const osReduced = useReducedMotion();
  const ctx = useContext(MotionPrefContext);
  if (ctx) return ctx;
  return { reduced: osReduced === true, pref: null, setPref: () => {} };
}

/**
 * The control the page uses to ask. A small labelled pair, More / Less, in the
 * same voice as everything else. Rendered in the marquee so it is always in
 * reach.
 */
export function MotionToggle({ className = "" }: { className?: string }) {
  const { pref, setPref } = useMotionPref();
  const options: { key: Exclude<MotionPref, null>; label: string }[] = [
    { key: "more", label: "More" },
    { key: "less", label: "Less" },
  ];

  return (
    <div
      className={"gm-motion " + className}
      role="group"
      aria-label="How much motion do you want?"
    >
      <span className="gm-motionLabel">Motion</span>
      <div className="gm-motionBox">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className="gm-motionBtn"
            data-opt={option.key}
            aria-pressed={pref === option.key}
            suppressHydrationWarning
            onClick={() => setPref(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* D-051: pressed state lands during parsing, before paint, so a saved
          choice shows correctly on a fresh load. React accepts the corrected
          DOM via suppressHydrationWarning above. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var p=localStorage.getItem("zarcade-motion");["more","less"].forEach(function(k){document.querySelectorAll('.gm-motionBtn[data-opt="'+k+'"]').forEach(function(b){b.setAttribute("aria-pressed",String(p===k))})})}catch(e){}})();`,
        }}
      />
    </div>
  );
}
