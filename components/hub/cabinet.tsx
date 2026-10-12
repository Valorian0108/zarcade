"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  motion,
  useAnimationControls,
  useReducedMotion,
} from "motion/react";
import { Watcher } from "@/components/watcher";
import { Glyph } from "./glyphs";
import type { GameEntry } from "@/lib/games";

/**
 * One arcade cabinet (D-019). The whole page is "one lit cabinet in a dark
 * room": the FIRST playable game is the hero (big, screen on, Watcher alive,
 * gold marquee, static light pool). Everything else is a dark cabinet (screen
 * off, faint custom glyph, "coming soon", not clickable, so no dead links).
 *
 * Motion budget (Layer 2 / D-014):
 *  - hover/focus = 1px lift + name brightens, 140ms (controls tier).
 *  - dark glyph = ONE tiny cursor tease, 160ms (the "customized cursor
 *    movement" the owner asked for).
 *  - hero powers on once on load = the page's single choreographed moment.
 *  - click a lit cabinet = a short power-on beat, then navigate.
 * Under prefers-reduced-motion every one of these collapses to a still,
 * color-only state change and navigation is immediate.
 */

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// Rim + spill for the one lit cabinet. Static (no motion), token-mixed.
const HERO_GLOW =
  "0 0 0 1px color-mix(in oklch, var(--primary) 32%, transparent), " +
  "0 10px 44px -14px color-mix(in oklch, var(--primary) 55%, transparent)";

export function Cabinet({
  game,
  hero = false,
}: {
  game: GameEntry;
  hero?: boolean;
}) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [hover, setHover] = useState(false);

  const playable = game.status === "playable";
  // The glyph tease only fires on hover AND when motion is allowed.
  const tease = hover && !reduced;

  // Two imperative flares so re-renders (hover) never re-trigger them.
  const loadFlare = useAnimationControls();
  const clickFlare = useAnimationControls();

  // Power on once when the lit cabinet first appears.
  useEffect(() => {
    if (hero && !reduced) {
      loadFlare.start({
        opacity: [0, 0.2, 0],
        transition: { duration: 0.8, times: [0, 0.35, 1], ease: EASE_OUT },
      });
    }
  }, [hero, reduced, loadFlare]);

  async function open() {
    if (!playable || !game.href) return;
    if (reduced) {
      router.push(game.href);
      return;
    }
    // Power-on beat, then go.
    await clickFlare.start({
      opacity: [0, 0.35, 0],
      transition: { duration: 0.45, times: [0, 0.3, 1], ease: EASE_OUT },
    });
    router.push(game.href);
  }

  const shell =
    "relative flex w-full flex-col overflow-hidden rounded-xl border bg-secondary " +
    "transition-colors duration-150 " +
    (playable
      ? "cursor-pointer border-primary/35 text-left outline-none hover:border-primary/55 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      : "border-border hover:border-muted-foreground/30");

  const body = (
    <>
      {/* marquee / nameplate */}
      <div
        className={
          "border-b px-3 py-2 text-center font-display font-semibold tracking-tight " +
          (playable
            ? "border-primary/25 bg-primary/12 text-primary"
            : "border-border bg-muted text-muted-foreground")
        }
      >
        <span
          className={
            "transition-colors duration-150 " +
            (hero ? "text-lg" : "text-sm") +
            (!playable && hover ? " text-foreground" : "")
          }
        >
          {game.name}
        </span>
      </div>

      {/* screen well */}
      <div className="p-3">
        <div
          className={
            "relative flex items-center justify-center overflow-hidden rounded-md border border-border bg-background " +
            (hero ? "h-40" : "h-20")
          }
        >
          {playable ? (
            <Watcher
              mood="calm"
              className={hero ? "h-32 w-auto" : "h-16 w-auto"}
            />
          ) : game.glyph ? (
            <div
              className={
                "transition-colors duration-150 " +
                (tease ? "text-muted-foreground" : "text-muted-foreground/30")
              }
            >
              <Glyph name={game.glyph} active={tease} />
            </div>
          ) : null}

          {/* power-on flares (lit cabinet only) */}
          {playable && !reduced && (
            <>
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-primary"
                style={{ opacity: 0 }}
                animate={loadFlare}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-primary"
                style={{ opacity: 0 }}
                animate={clickFlare}
              />
            </>
          )}
        </div>
      </div>

      {/* control deck */}
      <div className="flex items-center justify-between px-4 pb-3">
        <span
          className={
            "size-3 rounded-full border " +
            (playable ? "border-primary/50 bg-primary/20" : "border-border")
          }
        />
        <span className="flex gap-1.5">
          <span
            className={
              "size-2 rounded-full " +
              (playable ? "bg-primary/45" : "bg-border")
            }
          />
          <span
            className={
              "size-2 rounded-full " +
              (playable ? "bg-primary/45" : "bg-border")
            }
          />
        </span>
      </div>

      {/* info plate: teach line always visible + status */}
      <div className="mt-auto border-t border-border/70 px-3 py-2.5">
        <p
          className={
            "text-sm leading-6 " +
            (playable ? "text-foreground" : "text-muted-foreground")
          }
        >
          {game.teach}
        </p>
        <p
          className={
            "mt-1.5 text-xs font-medium " +
            (playable ? "text-valid" : "text-muted-foreground")
          }
        >
          {playable ? "ready to play" : "coming soon"}
        </p>
      </div>
    </>
  );

  const lift = { y: hover && !reduced ? -1 : 0 };
  const liftT = { duration: 0.14, ease: EASE_OUT };

  if (playable) {
    return (
      <motion.button
        type="button"
        onClick={open}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        initial={false}
        animate={lift}
        transition={liftT}
        style={hero ? { boxShadow: HERO_GLOW } : undefined}
        className={shell}
        aria-label={`${game.name}. ${game.teach} Ready to play.`}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <motion.div
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      initial={false}
      animate={lift}
      transition={liftT}
      className={shell}
      role="group"
      aria-label={`${game.name}. ${game.teach} Coming soon.`}
    >
      {body}
    </motion.div>
  );
}
