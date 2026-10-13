"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Watcher } from "@/components/watcher";
import { useMotionPref } from "@/components/motion-pref";
import { Glyph } from "./glyphs";
import type { GameEntry } from "@/lib/games";

/**
 * One arcade cabinet (D-019 design, Layer 5 skin per D-050). The truth the
 * styling tells: a lit cabinet is a live machine (gold rim, screen on, the
 * Watcher alive inside), a dark cabinet is sealed (screen off, faint glyph,
 * "coming soon", not clickable, so no dead links).
 *
 * Motion budget:
 *  - mount: a fade-in on a stagger (set by the floor); the lit cabinet rises
 *    LAST, ignites, then holds a slow attract pulse (5s, above the D-042
 *    floor). All pure CSS in game.css (.gm-cab section).
 *  - hover a lit cabinet: 1px lift + rim brightens (controls tier, 140ms).
 *  - hover a dark cabinet: its glyph brightens a little (the D-019 tease).
 *  - press a lit cabinet: one gold screen flare (the power-on beat), then
 *    navigate.
 * Under the "less" motion preference the global D-045 rule lands every state
 * instantly and the press navigates with no flare.
 */
export function Cabinet({
  game,
  hero = false,
  index = 0,
}: {
  game: GameEntry;
  /** The live cabinet stands bigger on the left (D-019). */
  hero?: boolean;
  /** Stagger position among the dark cabinets. */
  index?: number;
}) {
  const { reduced } = useMotionPref();
  const router = useRouter();
  const [clicking, setClicking] = useState(false);
  const [hovered, setHovered] = useState(false);
  const playable = game.status === "playable" && Boolean(game.href);

  function open() {
    if (!playable) return;
    // D-078: a cabinet with room copy opens its room first; the room then
    // steps inside to the machine. Entries without a room fall back to href.
    const target = game.about ? `/arcade/${game.id}` : game.href;
    if (!target) return;
    if (reduced) {
      router.push(target);
      return;
    }
    setClicking(true);
    window.setTimeout(() => router.push(target), 450);
  }

  // dark cabinets rise first on a short stagger; the lit one has its own
  // later delays baked into its class so it ignites last (D-050).
  const style = hero ? undefined : { animationDelay: `${0.35 + index * 0.12}s` };

  const body = (
    <>
      <div className="gm-cabMarquee">{game.name}</div>
      <div className="gm-cabScreenWell">
        <div className="gm-cabScreen">
          {playable ? (
            <Watcher mood="calm" width={hero ? 116 : 58} />
          ) : game.glyph ? (
            <span className="gm-cabGlyph">
              <Glyph name={game.glyph} active={hovered && !reduced} />
            </span>
          ) : null}
        </div>
      </div>
      <div className="gm-cabDeck" aria-hidden="true">
        <span className="gm-cabDot" />
        <span className="gm-cabDots">
          <span className="gm-cabDotSmall" />
          <span className="gm-cabDotSmall" />
        </span>
      </div>
      <div className="gm-cabPlate">
        <p className="gm-cabTeach">{game.teach}</p>
        <p className="gm-cabStatus">{playable ? "ready to play" : "coming soon"}</p>
      </div>
    </>
  );

  if (playable) {
    return (
      <button
        type="button"
        className="gm-cab"
        data-lit="true"
        data-clicking={clicking ? "true" : undefined}
        onClick={open}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={`${game.name}. ${game.teach} Step into its room.`}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className="gm-cab"
      data-lit="false"
      role="group"
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`${game.name}. ${game.teach} Coming soon.`}
    >
      {body}
    </div>
  );
}
