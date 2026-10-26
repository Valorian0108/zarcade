"use client";

/**
 * THROWAWAY DESIGN SAMPLE for cabinet four, The Auditor's Key (owner review
 * only). Nothing here is wired to anything: no API calls, no wallet, no money.
 * Every fact on screen is a labelled sample value, because the house rule is
 * that the screen never promises what the machine does not do.
 *
 * What it shows, in the order the owner asked for it:
 *   1. the curtain entry: violet-black velvet with a gold seam and a warm lamp
 *      glow behind it, the description first, then a gold Open button at the
 *      bottom centre that ignites once the text has landed (any click or key
 *      press brings it in early, so nobody is timed by their reading speed).
 *   2. the counter scene: one lamp, worn wood with a brass lip, the receipt,
 *      the brass key, the till, the record board with three sealed rows, the
 *      Watcher behind the counter, and the auditor in the foreground seen from
 *      behind with a clipboard. The player is the auditor.
 *   3. the three movements: the key turns in the record and the rows warm to
 *      gold, the same key will not turn in the till, and the last question
 *      shows that the key covers one account and cannot prove there is no
 *      other.
 *
 * Everything is drawn in CSS and inline SVG, in the house palette: gold for
 * what can be read, cool violet for what is sealed, no red and no green as a
 * verdict. The curtain cloth is the owner-approved oxblood velvet (D-113),
 * whose three shades also live in the house palette (D-114); the centre line
 * is the approved warm leak, masked away from the reading zone.
 */

import { useEffect, useState } from "react";
import { Watcher, type WatcherMood } from "@/components/watcher";
import { MotionToggle, useMotionPref } from "@/components/motion-pref";

/**
 * This project's Turbopack rule sends every *.css file through
 * @tailwindcss/turbopack with `as: "*.css"`, which disables CSS-module
 * scoping. So the sample uses one global stylesheet
 * (app/sample/audit/audit-sample.css) where every class is prefixed `aud-`,
 * and this map turns styles.foo into "aud-foo".
 */
const styles: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, key) {
    return typeof key === "string" ? `aud-${key}` : undefined;
  },
});

type Step = "counter" | "payment" | "record" | "till" | "question" | "end";

const ORDER: readonly Step[] = ["counter", "payment", "record", "till", "question", "end"];

/** Sample values. The real cabinet fills these from a real payment. */
const SAMPLE_TXID = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const SAMPLE_ACCOUNT = "u1audit9f3k…7q2m";

type Row = {
  label: string;
  tag?: string;
  amount: string;
  to: string;
  when: string;
  /** The honest gap: a key on this account never names the payer. */
  payer: string;
};

/**
 * Three payments the audit account received. Two honest details are built in:
 * the amount, the receiver, the time and the block are what a viewing key
 * really reveals, and "who paid" stays sealed even after the key turns, because
 * a key on this account does not name the payer.
 *
 * The row tagged "on your receipt" is the payment you watch at beat two. It is
 * absent from the board until the payment lands, the way the live cabinet will
 * scan it, so the board grows by exactly the one row you saw arrive.
 */
const ROWS: readonly Row[] = [
  {
    label: "Payment three",
    tag: "on your receipt",
    amount: "1,000 zat",
    to: SAMPLE_ACCOUNT,
    when: "21:14 · block 4,536,012",
    payer: "who paid: still sealed",
  },
  {
    label: "Payment two",
    amount: "1,000 zat",
    to: SAMPLE_ACCOUNT,
    when: "20:02 · block 4,535,880",
    payer: "who paid: still sealed",
  },
  {
    label: "Payment one",
    amount: "1,000 zat",
    to: SAMPLE_ACCOUNT,
    when: "18:47 · block 4,535,744",
    payer: "who paid: still sealed",
  },
];

const shortTx = (txid: string) => `${txid.slice(0, 8)}…${txid.slice(-8)}`;

/* ------------------------------------------------------------------ */
/* the props, drawn                                                     */
/* ------------------------------------------------------------------ */

