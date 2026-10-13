import "./game/game.css";

/**
 * The Crowd's character (D-078): three hooded figures standing close, grown
 * from the hood shape the game itself uses on its record rows. The middle
 * one holds a closed book: the record book, sealed until the stranger reads
 * it. No gold anywhere in the figure, because nothing here is public yet;
 * the eyes are cool shadow dots, the house colour for sealed.
 *
 * One slow float on the middle figure is the whole motion budget, and the
 * global less-motion rule stills it like every other loop.
 */
export function CrowdFigure({ width = 220 }: { width?: number }) {
  return (
    <div className="gm-roomFigureBox" style={{ width }}>
      <svg
        viewBox="0 0 224 260"
        role="img"
        aria-label="The Crowd. Three hooded figures stand close together, and the middle one holds a closed book. What they carry is sealed."
      >
        <defs>
          <linearGradient id="cfCloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2438" />
            <stop offset="100%" stopColor="#1c1728" />
          </linearGradient>
        </defs>

        <ellipse cx="112" cy="248" rx="86" ry="9" fill="#0c0a11" opacity="0.55" />

        {/* left hood, a half step behind and a half head lower, so each
            silhouette reads as its own figure in the crowd */}
        <g opacity="0.8" transform="translate(-14 16)">
          <path
            d="M62 96c-20 0-31 16-33 40-2 26-6 56-10 82-1 8 4 14 12 15 10 2 21 3 31 3s21-1 31-3c8-1 13-7 12-15-4-26-8-56-10-82-2-24-13-40-33-40Z"
            fill="url(#cfCloak)"
            stroke="rgba(255,255,255,0.06)"
          />
          <path d="M62 112c-12 0-19 9-20 21-1 11 5 18 20 18s21-7 20-18c-1-12-8-21-20-21Z" fill="#0e0b14" />
          <circle cx="64" cy="133" r="4" fill="#a89fc4" opacity="0.35" />
        </g>

        {/* right hood, a half step behind and a half head lower */}
        <g opacity="0.8" transform="translate(14 16)">
          <path
            d="M162 96c-20 0-31 16-33 40-2 26-6 56-10 82-1 8 4 14 12 15 10 2 21 3 31 3s21-1 31-3c8-1 13-7 12-15-4-26-8-56-10-82-2-24-13-40-33-40Z"
            fill="url(#cfCloak)"
            stroke="rgba(255,255,255,0.06)"
          />
          <path d="M162 112c-12 0-19 9-20 21-1 11 5 18 20 18s21-7 20-18c-1-12-8-21-20-21Z" fill="#0e0b14" />
          <circle cx="164" cy="133" r="4" fill="#a89fc4" opacity="0.35" />
        </g>

        {/* middle hood, a half step forward, holding the closed book */}
        <g className="gm-cfFloat">
          <path
            d="M112 52c-26 0-40 20-42 48-2 30-7 62-12 90-2 9 4 16 13 17 13 2 27 3 41 3s28-1 41-3c9-1 15-8 13-17-5-28-10-60-12-90-2-28-16-48-42-48Z"
            fill="url(#cfCloak)"
            stroke="rgba(255,255,255,0.08)"
          />
          <path d="M112 72c-15 0-24 11-25 26-1 14 6 23 25 23s26-9 25-23c-1-15-10-26-25-26Z" fill="#0e0b14" />
          <circle cx="115" cy="98" r="5" fill="#a89fc4" opacity="0.45" />
          {/* the closed book: cover, spine at the left, one clasp. No grid,
              so it never reads as a window. */}
          <path d="M92 168h40l4 34H88l4-34Z" fill="#241f2f" stroke="#3a3446" strokeWidth="2" />
          <path d="M97 169l-2 32" stroke="#3a3446" strokeWidth="2" />
          <path d="M131 183h7" stroke="#4a4258" strokeWidth="2.5" />
        </g>
      </svg>
    </div>
  );
}
