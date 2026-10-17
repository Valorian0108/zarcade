import "./game/game.css";

/**
 * The key and the lock — cabinet three's head image (owner's playtest,
 * 2026-10-17: "the game is called proof of puzzle, this shouldnt be the
 * head image... it should just be a key attached to a lock using the same
 * colors as the watcher").
 *
 * It borrows the Watcher's own palette so it belongs to the same house:
 * the cloak gradient for the body, the hood void for the keyhole, the two
 * golds for the shackle, the key and the glow. The one idle loop is the
 * whole story in four beats: the key turns in the keyhole, the shackle
 * swings open on its left leg, it holds open, then both come home and the
 * lock closes again. Transform only (Layer 2 / slop gate), and the global
 * less-motion rule stills it like every other loop in the house.
 */
export function KeyLock({ width = 148 }: { width?: number }) {
  return (
    <div className="gm-keylock" style={{ width }}>
      <svg
        viewBox="0 0 224 260"
        role="img"
        aria-label="A padlock in the Watcher's colours with its key in the keyhole. The key turns and the lock opens, then closes again."
      >
        <defs>
          <radialGradient id="klGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.4" />
            <stop offset="45%" stopColor="#edb64a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="klCloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2438" />
            <stop offset="100%" stopColor="#1c1728" />
          </linearGradient>
        </defs>

        <ellipse cx="112" cy="248" rx="62" ry="9" fill="#0c0a11" opacity="0.55" />

        <g className="gm-klFloat">
          <circle className="gm-klGlow" cx="112" cy="150" r="80" fill="url(#klGlow)" />

          {/* shackle: gold, opens by swinging on its left leg */}
          <path
            className="gm-klShackle"
            d="M88 132v-26a24 24 0 0 1 48 0v26"
            fill="none"
            stroke="#edb64a"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* body: the cloak, cut into a lock */}
          <rect
            x="70"
            y="130"
            width="84"
            height="80"
            rx="16"
            fill="url(#klCloak)"
            stroke="rgba(255,255,255,0.07)"
          />
          {/* rim light, the same gold the Watcher's lantern leaves on him */}
          <path
            d="M146 144c4 15 4 37 0 52"
            fill="none"
            stroke="#edb64a"
            strokeOpacity="0.35"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* keyhole: the hood void */}
          <circle cx="112" cy="162" r="10" fill="#0e0b14" />
          <path d="M107 168h10l3 18h-16z" fill="#0e0b14" />

          {/* the key, in the keyhole, turning */}
          <g className="gm-klKey">
            <path
              d="M112 162l22 22"
              fill="none"
              stroke="#ffcf6e"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="140" cy="190" r="11" fill="none" stroke="#ffcf6e" strokeWidth="6" />
          </g>
        </g>
      </svg>
    </div>
  );
}
