"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionToggle, useMotionPref } from "@/components/motion-pref";
import { Watcher, type WatcherMood } from "@/components/watcher";

/**
 * D-073: a hot reload swaps new code into an open tab without a full page
 * reload, but an effect whose deps did not change does not re-run, so a tab
 * left open across deploys kept the peek measure closure it was born with
 * and peeked with a translate measured from a layout that no longer exists:
 * the watcher came out all the way instead of hiding at the edge (owner:
 * "the peking watcher is coming out al the way tio peek its meant to hide
 * with just itsface visiblr"). This counter lives on window and increments
 * on every evaluation of this module, hot or cold, so every code swap
 * changes the peek effect's deps and the effect re-runs and re-measures. An
 * open tab now heals itself on the very push that changed the code, with no
 * reload asked of the owner.
 */
const doorModuleEpoch = (() => {
  if (typeof window === "undefined") return 0;
  const w = window as Window & { __zarcadeDoorEpoch?: number };
  w.__zarcadeDoorEpoch = (w.__zarcadeDoorEpoch ?? 0) + 1;
  return w.__zarcadeDoorEpoch;
})();

// D-069's tuned pair, named by D-073 so "hide more" or "hide less" is a
// one-number edit: the fraction of the figure's width that stays offscreen
// at the peek hold, and the diagonal lean that swings the eye around the
// corner into the visible sliver. The two are tuned together by machine
// check: more hidden or less lean and the eye itself clips the screen edge.
const PEEK_HIDDEN_FRACTION = 0.56;
const PEEK_LEAN_DEG = 16;

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
 * D-068): one slow ambient story on a ~30s cycle (D-091, cut from 40s by
 * trimming only the waiting). He stands idle on the
 * near edge of the raised back platform, in his depth size, a real door
 * appears deeper on the platform, against the far wall (tall enough to
 * enter, behind him in layer order), its inner light rises as he walks
 * across the platform toward the wall, climbing its depth and shrinking a
 * few percent more, the leaf swings open, he steps in shrinking to fit, the
 * leaf shuts behind him, the closed door holds a beat
 * and fades, the sign glows softer for an empty beat, then he peeks in from
 * behind the room's nearer wall (hood and eye only) and slips away, fading
 * back to
 * his resting spot. The peek is the only JS part: one effect measures where
 * the figure rests and writes three CSS variables (--peekX, --peekFull,
 * --peekTilt); the stylesheet carries safe fallbacks, so the story still
 * plays if measuring ever fails. The walk distance and door size are CSS
 * variables per breakpoint, computed from the fixed figure geometry (D-069:
 * the figure is 150px wide on this page, small enough that his own door
 * towers over him, and the peek hides 56% of him behind a 16deg lean). Under
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

  // D-055, restaged by D-069, hardened by D-071 and D-073: measure the
  // resting spot, and re-measure whenever the layout can breathe: on
  // resize, on window load, when the webfonts settle, when the tab becomes
  // visible again, and once per story cycle via the watcher's
  // animationiteration. D-071 added those triggers after a deploy moved the
  // scene without firing resize. D-073 adds the epoch dep below after the
  // owner's open tab proved that triggers inside an effect are useless when
  // the effect itself never re-runs, which is exactly what a hot reload does
  // to an effect whose deps did not change. A peek variable may never
  // outlive the layout it was measured from, and a peek closure may never
  // outlive the code that defined it. The hidden fraction and the lean are
  // the named constants at the top of this file: most of the body stays out
  // of view, because that is what a peek is, and the lean swings the head
  // and eye around the corner into the visible sliver, hood first, like
  // somebody craning around a doorframe. The machine check measures the
  // eye's screen position during the peek and fails if it is offscreen.
  useEffect(() => {
    if (reduced) return;
    const el = storyRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      // D-090 (proposed): measure against the room box, not the window.
      // At and below 1120 the box IS the window, so every approved number
      // stands untouched; above it the box is fixed, so the peek hold is
      // identical at every zoom and the hidden half clips at the room's
      // own wall instead of floating in the margin beyond it.
      const room = el.closest(".gm-doorMain")?.getBoundingClientRect();
      const toLeft = room ? r.left - room.left : r.left;
      const toRight = room ? room.right - r.right : window.innerWidth - r.right;
      const fromLeft = toLeft <= toRight;
      const hidden = r.width * PEEK_HIDDEN_FRACTION;
      const peek = fromLeft ? -(toLeft + hidden) : toRight + hidden;
      const full = fromLeft ? -(toLeft + r.width + 80) : toRight + r.width + 80;
      el.style.setProperty("--peekX", `${Math.round(peek)}px`);
      el.style.setProperty("--peekFull", `${Math.round(full)}px`);
      // The diagonal lean: most of him stays hidden, the eye cranes in.
      el.style.setProperty(
        "--peekTilt",
        fromLeft ? `${PEEK_LEAN_DEG}deg` : `-${PEEK_LEAN_DEG}deg`,
      );
      // The floor line in root coordinates, so the wall-to-wall band sits
      // at his feet without living inside the clipped room box.
      const doorEl = el.closest<HTMLElement>(".gm-door");
      if (doorEl) {
        const d = doorEl.getBoundingClientRect();
        doorEl.style.setProperty(
          "--floorY",
          `${Math.round(r.bottom - d.top)}px`,
        );
      }
    };
    measure();
    const watcherEl = el.querySelector(".gm-watcher");
    const fontsReady = document.fonts ? document.fonts.ready.then(measure, () => {}) : null;
    const onVisible = () => {
      if (document.visibilityState === "visible") measure();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    document.addEventListener("visibilitychange", onVisible);
    watcherEl?.addEventListener("animationiteration", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("load", measure);
      document.removeEventListener("visibilitychange", onVisible);
      watcherEl?.removeEventListener("animationiteration", measure);
      if (fontsReady) fontsReady.catch(() => {});
    };
    // D-073: the epoch dep is intentional. The lint rule assumes an
    // outer-scope value never changes between renders, which is true within
    // one module instance and false across a hot reload: the module
    // re-evaluates, the epoch increments, Fast Refresh re-renders with the
    // new value, and this dep is the only thing that makes the effect
    // re-run and re-measure in a tab that never reloaded.
  }, [reduced, doorModuleEpoch]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* The near floor, wall to wall (owner zoom report 2026-10-14,
          re-anchored by the D-090 proposal). It lives on the room root,
          outside the clipped room box, so it can span the whole window
          while the box clips the peek at its own wall: he hides behind a
          wall and stands on a floor at every zoom. Drawn only above 1120;
          at and below that the box fills the window and the approved look
          stands untouched. Its vertical position is --floorY, written by
          the same effect that measures the peek. */}
      <span className="gm-wFloor" aria-hidden="true" />
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
            <Watcher mood={mood} width={150} />
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
