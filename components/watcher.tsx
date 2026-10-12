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
