"use client";

import "./game/game.css";

export type WatcherMood = "calm" | "alert" | "blind";

/**
 * The Watcher — "the public" as a character (STYLEGUIDE cast, D-010/D-015),
 * drawn exactly as the owner approved it in the sample (D-044): a hooded
 * sentinel with one gold eye and a lantern on its arm. The lantern is its job
 * made visible. It lights what the public can read.
 *
 *   calm  -> it idles and watches (float, blink, pupil drift, flame, motes).
 *   alert -> it just read a payment that was not hidden: it leans toward the
 *            record, the lantern flares, the eye widens.
 *   blind -> you hid the payment, so it sees nothing: it recoils, the lid
 *            shuts, the lantern dims.
 *
 * Every loop is a CSS animation on a class, and every mood is a data attribute,
 * so the whole character is one SVG plus the stylesheet (game.css). It never
 * judges with colour; it only watches and lights.
 *
 * The idle loops are the DELIBERATE documented exception (Layer 2 rule 1,
 * D-014): the public never stops watching the transparent chain. Motion level
 * comes from the page's motion preference (D-045, D-051) through
 * html[data-motion]; under "less" every loop stops and moods simply change.
 */
export function Watcher({
  mood = "calm",
  width,
  className = "",
}: {
  mood?: WatcherMood;
  /** Wrapper width in px. Defaults to the stylesheet's 148px. */
  width?: number;
  className?: string;
}) {
  return (
    <div
      className={"gm-watcher " + className}
      data-mood={mood}
      style={width ? { width } : undefined}
    >
      <svg
        viewBox="0 0 224 260"
        role="img"
        aria-label={`The Watcher. It stands for everyone who can see the public record of payments. Right now it is ${
          mood === "alert"
            ? "alert: it just read a payment that was not hidden, and its lantern is lit"
            : mood === "blind"
              ? "blind: you hid the payment, so it sees nothing and its lantern is dim"
              : "calm: watching for payments it can read"
        }`}
      >
        <defs>
          <radialGradient id="gmGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#edb64a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gmCloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2438" />
            <stop offset="100%" stopColor="#1c1728" />
          </linearGradient>
          <radialGradient id="gmIris" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#ffe3a3" />
            <stop offset="55%" stopColor="#edb64a" />
            <stop offset="100%" stopColor="#b9862f" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="248" rx="62" ry="9" fill="#0c0a11" opacity="0.55" />

        <g className="gm-wFloat">
          <circle className="gm-wGlow" cx="169" cy="166" r="52" fill="url(#gmGlow)" />

          {/* cloak */}
          <path
            d="M100 26c-34 0-52 26-55 62-3 34-9 74-16 108-2 9 4 16 13 17 19 3 39 4 58 4s39-1 58-4c9-1 15-8 13-17-7-34-13-74-16-108-3-36-21-62-55-62Z"
            fill="url(#gmCloak)"
            stroke="rgba(255,255,255,0.07)"
          />
          {/* rim light from its own lantern, on the side facing the record */}
          <path
            className="gm-wRim"
            d="M148 52c10 18 12 46 8 78-3 26-8 54-13 78"
            fill="none"
            stroke="#edb64a"
            strokeOpacity="0.35"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* hood void + single gold eye */}
          <path
            d="M100 46c-20 0-32 14-33 34-1 18 8 30 33 30s34-12 33-30c-1-20-13-34-33-34Z"
            fill="#0e0b14"
          />
          <g className="gm-wEye">
            <circle cx="104" cy="80" r="13.5" fill="url(#gmIris)" />
            <circle className="gm-wPupil" cx="107.5" cy="80" r="5.4" fill="#14101a" />
            <circle cx="100" cy="75" r="2.4" fill="#ffffff" opacity="0.85" />
          </g>
          {/* lid: shuts when the payment is hidden. Drawn with the hood's own
              curve (D-053) so a closed hood reads as dark and empty, never as
              a square box pasted on the face. */}
          <path
            className="gm-wLid"
            d="M100 46c-20 0-32 14-33 34-1 18 8 30 33 30s34-12 33-30c-1-20-13-34-33-34Z"
            fill="#0e0b14"
          />

          {/* arm + lantern */}
          <path
            d="M140 140c10 2 18 6 24 12"
            fill="none"
            stroke="#3a3446"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path d="M164 148h10l1 6h-12l1-6Z" fill="#4a4258" />
          <path
            d="M160 154h18l-3 26h-12l-3-26Z"
            fill="#241f2f"
            stroke="#4a4258"
            strokeWidth="1.5"
          />
          <rect x="163" y="157" width="12" height="20" rx="2" fill="#ffcf6e" opacity="0.12" />
          <ellipse className="gm-wFlame" cx="169" cy="168" rx="4" ry="6.5" fill="#ffcf6e" />

          {/* two motes in the lantern light */}
          <circle className="gm-wMote1" cx="150" cy="128" r="1.6" fill="#edb64a" />
          <circle className="gm-wMote2" cx="182" cy="122" r="1.2" fill="#edb64a" />
        </g>
      </svg>
    </div>
  );
}

