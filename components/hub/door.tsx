"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MotionToggle, useMotionPref } from "@/components/motion-pref";
import { Watcher, type WatcherMood } from "@/components/watcher";

/**
 * The front door (D-050). Its only jobs: say the name, say what the place is
 * in a human voice, make the visitor feel watched, and offer ONE way in.
 *
 * The landing choreography lives in game.css (.gm-door section) and takes
 * about two seconds, then the room is quiet forever. The only JS beat is the
 * Watcher's eye opening: it mounts blind (lid shut, lantern dim), flares to
 * alert once at ~1300ms, and settles to calm at ~2100ms. That reuses the
 * approved mood machinery, so no new watcher motion exists.
 *
 * Pressing "Step inside": the button sinks (CSS :active), the lantern flares
 * (you acted, the public noticed), then the floor loads. Under the "less"
 * motion preference the CSS beats land instantly via the global D-045 rule
 * and this sequence is skipped entirely: the Watcher is simply calm.
 */
export function Door() {
  const { reduced } = useMotionPref();
  const router = useRouter();
  const [mood, setMood] = useState<WatcherMood>("blind");

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
            This is an arcade that teaches Zcash.
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
          <Watcher mood={mood} width={300} />
        </div>
      </main>
    </div>
  );
}
