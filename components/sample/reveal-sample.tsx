"use client";

/**
 * THROWAWAY DESIGN SAMPLE (owner review only, D-042/D-043 era).
 *
 * One static moment of the redesigned Unseen: round 2, just after the open
 * payment landed, at the reveal. No game logic, no API calls, no money. The
 * transaction facts shown are real ones from earlier testing so the explorer
 * link works and the honesty line holds even in a mockup.
 *
 * The visual system demonstrated here is derived from BRIEF.md:
 *   - gold light falls on what the public can read; sealed things stay in cool
 *     shadow. No red, no green, no verdict colours.
 *   - two panels, two perspectives (you / the stranger); the Watcher sits on
 *     the divider and reacts instead of a colour judging the player.
 *   - the reveal is staged as the climax: shutters slide, the lantern flares,
 *     the twist line lands last.
 *   - reduced motion: the final state renders immediately, lesson intact.
 */

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * This project's Turbopack rule sends every *.css file through
 * @tailwindcss/turbopack with `as: "*.css"`, which disables CSS-module
 * scoping (classes arrive unhashed and the default export is empty). So the
 * sample uses one global stylesheet (app/sample/reveal-sample.css) where every
 * class is prefixed `smp-`, and this map turns styles.foo into "smp-foo".
 */
const styles: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, key) {
    return typeof key === "string" ? `smp-${key}` : undefined;
  },
});

/** Real facts from the round-2 test payment (block 4490872). */
const TXID = "79a70a363d16b50d1ccab659b8efb3af1e6858c515a37497651d06f886e2177f";
const EXPLORER_URL = `https://testnet.zecblock.com/tx/${TXID}`;
const BLOCK = "4490872";

type RowKind = "sealed" | "lit" | "none";

type Row = {
  label: string;
  kind: RowKind;
  tag: string;
  /** On-chain data, shown in mono. Only for lit rows. */
  value?: string;
  /** What the sealed bar says, for the sealed row. */
  sealText?: string;
  sub: string;
};

/** Same four things the real game tracks (LEAK_PARTS in lib/unseen.ts). */
const ROWS: readonly Row[] = [
  {
    label: "who paid",
    kind: "sealed",
    tag: "Sealed",
    sealText: "Sealed by the private pool",
    sub: "The coins came out of the private pool. The pool never says which of its users they came from.",
  },
  {
    label: "who got paid",
    kind: "lit",
    tag: "On the public list",
    value: "tmXbq7gh…Hjt3Kfub",
    sub: "An address the arcade itself owns. The transaction carries the full address.",
  },
  {
    label: "how much",
    kind: "lit",
    tag: "On the public list",
    value: "0.00001 TAZ",
    sub: "1,000 zatoshis. A tiny amount, but the number itself is public.",
  },
  {
    label: "the note",
    kind: "none",
    tag: "Nothing exists",
    sub: "Open payments cannot carry a note, so there is nothing here to see.",
  },
];

/** When each row's shutter slides (ms from run start), and when the twist lands. */
const SCHEDULE_MS = [700, 1500, 2200, 2800];
const TWIST_AT_MS = 3500;

