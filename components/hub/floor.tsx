"use client";

import Link from "next/link";
import { MotionToggle } from "@/components/motion-pref";
import { Cabinet } from "./cabinet";
import { splitGames } from "@/lib/games";

/**
 * The arcade floor (D-050): the second room, after the door has said what the
 * place is. Same D-019 truth as before, restyled into the Layer 5 system: ONE
 * lit cabinet (the first playable game) stands bigger on the left; the rest
 * are dark and quiet on the right. The layout stays asymmetric on purpose
 * (slop gate: no uniform tile rows) and stays entirely data-driven from
 * lib/games.ts, so lighting up the next game is a config flip, not a
 * redesign.
 *
 * The mount choreography (game.css .gm-cab): dark cabinets fade in on a short
 * stagger, the lit one rises last, ignites, then holds a slow attract pulse.
 * The wordmark links back to the door. The honest line under the row says
 * what is and is not here.
 */
export function Floor() {
  const { hero, rest } = splitGames();

  return (
    <div className="gm-root gm-floor">
      <header className="gm-marquee">
        <div className="gm-brand">
          <Link className="gm-wordmark gm-wordmarkLink" href="/">
            ZARCADE
          </Link>
          <span className="gm-brandDiv" aria-hidden="true" />
          <span className="gm-gameName">The arcade floor</span>
        </div>
        <div className="gm-marqueeRight">
          <MotionToggle />
        </div>
      </header>

      <main>
        <div className="gm-floorHead">
          <p className="gm-eyebrow">Pick a machine</p>
          <h1 className="gm-floorTitle">Each game teaches one way Zcash keeps payments private.</h1>
        </div>

        <div className="gm-floorRoom">
          {hero ? <Cabinet game={hero} hero /> : null}
          <div className="gm-floorRest">
            {rest.map((game, i) => (
              <Cabinet key={game.id} game={game} index={i} />
            ))}
          </div>
        </div>

        <p className="gm-floorNote">One machine is live. The others come later.</p>
      </main>
    </div>
  );
}
