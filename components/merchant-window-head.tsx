import "./game/game.css";

/**
 * The Merchant's Window, cabinet four's head image (owner's yes 2026-10-27).
 * The padlock is cabinet three's piece. This cabinet's own piece is the shop
 * window it is named for: one gold receipt row, one sealed row, and the
 * viewing key resting on the sill. All three are props already in the room,
 * so the hub invents nothing. The idle loop is the lamp breathing and the
 * gold row brightening; the global "less" rule stills both.
 */
export function MerchantWindowHead({ width = 148 }: { width?: number }) {
  return (
    <div className="gm-merchantHead" style={{ width }}>
      <svg
        viewBox="0 0 224 190"
        role="img"
        aria-label="A lit shop window at night. One gold receipt line shows behind the glass, one line stays sealed, and a brass key rests on the sill."
      >
        <defs>
          <radialGradient id="mwHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.18" />
            <stop offset="55%" stopColor="#edb64a" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mwWood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2f44" />
            <stop offset="100%" stopColor="#1c1728" />
          </linearGradient>
          <linearGradient id="mwGlass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a2b2a" />
            <stop offset="55%" stopColor="#241b26" />
            <stop offset="100%" stopColor="#17121f" />
          </linearGradient>
          <radialGradient id="mwWarm" cx="50%" cy="58%" r="68%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.48" />
            <stop offset="48%" stopColor="#edb64a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mwInner" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#ffcf6e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="mwBrass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2d795" />
            <stop offset="42%" stopColor="#d3a44a" />
            <stop offset="100%" stopColor="#8a6420" />
          </linearGradient>
          <linearGradient id="mwPaper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f0e5cb" />
            <stop offset="100%" stopColor="#d8c8a5" />
          </linearGradient>
        </defs>

        <ellipse cx="112" cy="96" rx="108" ry="86" fill="url(#mwHalo)" />
        <ellipse cx="112" cy="181" rx="86" ry="7" fill="#0c0a11" opacity="0.55" />

        {/* the window frame */}
        <rect
          x="22"
          y="14"
          width="180"
          height="142"
          rx="8"
          fill="url(#mwWood)"
          stroke="rgba(255,255,255,0.07)"
        />
        <path
          d="M30 18h164"
          stroke="#edb64a"
          strokeOpacity="0.28"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* glass, warm from the lamp inside */}
        <rect x="32" y="24" width="160" height="122" rx="3" fill="url(#mwGlass)" />
        <rect
          className="gm-mwLamp"
          x="32"
          y="24"
          width="160"
          height="122"
          rx="3"
          fill="url(#mwWarm)"
        />
        <path d="M40 30h24L40 54Z" fill="#ffffff" opacity="0.035" />
        <path d="M124 30h18L124 48Z" fill="#ffffff" opacity="0.025" />
        <circle cx="154" cy="58" r="36" fill="url(#mwInner)" />

        {/* mullions, with a faint brass edge where the light catches them */}
        <rect x="110" y="24" width="4" height="122" fill="#2b2438" />
        <rect x="32" y="82" width="160" height="4" fill="#2b2438" />
        <path d="M32 24h160v122H32z" fill="none" stroke="#edb64a" strokeOpacity="0.14" />
        <path d="M112 24v122M32 84h160" stroke="#edb64a" strokeOpacity="0.1" />

        {/* the record behind the glass: one row proved, one still sealed */}
        <g transform="rotate(-2 71 115)">
          <rect x="44" y="94" width="54" height="42" rx="2" fill="url(#mwPaper)" opacity="0.95" />
          <rect x="44" y="94" width="54" height="3" rx="1.5" fill="#ffffff" opacity="0.35" />
          <circle cx="71" cy="98" r="1.6" fill="#b9862f" />
          <rect className="gm-mwRow" x="50" y="105" width="40" height="4" rx="2" fill="#d3a44a" />
          <rect x="50" y="105" width="40" height="1.4" rx="0.7" fill="#ffe3a3" opacity="0.8" />
          <rect x="50" y="115" width="30" height="3" rx="1.5" fill="#a89fc4" opacity="0.45" />
          <circle
            cx="86"
            cy="116.5"
            r="3.2"
            fill="none"
            stroke="#a89fc4"
            strokeOpacity="0.55"
            strokeWidth="1.1"
          />
          <circle cx="86" cy="116.5" r="1" fill="#a89fc4" opacity="0.5" />
        </g>

        {/* the sill and the viewing key, not in a lock */}
        <rect
          x="10"
          y="152"
          width="204"
          height="14"
          rx="3"
          fill="url(#mwWood)"
          stroke="rgba(255,255,255,0.06)"
        />
        <path
          d="M18 153h188"
          stroke="#edb64a"
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        <ellipse cx="172" cy="163.5" rx="26" ry="2.4" fill="#0c0a11" opacity="0.45" />
        <g transform="translate(150 158) rotate(6)" fill="url(#mwBrass)" stroke="url(#mwBrass)">
          <circle cx="0" cy="0" r="8" fill="none" strokeWidth="4.5" />
          <circle
            cx="0"
            cy="0"
            r="8"
            fill="none"
            stroke="#fff0c4"
            strokeOpacity="0.28"
            strokeWidth="0.8"
          />
          <rect x="7" y="-2" width="40" height="4" rx="2" stroke="none" />
          <path d="M35 2h5v7h-5zM42 2h4v4h-4z" stroke="none" />
          <rect
            x="10"
            y="-1"
            width="33"
            height="1.2"
            rx="0.6"
            fill="#fff0c4"
            opacity="0.3"
            stroke="none"
          />
        </g>
      </svg>
    </div>
  );
}