export function RevealSample() {
  const reduced = useReducedMotion();
  const [runId, setRunId] = useState(0);
  /** -1 = every shutter down. Row i is open once step >= i. */
  const [step, setStep] = useState(-1);
  const [twist, setTwist] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timers = SCHEDULE_MS.map((ms, i) => window.setTimeout(() => setStep(i), ms));
    timers.push(window.setTimeout(() => setTwist(true), TWIST_AT_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [runId, reduced]);

  const open = (i: number) => reduced === true || step >= i;
  const twistOn = reduced === true || twist;
  /** The lantern wakes when the record starts lighting up. */
  const flare = reduced === true || step >= 1;

  const replay = () => {
    setStep(-1);
    setTwist(false);
    setRunId((r) => r + 1);
  };

  return (
    <div className={styles.root}>
      <p className={styles.banner}>
        Design sample for the owner. Nothing was sent to make this page. The transaction shown is a
        real one from earlier testing, and the explorer link opens the real record.
      </p>

      <header className={styles.marquee}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>ZARCADE</span>
          <span className={styles.brandDiv} aria-hidden="true" />
          <span className={styles.gameName}>Unseen</span>
        </div>
        <div className={styles.roundChip}>
          <span>Round 2 of 3</span>
          <span className={styles.chipDiv} aria-hidden="true" />
          <span className={styles.roundTitle}>Prove you paid</span>
        </div>
      </header>

      <main className={styles.stage}>
        <section className={styles.panel} aria-label="Your side">
          <p className={styles.eyebrow}>Your side</p>
          <div className={styles.goalCard}>
            <p className={styles.goalLabel}>The round asked</p>
            <p className={styles.goalText}>
              A stranger can find this payment on the public list and read where it went and how
              much.
            </p>
          </div>
          <p className={styles.amountLabel}>You sent</p>
          <p className={styles.amount}>
            0.00001 <span className={styles.amountUnit}>TAZ</span>
          </p>
          <p className={styles.amountSub}>
            A tiny practice amount (1,000 zatoshis), sent for real on the Zcash test network.
          </p>
          <div className={styles.callNote}>
            <span className={styles.callRule} aria-hidden="true" />
            <div className={styles.callBody}>
              <p className={styles.callLabel}>Your call</p>
              <p className={styles.callChoice}>
                <SealGlyph open />
                You left it <span className={styles.litWord}>open</span>
              </p>
              <p className={styles.callSub}>That is exactly what this round asked for.</p>
            </div>
          </div>
        </section>

        <div className={styles.hinge}>
          <span className={styles.hingeLine} aria-hidden="true" />
          <Watcher flare={flare} />
        </div>

        <section className={`${styles.panel} ${styles.publicPanel}`} aria-label="What a stranger can see">
          <p className={styles.eyebrow}>What a stranger can see</p>
          <ul className={styles.rows}>
            {ROWS.map((row, i) => (
              <li
                key={row.label}
                className={styles.row}
                data-state={open(i) ? row.kind : "covered"}
              >
                <div className={styles.rowHead}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <span className={styles.rowTag} data-on={open(i)}>
                    {row.tag}
                  </span>
                </div>
                <div className={styles.rowBody}>
                  {row.sealText ? (
                    <span className={styles.sealBar}>
                      <LockGlyph size={13} /> {row.sealText}
                    </span>
                  ) : null}
                  {row.value ? <span className={styles.rowValue}>{row.value}</span> : null}
                  <span className={styles.rowSub}>{row.sub}</span>
                  <div className={styles.cover} aria-hidden="true">
                    <span className={styles.coverSeam} />
                    <LockGlyph size={16} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.readout}>
            <div className={styles.pips} aria-hidden="true">
              {ROWS.map((row, i) => (
                <span
                  key={row.label}
                  className={styles.pip}
                  data-lit={open(i) && row.kind === "lit"}
                />
              ))}
            </div>
            <p className={styles.readoutText}>
              The public learned <strong>2 of 4</strong> things.
            </p>
          </div>
          <div className={styles.receipt}>
            <span className={styles.mono}>
              {TXID.slice(0, 8)}…{TXID.slice(-8)}
            </span>
            <span className={styles.receiptDot} aria-hidden="true" />
            <span>Block {BLOCK}</span>
            <a
              className={styles.receiptLink}
              href={EXPLORER_URL}
              target="_blank"
              rel="noreferrer"
            >
              Check it on the explorer
            </a>
          </div>
        </section>
      </main>

      <section className={styles.caption} aria-label="What this round taught">
        <h2 className={styles.twist} data-on={twistOn}>
          You paid <span className={styles.litWord}>in the open</span>.
          <br />
          The record still does not say <span className={styles.shadowWord}>who paid</span>.
        </h2>
        <p className={styles.teach} data-on={twistOn}>
          You left it open on purpose, and that was the right call. Going open put two things on the
          public list for good: where the money went and how much. It did not put your name there.
          The coins came out of the private pool, and the pool never says which of its users they
          came from.
        </p>
      </section>

      <footer className={styles.actions}>
        <button type="button" className={styles.btnPrimary}>
          Next round
        </button>
        <button type="button" className={styles.btnGhost} onClick={replay}>
          Replay the reveal
        </button>
      </footer>
    </div>
  );
}

/**
 * The Watcher, drawn properly for the first time: a hooded sentinel with one
 * gold eye and a lantern. The lantern is its job made visible: it lights what
 * the public can read. Alert posture here (leaning toward the record, lantern
 * flaring) because the sample shows an open payment. Custom vector, D-010.
 */
function Watcher({ flare }: { flare: boolean }) {
  return (
    <div className={styles.watcher} data-flare={flare}>
      <svg
        viewBox="0 0 200 260"
        role="img"
        aria-label="The Watcher, the public, leaning toward the record with its lantern lit"
      >
        <defs>
          <radialGradient id="smpGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffcf6e" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#edb64a" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="smpCloak" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2b2438" />
            <stop offset="100%" stopColor="#1c1728" />
          </linearGradient>
          <radialGradient id="smpIris" cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor="#ffe3a3" />
            <stop offset="55%" stopColor="#edb64a" />
            <stop offset="100%" stopColor="#b9862f" />
          </radialGradient>
        </defs>

        <ellipse cx="100" cy="248" rx="62" ry="9" fill="#0c0a11" opacity="0.55" />

        <g className={styles.wFloat}>
          <circle className={styles.wGlow} cx="169" cy="166" r="52" fill="url(#smpGlow)" />

          {/* cloak */}
          <path
            d="M100 26c-34 0-52 26-55 62-3 34-9 74-16 108-2 9 4 16 13 17 19 3 39 4 58 4s39-1 58-4c9-1 15-8 13-17-7-34-13-74-16-108-3-36-21-62-55-62Z"
            fill="url(#smpCloak)"
            stroke="rgba(255,255,255,0.07)"
          />
          {/* rim light from its own lantern, on the side facing the record */}
          <path
            className={styles.wRim}
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
          <g className={styles.wEye}>
            <circle cx="104" cy="80" r="13.5" fill="url(#smpIris)" />
            <circle className={styles.wPupil} cx="107.5" cy="80" r="5.4" fill="#14101a" />
            <circle cx="100" cy="75" r="2.4" fill="#ffffff" opacity="0.85" />
          </g>

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
          <ellipse className={styles.wFlame} cx="169" cy="168" rx="4" ry="6.5" fill="#ffcf6e" />

          {/* two motes in the lantern light */}
          <circle className={styles.wMote1} cx="150" cy="128" r="1.6" fill="#edb64a" />
          <circle className={styles.wMote2} cx="182" cy="122" r="1.2" fill="#edb64a" />
        </g>
      </svg>
    </div>
  );
}

function LockGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="8" cy="10.4" r="1" fill="currentColor" />
    </svg>
  );
}

/**
 * The choice made physical. A wax seal that was never pressed: the ring is
 * broken open at the top with a speck of light where the gap is, because
 * "open" is the gold, public thing in this world. The sealed version fills in
 * with cool shadow, ready for the hidden rounds. Custom vector, D-010.
 */
function SealGlyph({ open = true }: { open?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open ? (
        <>
          <path
            d="M12 3.4a8.6 8.6 0 1 1-6 2.5"
            stroke="var(--gold)"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
          <circle cx="12" cy="3.2" r="1.9" fill="var(--gold-bright)" />
          <circle cx="12" cy="12" r="3.1" stroke="var(--gold)" strokeWidth="1.5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8.6" fill="#241f2f" stroke="var(--shadow-side)" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="3.1" fill="var(--shadow-side)" />
        </>
      )}
    </svg>
  );
}
