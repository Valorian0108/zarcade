"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionToggle, useMotionPref } from "@/components/motion-pref";
import { Watcher, type WatcherMood } from "@/components/watcher";

/**
 * The front door (D-050). Its only jobs: say the name, say what the place is
 * in a human voice, make the visitor feel watched, and offer ONE way in.
 *
 * The landing choreography lives in game.css (.gm-door section) and takes
 * about two seconds. The only JS beat is the Watcher's eye opening: it mounts
 * blind (lid shut, lantern dim), flares to alert once at ~1300ms, and settles
 * to calm at ~2100ms. That reuses the approved mood machinery.
 *
 * After the landing the Watcher lives (D-055, restaged by D-062, D-067 and
 * D-068): one slow ambient story on a ~40s cycle. He stands idle on the
 * near edge of the raised back platform, in his depth size, a real door
 * appears deeper on the platform, against the far wall (tall enough to
 * enter, behind him in layer order), its inner light rises as he walks
 * across the platform toward the wall, climbing its depth and shrinking a
 * few percent more, the leaf swings open, he steps in shrinking to fit, the
 * leaf shuts behind him, the closed door holds a beat
 * and fades, the sign glows softer for an empty beat, then he peeks in from
 * the nearest screen edge (hood and eye only) and slips away, fading back to
 * his resting spot. The peek is the only JS part: one effect measures where
 * the figure rests and writes three CSS variables (--peekX, --peekFull,
 * --peekTilt); the stylesheet carries safe fallbacks, so the story still
 * plays if measuring ever fails. The walk distance and door size are CSS
 * variables per breakpoint, computed from the fixed figure geometry. Under
 * "less" motion none of this plays and nothing is measured.
 *
 * Pressing "Step inside": the button sinks (CSS :active), the lantern flares
 * (you acted, the public noticed), then the floor loads. Under the "less"
 * motion preference the CSS beats land instantly via the global rule (D-045,
 * redefined by D-057) and this sequence is skipped entirely: the Watcher is
 * simply calm.
 */
export function Door() {
  const { reduced } = useMotionPref();
  const router = useRouter();
  const [mood, setMood] = useState<WatcherMood>("blind");
  const storyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (reduced) {
      // "less": no sequence at all, the Watcher is simply calm. Set in a
      // timeout callback so the effect never calls setState synchronously.
      const land = window.setTimeout(() => setMood("calm"), 0);
      return () => window.clearTimeout(land);
    }
    const flare = window.setTimeout(() => setMood("alert"), 1300);
    const settle = window.setTimeout(() => setMood("calm"), 2100);
    return () => {
      window.clearTimeout(flare);
      window.clearTimeout(settle);
    };
  }, [reduced]);

  // D-055: measure the resting spot once, and again on resize, so the peek
  // comes from whichever screen edge is nearer at any window width. The
  // hidden fraction is 40%: the eye sits at ~46% of the figure's width and
  // the hood rim starts at ~30%, so hiding more than 40% would push the eye
  // itself past the edge. The machine check measures the eye's screen
  // position during the peek and fails if it is offscreen.
  useEffect(() => {
    if (reduced) return;
    const el = storyRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const toLeft = r.left;
      const toRight = window.innerWidth - r.right;
      const fromLeft = toLeft <= toRight;
      const hidden = r.width * 0.4;
      const peek = fromLeft ? -(toLeft + hidden) : toRight + hidden;
      const full = fromLeft ? -(toLeft + r.width + 80) : toRight + r.width + 80;
      el.style.setProperty("--peekX", `${Math.round(peek)}px`);
      el.style.setProperty("--peekFull", `${Math.round(full)}px`);
      // Lean into the peek, like somebody turning their head around a corner.
      el.style.setProperty("--peekTilt", fromLeft ? "4deg" : "-4deg");
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [reduced]);

  function enter() {
    if (reduced) {
      router.push("/arcade");
      return;
    }
    setMood("alert");
    window.setTimeout(() => router.push("/arcade"), 420);
  }

  return (
    <div className="gm-root gm-door">
      <p className="gm-banner">
        Everything here runs on the Zcash test network with practice money.
        Nothing costs anything.
      </p>

      <div className="gm-doorTop">
        <MotionToggle />
      </div>

      <main className="gm-doorMain">
        <div className="gm-doorSide">
          <h1 className="gm-doorTitle">
            <span className="gm-doorTitleBase" aria-hidden="true">
              ZARCADE
            </span>
            <span className="gm-doorTitleSweep" aria-hidden="true">
              ZARCADE
            </span>
            <span className="sr-only">Zarcade</span>
          </h1>

          <p className="gm-doorLine" data-lead="true">
            This is an arcade that teaches Zcash privacy.
          </p>
          <p className="gm-doorLine">
            Every machine is a small game about one privacy feature. You learn
            it by moving real practice money on the Zcash test network. You
            never need a wallet of your own.
          </p>

          <button
            type="button"
            className="gm-btnPrimary gm-doorBtn"
            onClick={enter}
          >
            Step inside
          </button>
        </div>

        <div className="gm-doorWatch">
          <div className="gm-wStory" ref={storyRef}>
            <Watcher mood={mood} width={300} />
            {/* The door he walks through (D-055, restaged by D-062): frame,
                threshold, an inner light, and a leaf that swings open for
                him. Decorative; the story cycle in game.css gives it life. */}
            <div className="gm-wMiniDoor" aria-hidden="true">
              <span className="gm-wMiniGlow" />
              <span className="gm-wMiniLeaf">
                <span className="gm-wMiniKnob" />
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* D-056: the quiet footer. The contrast line is the point: payments
          can be private, this code is public. It arrives after the entry
          button ignites and never competes with it. */}
      <footer className="gm-doorFoot">
        <p className="gm-doorFootLine">
          Your payments can be private. This code is public.
        </p>
        <a
          className="gm-ghLink"
          href="https://github.com/Valorian0108/zarcade"
          target="_blank"
          rel="noopener noreferrer"
        >
          GITHUB
        </a>
      </footer>
    </div>
  );
}