/**
 * The crowd of watchers (D-079): four hooded figures standing together,
 * because on The Crowd the public is never one person. Same cloak, same
 * single gold eye, same blink and flame classes as the Watcher, so the
 * crowd moves in the house motion vocabulary and stills under the global
 * less-motion rule. One lantern for the whole crowd: they share one record
 * book to read. Drawn back to front so the overlap reads as depth at the
 * small cabinet size.
 */
export function WatcherCrowd({ width = 58 }: { width?: number }) {
  const eye = (delay: string) => (
    <g className="gm-wEye" style={{ animationDelay: delay }}>
      <circle cx="2" cy="36" r="6" fill="url(#cwIris)" />
      <circle className="gm-wPupil" cx="3.6" cy="36" r="2.4" fill="#14101a" />
      <circle cx="0.4" cy="33.6" r="1.1" fill="#ffffff" opacity="0.85" />
    </g>
  );
  const hood = (
    <>
      <path
        d="M0 0c-19 0-30 14-32 38-2 23-6 42-9 59-1 7 3 12 10 13 10 2 20 3 31 3s21-1 31-3c7-1 11-6 10-13-3-17-7-36-9-59-2-24-13-38-32-38Z"
        fill="url(#cwCloak)"
        stroke="rgba(255,255,255,0.07)"
      />
      <path d="M0 16c-12 0-19 8-20 20-1 11 5 18 20 18s21-7 20-18c-1-12-8-20-20-20Z" fill="#0e0b14" />
    </>
  );

  return (
    <div className="gm-watcher" style={{ width }}>
      <svg
        viewBox="12 126 200 132"
        role="img"
        aria-label="The crowd of watchers. Four hooded figures stand together, each with one gold eye, and the front one carries the lantern. Here the public is never one person."
      >
        <defs>
          <linearGradient id="cwCloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2438" />
            <stop offset="100%" stopColor="#1c1728" />
          </linearGradient>
          <radialGradient id="cwIris" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#ffe3a3" />
            <stop offset="55%" stopColor="#edb64a" />
            <stop offset="100%" stopColor="#b9862f" />
          </radialGradient>
          <radialGradient id="cwGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#edb64a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="112" cy="248" rx="70" ry="8" fill="#0c0a11" opacity="0.55" />

        <g className="gm-wFloat">
          <circle className="gm-wGlow" cx="176" cy="196" r="44" fill="url(#cwGlow)" />

          {/* two watchers a row back */}
          <g transform="translate(56 158) scale(0.74)" opacity="0.75">
            {hood}
            {eye("0.9s")}
          </g>
          <g transform="translate(168 158) scale(0.74)" opacity="0.75">
            {hood}
            {eye("2.1s")}
          </g>

          {/* one watcher half a step back */}
          <g transform="translate(90 146) scale(0.86)" opacity="0.9">
            {hood}
            {eye("3.4s")}
          </g>

          {/* the front watcher, carrying the lantern for all four */}
          <g transform="translate(134 134)">
            {hood}
            {eye("0s")}
            <path d="M24 74c8 2 14 5 19 10" fill="none" stroke="#3a3446" strokeWidth="4" strokeLinecap="round" />
            <path d="M42 80h8l1 5h-10l1-5Z" fill="#4a4258" />
            <path d="M39 85h14l-2 20h-10l-2-20Z" fill="#241f2f" stroke="#4a4258" strokeWidth="1.5" />
            <ellipse className="gm-wFlame" cx="46" cy="96" rx="3.2" ry="5" fill="#ffcf6e" />
          </g>
        </g>
      </svg>
    </div>
  );
}
