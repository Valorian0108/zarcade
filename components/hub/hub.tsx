"use client";

import { Cabinet } from "./cabinet";
import { splitGames } from "@/lib/games";

/**
 * The hub (D-019): a small arcade room. The sign says what to do in plain
 * words. Below it, ONE lit cabinet (the first playable game) stands bigger on
 * the left; the rest are dark and quiet on the right. The layout is
 * asymmetric on purpose (slop gate: no uniform tile rows) and it is entirely
 * data-driven from lib/games.ts, so lighting up the next game is a config
 * flip, not a redesign.
 *
 * The only living thing here is the Watcher on the lit cabinet's screen (the
 * page's "one living star"). The gold bloom and the floor pool are static.
 */
export function Hub() {
  const { hero, rest } = splitGames();

  return (
    <main className="relative flex-1 w-full">
      {/* atmosphere: one static gold bloom, token-mixed (Layer 3) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(52rem 34rem at 24% 26%, color-mix(in oklch, var(--primary) 7%, transparent), transparent 62%)",
        }}
      />

      <div className="mx-auto w-full max-w-5xl px-6 py-14 md:py-20">
        {/* the sign */}
        <header className="mb-10 space-y-2 md:mb-12">
          <p className="font-display text-sm font-semibold tracking-tight text-primary">
            Zarcade
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Pick a game and learn by playing.
          </h1>
          <p className="max-w-prose leading-7 text-muted-foreground">
            Each game shows one way Zcash keeps payments private. No reading
            required.
          </p>
        </header>

        {/* the room: one lit cabinet + the rest */}
        <div className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,2fr)] md:items-start">
          {hero && (
            <div className="relative">
              {/* static light pool on the floor under the lit cabinet */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-7 left-1/2 h-16 w-4/5 -translate-x-1/2 rounded-[50%] blur-md"
                style={{
                  background:
                    "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 22%, transparent), transparent)",
                }}
              />
              <Cabinet game={hero} hero />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {rest.map((game) => (
              <Cabinet key={game.id} game={game} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