function Lamp() {
  return (
    <svg viewBox="0 0 200 150" width="100%" role="img" aria-label="A brass lamp over the counter, throwing one warm pool of light.">
      <defs>
        <linearGradient id="audBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9c981" />
          <stop offset="45%" stopColor="#b9862f" />
          <stop offset="100%" stopColor="#6d4c17" />
        </linearGradient>
        <radialGradient id="audBulb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe3a3" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffcf6e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the rod from the ceiling */}
      <rect x="98" y="0" width="4" height="44" fill="#3a3446" />
      <rect x="92" y="40" width="16" height="7" rx="3" fill="url(#audBrass)" />
      {/* the shade */}
      <path d="M100 46 44 104q56 20 112 0L100 46Z" fill="url(#audBrass)" />
      <path d="M100 46 44 104q14 5 28 7l24-58-6-7Z" fill="#fff0c4" opacity="0.18" />
      <ellipse cx="100" cy="105" rx="56" ry="10" fill="#ffcf6e" opacity="0.22" />
      {/* the bulb and its bloom */}
      <circle cx="100" cy="112" r="42" fill="url(#audBulb)" />
      <ellipse cx="100" cy="110" rx="13" ry="9" fill="#ffe9b8" />
    </svg>
  );
}

function Key() {
  return (
    <svg viewBox="0 0 120 44" role="img" aria-label="A brass key, thumb sized, with a round bow and a simple bit.">
      <defs>
        <linearGradient id="audKeyBrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2d795" />
          <stop offset="42%" stopColor="#d3a44a" />
          <stop offset="100%" stopColor="#8a6420" />
        </linearGradient>
      </defs>
      {/* bow */}
      <circle cx="20" cy="22" r="15" fill="none" stroke="url(#audKeyBrass)" strokeWidth="6" />
      <circle cx="20" cy="22" r="15" fill="none" stroke="#fff0c4" strokeOpacity="0.35" strokeWidth="1.2" />
      {/* shaft */}
      <rect x="33" y="18" width="76" height="8" rx="3" fill="url(#audKeyBrass)" />
      <rect x="33" y="18.5" width="76" height="2" rx="1" fill="#fff0c4" opacity="0.3" />
      {/* bit: two teeth */}
      <path d="M92 26h8v11h-8zM102 26h7v7h-7z" fill="url(#audKeyBrass)" />
    </svg>
  );
}

function Keyhole({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <circle cx="13" cy="13" r="12" fill="url(#audPlateBrass)" stroke="rgba(255,226,160,0.4)" />
      <defs>
        <radialGradient id="audPlateBrass" cx="34%" cy="28%" r="76%">
          <stop offset="0%" stopColor="#e9c981" />
          <stop offset="70%" stopColor="#b9862f" />
          <stop offset="100%" stopColor="#6d4c17" />
        </radialGradient>
      </defs>
      <circle cx="13" cy="11" r="3.4" fill="#150f1c" />
      <path d="M11.2 12.6h3.6l1.2 7h-6l1.2-7Z" fill="#150f1c" />
    </svg>
  );
}

function SealMark() {
  return (
    <svg className={styles.sealMark} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.4" fill="#221b31" stroke="rgba(168,159,196,0.55)" />
      <circle cx="10" cy="8.6" r="2.3" fill="none" stroke="rgba(168,159,196,0.8)" strokeWidth="1.3" />
      <path d="M8.9 9.8h2.2l.8 4.6H8.1l.8-4.6Z" fill="rgba(168,159,196,0.8)" />
    </svg>
  );
}

/** The auditor: the player, seen from behind at the counter. Grey coat,
    clipboard, no face, because this is the visitor's own back. */
function Auditor() {
  return (
    <svg viewBox="0 0 320 360" role="img" aria-label="The auditor, which is you, seen from behind at the counter. Grey coat, a clipboard in one hand.">
      <defs>
        <linearGradient id="audCoat" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#7b7789" />
          <stop offset="55%" stopColor="#5d5969" />
          <stop offset="100%" stopColor="#3b3746" />
        </linearGradient>
        <linearGradient id="audHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#332b3e" />
          <stop offset="100%" stopColor="#1c1725" />
        </linearGradient>
        <linearGradient id="audClipBoard" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c39a5e" />
          <stop offset="100%" stopColor="#8a6534" />
        </linearGradient>
      </defs>

      {/* coat, back view */}
      <path
        d="M160 118c-38 0-66 15-80 40-13 22-19 55-23 96-3 32-4 66-4 106h214c0-40-1-74-4-106-4-41-10-74-23-96-14-25-42-40-80-40Z"
        fill="url(#audCoat)"
      />
      {/* centre seam and arm seams */}
      <path d="M160 150v210" stroke="rgba(0,0,0,0.22)" strokeWidth="2" />
      <path d="M100 156c-12 32-17 74-18 118" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
      <path d="M220 156c12 32 17 74 18 118" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2" />
      {/* the lamp's rim light on his right shoulder */}
      <path
        d="M214 132c18 24 27 66 30 112"
        fill="none"
        stroke="#edb64a"
        strokeOpacity="0.3"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* collar */}
      <path d="M124 122q36 26 72 0q-8 30-36 34q-28-4-36-34Z" fill="#45414f" />
      {/* neck */}
      <path d="M144 92h32v34h-32Z" fill="#241d2c" />
      {/* head from behind: hair, no face */}
      <ellipse cx="160" cy="74" rx="43" ry="49" fill="url(#audHair)" />
      <path
        d="M117 76c0-31 19-54 43-54s43 23 43 54c0 12-3 22-8 30-9-16-21-24-35-24s-26 8-35 24c-5-8-8-18-8-30Z"
        fill="#3b3247"
        opacity="0.75"
      />
      <ellipse cx="117" cy="86" rx="7" ry="10" fill="#2c2436" />
      <ellipse cx="203" cy="86" rx="7" ry="10" fill="#2c2436" />
      {/* a warm edge on the hair, from the lamp */}
      <path d="M196 44c9 12 13 28 12 44" fill="none" stroke="#edb64a" strokeOpacity="0.24" strokeWidth="3" strokeLinecap="round" />

      {/* clipboard held in front, high enough that the stage crop does not
          eat it: this is the prop that says "you are the auditor" */}
      <g transform="translate(30 198) rotate(-7)">
        <rect x="0" y="0" width="142" height="176" rx="7" fill="url(#audClipBoard)" />
        <rect x="10" y="16" width="122" height="152" rx="3" fill="#efe6cf" />
        <rect x="48" y="-9" width="46" height="19" rx="5" fill="#b9862f" />
        <rect x="56" y="-4" width="30" height="7" rx="3" fill="#e9c981" />
        <rect x="22" y="34" width="86" height="5" rx="2.5" fill="rgba(44,35,24,0.5)" />
        <rect x="22" y="50" width="98" height="4" rx="2" fill="rgba(44,35,24,0.32)" />
        <rect x="22" y="62" width="72" height="4" rx="2" fill="rgba(44,35,24,0.32)" />
        <rect x="22" y="80" width="58" height="16" rx="3" fill="rgba(138,100,32,0.28)" />
        <rect x="22" y="108" width="98" height="4" rx="2" fill="rgba(44,35,24,0.24)" />
        <rect x="22" y="120" width="64" height="4" rx="2" fill="rgba(44,35,24,0.24)" />
        {/* the hand on the board's edge */}
        <ellipse cx="4" cy="96" rx="17" ry="13" fill="#b98d6b" transform="rotate(-12 4 96)" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* the sample                                                         */
/* ------------------------------------------------------------------ */

export function AuditSample() {
  const { reduced } = useMotionPref();

  const [curtainUp, setCurtainUp] = useState(true);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>("counter");
  const [paid, setPaid] = useState(false);
  const [litCount, setLitCount] = useState(0);
  const [tried, setTried] = useState(false);

  /* the Open button ignites once the text has landed, and any click or key
     press brings it in early so a slow reader is never punished */
  useEffect(() => {
    if (!curtainUp || opening) return;
    const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 2800);
    const early = () => setReady(true);
    window.addEventListener("keydown", early);
    window.addEventListener("pointerdown", early);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", early);
      window.removeEventListener("pointerdown", early);
    };
  }, [curtainUp, opening, reduced]);

  /* the payment beat: on this page nothing is paid, so the wait is a short
     honest pause and the receipt prints a labelled sample value */
  useEffect(() => {
    if (step !== "payment") return;
    setPaid(false);
    const timer = window.setTimeout(() => setPaid(true), reduced ? 400 : 2000);
    return () => window.clearTimeout(timer);
  }, [step, reduced]);

  /* the record beat: the key travels, turns, and the rows warm one at a time */
  useEffect(() => {
    if (step !== "record") return;
    setLitCount(0);
    if (reduced) {
      setLitCount(ROWS.length);
      return;
    }
    const timers = ROWS.map((_, index) =>
      window.setTimeout(() => setLitCount(index + 1), 900 + index * 340),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [step, reduced]);

  /* the till beat: the key goes in and does not turn */
  useEffect(() => {
    if (step !== "till") return;
    setTried(false);
    const timer = window.setTimeout(() => setTried(true), reduced ? 0 : 1300);
    return () => window.clearTimeout(timer);
  }, [step, reduced]);

  function go(next: Step) {
    const index = ORDER.indexOf(next);
    setStep(next);
    if (next !== "payment") setPaid(index >= 2);
    if (next !== "record") setLitCount(index >= 3 ? ROWS.length : 0);
    if (next !== "till") setTried(index >= 4);
  }

  function replay() {
    setStep("counter");
    setPaid(false);
    setLitCount(0);
    setTried(false);
    setReady(false);
    setOpening(false);
    setCurtainUp(true);
  }

  function open() {
    setOpening(true);
    window.setTimeout(() => setCurtainUp(false), reduced ? 0 : 1250);
  }

  /** One action per beat, always the next one. No rounds, no score. */
  function advance() {
    const index = ORDER.indexOf(step);
    if (index < ORDER.length - 1) go(ORDER[index + 1]);
  }

  const rowsOpen = litCount >= ROWS.length;
  /* the row on your receipt joins the board only once the payment lands, so
     before beat two the board shows the account's older history alone */
  const shownRows = paid ? ROWS : ROWS.filter((row) => row.tag !== "on your receipt");
  const keyAt =
    step === "counter" || step === "end"
      ? "wood"
      : step === "payment" || step === "question"
        ? "hand"
        : step === "record"
          ? "record"
          : "till";
  const watcherMood: WatcherMood = step === "record" && litCount > 0 ? "alert" : "calm";

  const speech = COPY[step]({ paid, opened: litCount > 0, tried });

  return (
    <div className={styles.root}>
      <p className={styles.banner}>
        Design sample. No money moves on this page and nothing here is wired to the wallet.
      </p>

      <header className={styles.bar}>
        <div className={styles.barLeft}>
          <span className={styles.wordmark}>ZARCADE</span>
          <span className={styles.barDiv} aria-hidden="true" />
          <span className={styles.barName}>The Auditor&rsquo;s Key</span>
          <span className={styles.barTag}>Sample values</span>
        </div>
        <MotionToggle />
      </header>

      {/* ---------------- the curtain ---------------- */}
      <div
        className={styles.curtain}
        data-open={opening}
        data-gone={!curtainUp}
        aria-hidden={!curtainUp}
      >
        <div className={styles.curtainGlow} aria-hidden="true" />
        <div className={styles.curtainHalf} data-side="left" aria-hidden="true" />
        <div className={styles.curtainHalf} data-side="right" aria-hidden="true" />
        <div className={styles.seam} aria-hidden="true" />
        <div className={styles.valance} aria-hidden="true" />

        <div className={styles.curtainCopy}>
          <p className={styles.curtainKicker}>Cabinet four · The Audit</p>
          <h1 className={styles.curtainTitle}>The arcade is closed.</h1>
          <p className={styles.curtainProse}>
            The machines are dark and the floor is empty. One lamp is on over the counter, and
            somebody is standing there with a clipboard.
          </p>
          <p className={styles.curtainProse}>
            That is you. You are the auditor. You came to check one receipt, and the house left a
            key on the counter for you.
          </p>
          <p className={styles.curtainTeach}>
            A viewing key lets someone read a payment. It cannot spend it. This cabinet shows what
            handing one over really gives away.
          </p>
        </div>

        <div className={styles.openWrap}>
          <button type="button" className={styles.openBtn} data-on={ready} onClick={open}>
            Open
          </button>
        </div>
      </div>

      {/* ---------------- the room ---------------- */}
      <div className={styles.stageWrap}>
        <div className={styles.stage} data-lit={step === "counter" || step === "payment" ? "narrow" : "wide"}>
          <div className={styles.backWall} aria-hidden="true" />
          <div className={styles.cabinetSilhouette} style={{ left: "6%" }} aria-hidden="true" />
          <div className={styles.cabinetSilhouette} style={{ left: "17%", height: "24%" }} aria-hidden="true" />
          <div className={styles.cabinetSilhouette} style={{ left: "80%", height: "26%" }} aria-hidden="true" />
          <div className={styles.cabinetSilhouette} style={{ left: "90%", height: "32%" }} aria-hidden="true" />

          <div className={styles.cone} aria-hidden="true" />
          <div className={styles.lamp}>
            <Lamp />
          </div>
          <div className={styles.pool} aria-hidden="true" />

          <Watcher mood={watcherMood} width={132} className={styles.watcher} />

          {/* the counter: wood, brass lip, worn front */}
          <div className={styles.counter} aria-hidden="true">
            <div className={styles.counterTop} />
            <div className={styles.counterLip} />
            <div className={styles.counterFace}>
              <span className={styles.scratch} style={{ left: "12%", top: "26%", width: "18%" }} />
              <span className={styles.scratch} style={{ left: "44%", top: "58%", width: "12%" }} />
              <span className={styles.scratch} style={{ left: "66%", top: "34%", width: "9%" }} />
            </div>
          </div>

          {/* the receipt: the claim */}
          <div className={styles.receipt}>
            <p className={styles.receiptName}>ZARCADE</p>
            <div className={styles.receiptRule} />
            <div className={styles.receiptLine}>
              {/* a claim until the payment lands, a receipt after: the paper
                  keeps the same tense as the Watcher's words */}
              <span>{paid ? "The house paid" : "The house will pay"}</span>
              <span className={styles.receiptAmount}>1,000 zat</span>
            </div>
            <div className={styles.receiptLine}>
              <span>sealed</span>
              <span>shielded</span>
            </div>
            <div className={styles.receiptTx} data-state={paid ? "paid" : "waiting"}>
              {paid ? (
                <>
                  {shortTx(SAMPLE_TXID)}
                  <br />
                  block 4,536,012
                </>
              ) : (
                <>waiting for the payment…</>
              )}
            </div>
            <span className={styles.receiptStamp}>Sample</span>
          </div>

          {/* the till: the key will not turn here */}
          <div className={styles.till}>
            <div className={styles.tillTop} />
            <div className={styles.tillDrawer}>
              <span className={styles.tillPull} />
            </div>
            <div className={styles.tillHole}>
              <Keyhole size={16} />
            </div>
            <span className={styles.tillPlate}>TILL</span>
          </div>

          {/* the record board: the account's history as the chain holds it.
              Two sealed rows before the payment; the row on your receipt
              arrives when the payment lands, and one keyhole below. */}
          <div className={styles.board}>
            <div className={styles.boardHead}>
              <span className={styles.boardName}>The record</span>
              <span className={styles.boardNote}>one account</span>
            </div>

            <ul className={styles.rows}>
              {shownRows.map((row, index) => {
                const lit = index < litCount;
                return (
                  <li
                    key={row.label}
                    className={styles.row}
                    data-state={lit ? "lit" : "sealed"}
                    data-arrived={row.tag === "on your receipt"}
                  >
                    <div className={styles.rowHead}>
                      <span className={styles.rowLabel}>{row.label}</span>
                      <span className={styles.rowTag} data-on={lit && Boolean(row.tag)}>
                        {row.tag ?? ""}
                      </span>
                    </div>
                    <div className={styles.rowBody}>
                      <div className={styles.facts}>
                        <div className={styles.factLine}>
                          <span className={styles.factAmount}>{row.amount}</span>
                          <span className={styles.factPayer}>{row.payer}</span>
                        </div>
                        <div className={styles.factMeta}>{`${row.to} · ${row.when}`}</div>
                      </div>
                      <div className={styles.bars} aria-hidden="true">
                        <span className={styles.redact} style={{ width: "46%" }} />
                        <span className={styles.redact} style={{ width: "74%" }} />
                        <span className={styles.sealLine}>
                          <SealMark />
                          <span>Sealed. No key handed over.</span>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* the sealed strip: what this kind of key never covers. Gold rows
                above are incoming payments; this stays dark on purpose. */}
            <div className={styles.outStrip} data-on={rowsOpen} aria-hidden={!rowsOpen}>
              <SealMark />
              <span>Outgoing spending: this key cannot see it.</span>
            </div>

            <div className={styles.boardFoot}>
              <span className={styles.slot}>
                <Keyhole />
                Keyhole
              </span>
              <span className={styles.boardVerdict} data-on={rowsOpen}>
                The payment is recorded.
              </span>
            </div>
          </div>

          <div className={styles.keyFlare} data-on={step === "record" && litCount > 0} aria-hidden="true" />

          {/* the key itself, travelling between the wood, the hand, the record
              and the till */}
          <div
            className={styles.key}
            data-at={keyAt}
            data-turned={step === "record" && litCount > 0}
            data-refuse={step === "till" && tried}
            aria-hidden="true"
          >
            <Key />
          </div>

          <div className={styles.auditor}>
            <Auditor />
          </div>

          <div className={styles.vignette} aria-hidden="true" />

          {/* the last question, laid over the room */}
          {step === "question" ? (
            <div className={styles.ask}>
              <div className={styles.askCard}>
                <p className={styles.askQ}>How do I know this is all of it?</p>
                <p className={styles.askWho}>The auditor asks the only question that matters.</p>

                <div className={styles.map} aria-hidden="true">
                  <span className={styles.acct} data-lit="true">
                    this one
                  </span>
                  <span className={styles.acct}>account</span>
                  <span className={styles.acct}>account</span>
                  <span className={styles.acct}>account</span>
                  <span className={styles.chain}>the rest of the chain</span>
                  <span className={styles.mapOut}>
                    <svg viewBox="0 0 64 12" width="42" height="9" aria-hidden="true">
                      <path d="M0 6h52M46 1l8 5-8 5" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                    money going out: dark
                  </span>
                </div>
                <p className={styles.mapKey}>
                  One account lights up, and only the rows that came in. The other accounts stay
                  dark. Money going out stays dark too, because this key never shows spending.
                </p>

                <p className={styles.askLine}>
                  This key shows what arrived here. It cannot show what left, who sent it, or
                  that nothing else exists.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------------- the band: one line and one action ---------------- */}
      {step === "end" ? (
        <div className={styles.end}>
          <div className={styles.endCard}>
            <div>
              <h2 className={styles.endTitle}>What you just did</h2>
              <ol className={styles.endList}>
                <li>You read a payment with a key that cannot spend it.</li>
                <li>You saw every incoming row that key covers, and nothing past it.</li>
                <li>You learned that a key shows what came in, and never the whole story.</li>
              </ol>
            </div>
            <div className={styles.endReceipt}>
              <div className={styles.endReceiptRow}>
                <span>Paid</span>
                <span>1,000 zat</span>
              </div>
              <div className={styles.endReceiptRow}>
                <span>Transaction</span>
                <span>{shortTx(SAMPLE_TXID)}</span>
              </div>
              <div className={styles.endReceiptRow}>
                <span>Block</span>
                <span>4,536,012</span>
              </div>
              <div className={styles.endReceiptRow}>
                <span>Read with</span>
                <span>one viewing key</span>
              </div>
              <p className={styles.endNote}>
                Sample values. In the cabinet this is a real payment, with a real transaction id
                and a link that opens it on the explorer so you can check the house yourself.
              </p>
              <div className={styles.endActions}>
                <button type="button" className={styles.btn} onClick={() => go("counter")}>
                  Play it again
                </button>
                <button type="button" className={styles.btnGhost} onClick={replay}>
                  Back to the curtain
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.band} aria-live="polite">
          <div className={styles.speech}>
            <p className={styles.speaker}>{speech.speaker}</p>
            {speech.lines.map((line) => (
              <p className={styles.line} key={line}>
                {line}
              </p>
            ))}
            {speech.teach ? <p className={styles.teachLine}>{speech.teach}</p> : null}
          </div>

          <div className={styles.action}>
            {step === "payment" && !paid ? (
              <span className={styles.waitNote}>The house is paying. One moment.</span>
            ) : null}
            <button type="button" className={styles.btn} disabled={speech.waiting} onClick={advance}>
              {speech.button}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- sample-only controls ---------------- */}
      <div className={styles.rail}>
        <p className={styles.railLabel}>Sample controls, not part of the cabinet</p>
        <div className={styles.railBtns}>
          <button type="button" className={styles.railBtn} onClick={replay}>
            Curtain
          </button>
          {ORDER.map((target) => (
            <button
              key={target}
              type="button"
              className={styles.railBtn}
              data-on={step === target && curtainUp === false}
              onClick={() => {
                setCurtainUp(false);
                setOpening(true);
                go(target);
              }}
            >
              {LABEL[target]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const LABEL: Record<Step, string> = {
  counter: "1 The counter",
  payment: "2 The payment",
  record: "3 The record",
  till: "4 The till",
  question: "5 The question",
  end: "6 The end",
};

type Speech = {
  speaker: string;
  lines: string[];
  teach?: string;
  button: string;
  /** true while the beat is still happening, so the action waits */
  waiting: boolean;
};

/**
 * One scene, three movements, no rounds and no score. Each beat says one plain
 * thing and offers one action. The Watcher is the house host: he watches the
 * street all night and has never seen inside a sealed payment, so the reveal is
 * his as much as the player's.
 */
const COPY: Record<Step, (state: { paid: boolean; opened: boolean; tried: boolean }) => Speech> = {
  counter: () => ({
    speaker: "The Watcher",
    lines: [
      "The arcade is closed. You came to check the books.",
      "This slip is the house's claim. It says the house will pay one thousand zatoshis into the audit account, sealed, while you watch.",
      "A sealed payment is a closed envelope on the chain. I watch this street all night. I see every envelope walk by. I cannot read a single one.",
    ],
    teach: "A viewing key lets someone read a payment. It cannot spend it.",
    button: "Take the key",
    waiting: false,
  }),
  payment: ({ paid }) => ({
    speaker: "The Watcher",
    lines: paid
      ? [
          "Paid from the house money box, sealed. The slip prints the transaction id, the envelope's public fingerprint.",
          "The key in your hand is the reading permission for that account. It is not the money.",
        ]
      : [
          "The house pays from its own money box now, while you hold the key.",
          "On this sample page nothing is paid. In the cabinet this is where a real testnet payment moves.",
        ],
    teach: "The payment lands on the chain. The key lets you read what was received.",
    button: "Go to the record",
    waiting: !paid,
  }),
  record: ({ opened }) => ({
    speaker: "The Watcher",
    lines: opened
      ? ["The payment is recorded. I can read what arrived. But I cannot see who sent it."]
      : ["Turn it in the record. Not the till."],
    teach: opened
      ? "The key shows what came in. It never names the sender, and it never shows what went out."
      : undefined,
    button: "Try the till",
    waiting: !opened,
  }),
  till: ({ tried }) => ({
    speaker: "The Watcher",
    lines: tried
      ? ["That is not a lock failing. That is a key with no spend in it."]
      : ["Go on. Try the same key in the till. Everybody does."],
    teach: tried ? "This key sees. It does not spend." : undefined,
    button: "Ask the last question",
    waiting: !tried,
  }),
  question: () => ({
    speaker: "The Watcher",
    lines: [
      "You know what this key lets you see. You do not know what the owner spent, what sits outside this key, or who sent each payment.",
    ],
    teach: "A key shows the incoming payments it covers. It never shows the whole money story.",
    button: "Finish the visit",
    waiting: false,
  }),
  end: () => ({ speaker: "", lines: [], button: "", waiting: false }),
};
