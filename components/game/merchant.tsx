"use client";

/**
 * The Merchant's Window, cabinet four (SCOPE-CABINET-4.md, D-115 onward).
 *
 * One room, seven beats, one action each. You are the shopkeeper, first
 * person, behind your own counter. A deposit has landed in your account and a
 * supplier's auditor wants proof it arrived. You hold the incoming viewing key.
 * You preview what it shows, you confirm it cannot spend, then you choose how
 * much to hand over: the key, one proved payment, or nothing.
 *
 * The honesty rule that governs every pixel: nothing on this screen is invented.
 * The two rows on the board are real testnet payments the merchant account
 * actually received, read back through the incoming-only scan (D-117, D-119).
 * The proof in the "one sealed note" path is the shipped verifier's own verdict
 * against the chain (D-118), passed through lib/merchant.ts, which only calls a
 * payment proven when every check is present and passed. If the wallet cannot
 * be read, the room says so instead of showing a placeholder.
 *
 * The visual language is the owner-approved sample at /sample/audit (frozen as
 * a scratchpad, D-115): oxblood velvet curtain, gold for what can be read, cool
 * violet for what stays sealed, no red and no green as a verdict. The framing is
 * the sample's opposite on purpose. There the player was the auditor and a
 * Watcher hosted; here the player is the merchant, the auditor is the only
 * speaker, and there is no Watcher and no supplier on screen (section 5, item 5).
 *
 * Copy follows the grandma rule (D-018, D-097): short plain sentences, the real
 * term named once then plain words, no em dashes, no banned buzzwords. Motion
 * follows the page's More/Less preference; the global rule in game.css stills
 * every travel here and lands each beat in its finished state.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  addressInWords,
  amountInWords,
  BALANCE_ANSWER,
  blockTimeInWords,
  DEPOSIT_MEMO,
  depositReceipt,
  explorerUrl,
  memoInWords,
  proofFor,
  proofInWords,
  WHO_PAID_SEALED,
  type Proof,
  type Receipt,
  type WindowFacts,
} from "@/lib/merchant";
import { MotionToggle, useMotionPref } from "@/components/motion-pref";

/**
 * The Turbopack rule sends every *.css file through @tailwindcss/turbopack with
 * `as: "*.css"`, which turns off CSS-module scoping. So the stylesheet is global
 * (app/games/merchant/merchant.css) with every class prefixed `mrc-`, and this
 * proxy turns styles.foo into "mrc-foo", the same trick the frozen sample uses.
 */
const styles: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_target, key) {
    return typeof key === "string" ? `mrc-${key}` : undefined;
  },
});

/** The seven beats, in the locked order (SCOPE-CABINET-4.md section 4). */
type Beat =
  | "curtain"
  | "request"
  | "preview"
  | "boundary"
  | "choice"
  | "consequence"
  | "balance"
  | "end";

const ORDER: readonly Beat[] = [
  "curtain",
  "request",
  "preview",
  "boundary",
  "choice",
  "consequence",
  "balance",
  "end",
];

/** The three ways to answer the supplier (beat 4). None is scored. */
type Choice = "key" | "note" | "nothing";

const shortTx = (txid: string) => `${txid.slice(0, 8)}…${txid.slice(-8)}`;

/* ------------------------------------------------------------------ */
/* the props, drawn                                                    */
/* ------------------------------------------------------------------ */

function Lamp() {
  return (
    <svg viewBox="0 0 200 150" width="100%" role="img" aria-label="A brass lamp over the counter, throwing one warm pool of light.">
      <defs>
        <linearGradient id="mrcBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e9c981" />
          <stop offset="45%" stopColor="#b9862f" />
          <stop offset="100%" stopColor="#6d4c17" />
        </linearGradient>
        <radialGradient id="mrcBulb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffe3a3" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffcf6e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#edb64a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="98" y="0" width="4" height="44" fill="#3a3446" />
      <rect x="92" y="40" width="16" height="7" rx="3" fill="url(#mrcBrass)" />
      {/* a narrower shade, and the bulb hangs below its rim instead of sitting
          on the edge: rim curve bottoms near y 110, bulb centre at y 118 */}
      <path d="M100 46 56 102q44 16 88 0L100 46Z" fill="url(#mrcBrass)" />
      <path d="M100 46 56 102q11 4 22 6l20-54-6-8Z" fill="#fff0c4" opacity="0.18" />
      <ellipse cx="100" cy="103" rx="44" ry="9" fill="#ffcf6e" opacity="0.22" />
      <circle cx="100" cy="120" r="40" fill="url(#mrcBulb)" />
      <ellipse cx="100" cy="118" rx="12" ry="8" fill="#ffe9b8" />
    </svg>
  );
}

function Key() {
  return (
    <svg viewBox="0 0 120 44" role="img" aria-label="A brass key, thumb sized, with a round bow and a simple bit.">
      <defs>
        <linearGradient id="mrcKeyBrass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f2d795" />
          <stop offset="42%" stopColor="#d3a44a" />
          <stop offset="100%" stopColor="#8a6420" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="22" r="15" fill="none" stroke="url(#mrcKeyBrass)" strokeWidth="6" />
      <circle cx="20" cy="22" r="15" fill="none" stroke="#fff0c4" strokeOpacity="0.35" strokeWidth="1.2" />
      {/* shaft and bit: one group, faded out once the key is home in a lock */}
      <g className={styles.keyShaft}>
        <rect x="33" y="18" width="76" height="8" rx="3" fill="url(#mrcKeyBrass)" />
        <rect x="33" y="18.5" width="76" height="2" rx="1" fill="#fff0c4" opacity="0.3" />
        <path d="M92 26h8v11h-8zM102 26h7v7h-7z" fill="url(#mrcKeyBrass)" />
      </g>
    </svg>
  );
}

function Keyhole({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true">
      <defs>
        <radialGradient id="mrcPlateBrass" cx="34%" cy="28%" r="76%">
          <stop offset="0%" stopColor="#e9c981" />
          <stop offset="70%" stopColor="#b9862f" />
          <stop offset="100%" stopColor="#6d4c17" />
        </radialGradient>
      </defs>
      <circle cx="13" cy="13" r="12" fill="url(#mrcPlateBrass)" stroke="rgba(255,226,160,0.4)" />
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

/**
 * The auditor: the supplier's representative, standing on the far side of the
 * counter, facing you, holding the letter that asks for proof. Grey coat, the
 * existing silhouette, but a face kept in shadow because this is a presence,
 * not a character with a story of their own.
 */
function Auditor() {
  return (
    <svg viewBox="0 0 240 320" role="img" aria-label="The auditor, in a grey coat, standing across the counter and holding a folded letter.">
      <defs>
        <linearGradient id="mrcCoat" x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#807c90" />
          <stop offset="50%" stopColor="#5d5969" />
          <stop offset="100%" stopColor="#35313d" />
        </linearGradient>
        <linearGradient id="mrcPaper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0e5cb" />
          <stop offset="100%" stopColor="#d8c8a5" />
        </linearGradient>
        {/* a face in shadow, not a hole: shaded from the lamp side */}
        <radialGradient id="mrcFace" cx="36%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#3d3444" />
          <stop offset="55%" stopColor="#251e30" />
          <stop offset="100%" stopColor="#150f1f" />
        </radialGradient>
      </defs>
      {/* coat, front view */}
      <path
        d="M120 96c-34 0-58 16-70 42-10 22-15 56-18 96-2 26-3 52-3 86h182c0-34-1-60-3-86-3-40-8-74-18-96-12-26-36-42-70-42Z"
        fill="url(#mrcCoat)"
      />
      {/* lapels and centre seam */}
      <path d="M120 104 96 128l10 92h28l10-92-24-24Z" fill="#4a4657" />
      <path d="M120 104v216" stroke="rgba(0,0,0,0.22)" strokeWidth="2" />
      {/* collar and neck */}
      <path d="M96 100q24 22 48 0q-6 26-24 30q-18-4-24-30Z" fill="#45414f" />
      <path d="M108 74h24v30h-24Z" fill="#241d2c" />
      {/* head, face in shadow under a low brim */}
      <ellipse cx="120" cy="58" rx="38" ry="43" fill="#2a2436" />
      <path d="M82 52a38 38 0 0 1 76 0v6H82v-6Z" fill="#201a2b" />
      <ellipse cx="120" cy="66" rx="30" ry="26" fill="url(#mrcFace)" />
      {/* the letter, held up in front */}
      <g transform="translate(96 196) rotate(-4)">
        <rect x="0" y="0" width="86" height="60" rx="3" fill="url(#mrcPaper)" />
        <path d="M0 0l43 32L86 0" fill="none" stroke="rgba(90,70,40,0.5)" strokeWidth="2" />
        <rect x="14" y="40" width="58" height="3" rx="1.5" fill="rgba(90,70,40,0.3)" />
        <rect x="14" y="48" width="40" height="3" rx="1.5" fill="rgba(90,70,40,0.24)" />
      </g>
      {/* the hand gripping the letter's near bottom corner, over the paper */}
      <ellipse cx="170" cy="246" rx="14" ry="11" fill="#b98d6b" transform="rotate(-14 170 246)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* the cabinet                                                         */
/* ------------------------------------------------------------------ */

type Load = "idle" | "loading" | "done" | "error";

export function Merchant() {
  const { reduced } = useMotionPref();

  /* beat 0, the curtain */
  const [curtainUp, setCurtainUp] = useState(true);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);

  const [beat, setBeat] = useState<Beat>("curtain");

  /* the merchant's incoming side, read off the chain. Never invented. */
  const [win, setWin] = useState<WindowFacts | null>(null);
  const [winLoad, setWinLoad] = useState<Load>("idle");
  const [winError, setWinError] = useState("");

  /* beat 2, the rows warm one by one; beat 3, the key refuses the till */
  const [litCount, setLitCount] = useState(0);
  const [tried, setTried] = useState(false);

  /* beat 4 onward */
  const [choice, setChoice] = useState<Choice | null>(null);
  const [proofs, setProofs] = useState<Proof[] | null>(null);
  const [proofLoad, setProofLoad] = useState<Load>("idle");
  const [proofError, setProofError] = useState("");

  // Nothing sets state after the player has navigated away.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* The Open button ignites once the entry text has landed, and any click or
     key press brings it in early so a slow reader is never punished. The
     wrapper's own press handler opens on that first press, so no click is
     ever swallowed by the arming. */
  useEffect(() => {
    if (!curtainUp || opening) return;
    const timer = window.setTimeout(() => setReady(true), reduced ? 0 : 2600);
    const early = () => setReady(true);
    window.addEventListener("keydown", early);
    window.addEventListener("pointerdown", early);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", early);
      window.removeEventListener("pointerdown", early);
    };
  }, [curtainUp, opening, reduced]);

  /* Read the merchant's incoming side once, up front, so the two real rows are
     waiting by the time the story reaches the board. Read-only, no parameters:
     the route cannot be aimed at anything but this account.

     No state is set before the network answers (the house pattern from
     unseen.tsx): the mount effect calls this function, and an effect body must
     never reach a synchronous setState. The board's first paint already says
     the account is being read, which is the truth from the moment this runs. */
  const loadWindow = useCallback(async () => {
    try {
      const response = await fetch("/api/game/merchant/window");
      const body = (await response.json()) as Record<string, unknown>;
      if (!mounted.current) return;
      if (!response.ok || body.ok !== true || typeof body.window !== "object" || body.window === null) {
        setWinLoad("error");
        setWinError(
          typeof body.problem === "string"
            ? body.problem
            : "The arcade could not read the shop account just now.",
        );
        return;
      }
      const w = body.window as Record<string, unknown>;
      const receipts = Array.isArray(w.receipts) ? (w.receipts as Receipt[]) : [];
      setWin({
        address: typeof w.address === "string" ? w.address : "",
        canSpend: w.canSpend === true,
        scannedTo: typeof w.scannedTo === "number" ? w.scannedTo : 0,
        receipts,
      });
      setWinLoad("done");
    } catch {
      if (!mounted.current) return;
      setWinLoad("error");
      setWinError("The arcade could not reach the wallet to read the shop account.");
    }
  }, []);

  // Asked once per visit. The guard is a ref, not state, because the route has
  // a ten-second brake per visitor: where an effect runs twice (strict mode),
  // a second ask would buy nothing but a 429.
  const windowAsked = useRef(false);
  useEffect(() => {
    if (windowAsked.current) return;
    windowAsked.current = true;
    void loadWindow();
  }, [loadWindow]);

  /* Prove the receipts only when the player picks the one-sealed-note path.
     This is the heavier read, so it is never fetched unless the story needs it,
     and it is fetched once and kept, so a replay does not hit the brake.
     The "loading" state is set by the click that chooses the note, not here:
     like loadWindow, this function is reached from an effect and must carry no
     synchronous setState. */
  const loadProofs = useCallback(async () => {
    try {
      const response = await fetch("/api/game/merchant/receipt");
      const body = (await response.json()) as Record<string, unknown>;
      if (!mounted.current) return;
      if (!response.ok || body.ok !== true || !Array.isArray(body.proofs)) {
        setProofLoad("error");
        setProofError(
          typeof body.problem === "string"
            ? body.problem
            : "The arcade could not check the payment against the chain.",
        );
        return;
      }
      setProofs(body.proofs as Proof[]);
      setProofLoad("done");
    } catch {
      if (!mounted.current) return;
      setProofLoad("error");
      setProofError("The arcade could not reach the wallet to check the payment.");
    }
  }, []);

  const receipts = win?.receipts ?? [];
  const count = receipts.length;
  const deposit = win ? depositReceipt(win.receipts) : null;

  /* beat 2: the key turns and the rows warm one at a time. Nothing resets here
     on entry (the transitions in go() own every reset), so the effect body
     holds no setState: every change lands from a timer callback. Under less
     motion the stagger collapses to one zero-delay landing. */
  useEffect(() => {
    if (beat !== "preview" || count === 0) return;
    if (reduced) {
      const settle = window.setTimeout(() => {
        if (mounted.current) setLitCount(count);
      }, 0);
      return () => window.clearTimeout(settle);
    }
    const timers = receipts.map((_, index) =>
      window.setTimeout(() => {
        if (mounted.current) setLitCount(index + 1);
      }, 800 + index * 380),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, reduced, count]);

  /* beat 3: the key goes into the till and does not turn. One timer, and no
     entry reset in the body (go() owns it), so nothing fires synchronously.
     The wobble starts at beat entry and settles at 2400ms, so on more motion
     the gate opens at 2450ms, after the key has stopped moving; less motion
     kills the wobble and lands the gate at 0. */
  useEffect(() => {
    if (beat !== "boundary") return;
    const timer = window.setTimeout(() => {
      if (mounted.current) setTried(true);
    }, reduced ? 0 : 2450);
    return () => window.clearTimeout(timer);
  }, [beat, reduced]);

  /* beat 4: picking the sealed note fetches its proof. The click already set
     proofLoad to "loading"; this effect only fires the ask, exactly once, and
     every state change happens after the network answers. */
  const proofAsked = useRef(false);
  useEffect(() => {
    if (beat !== "consequence" || choice !== "note" || proofs !== null) return;
    if (proofLoad !== "loading" || proofAsked.current) return;
    proofAsked.current = true;
    void loadProofs();
  }, [beat, choice, proofs, proofLoad, loadProofs]);

  function go(next: Beat) {
    const index = ORDER.indexOf(next);
    setBeat(next);
    // The board stays read once you have seen it; the till stays tried.
    if (next !== "preview") setLitCount(index >= ORDER.indexOf("boundary") ? count : 0);
    if (next !== "boundary") setTried(index >= ORDER.indexOf("choice"));
  }

  function open() {
    setOpening(true);
    window.setTimeout(() => setCurtainUp(false), reduced ? 0 : 1200);
    // The story begins at the counter the moment the curtain starts to part.
    window.setTimeout(() => go("request"), reduced ? 0 : 1200);
  }

  /** One action per beat, always the next one. No rounds, no score. */
  function advance() {
    const index = ORDER.indexOf(beat);
    if (index < ORDER.length - 1) go(ORDER[index + 1]);
  }

  function choose(which: Choice) {
    setChoice(which);
    // The sealed-note path is the only one that asks the chain for a proof.
    // "Loading" is set here in the click, where a synchronous setState
    // belongs, and the ask guard is lifted so a re-pick after a failed check
    // is allowed one genuine retry.
    if (which === "note" && proofs === null) {
      proofAsked.current = false;
      setProofLoad("loading");
      setProofError("");
    }
    go("consequence");
  }

  /** Replay from the counter, keeping the chain data already read. */
  function restart() {
    setChoice(null);
    setLitCount(0);
    setTried(false);
    go("request");
  }

  /** Full replay, back through the curtain. Also keeps the chain data. */
  function replay() {
    setChoice(null);
    setLitCount(0);
    setTried(false);
    setReady(false);
    setOpening(false);
    setCurtainUp(true);
    setBeat("curtain");
  }

  const rowsOpen = count > 0 && litCount >= count;
  const keyAt =
    beat === "preview"
      ? "record"
      : beat === "boundary"
        ? "till"
        : beat === "choice"
          ? "hand"
          : "wood";
  const turned = beat === "preview" && litCount > 0;

  // What the supplier can see through the window, set by the choice.
  const windowMode: "dark" | "one" | "all" =
    beat === "consequence" || beat === "balance" || beat === "end"
      ? choice === "key"
        ? "all"
        : choice === "note"
          ? "one"
          : "dark"
      : "dark";

  const depositProof = deposit && proofs ? proofFor(proofs, deposit) : null;

  return (
    <div className={styles.root}>
      <header className={styles.bar}>
        <div className={styles.barLeft}>
          <span className={styles.wordmark}>ZARCADE</span>
          <span className={styles.barDiv} aria-hidden="true" />
          <span className={styles.barName}>The Merchant&rsquo;s Window</span>
          <span className={styles.barTag}>Real testnet receipts</span>
        </div>
        <MotionToggle />
      </header>

      {/* ---------------- the curtain (beat 0) ---------------- */}
      <div className={styles.curtain} data-open={opening} data-gone={!curtainUp} aria-hidden={!curtainUp}>
        <div className={styles.curtainGlow} aria-hidden="true" />
        <div className={styles.curtainHalf} data-side="left" aria-hidden="true" />
        <div className={styles.curtainHalf} data-side="right" aria-hidden="true" />
        <div className={styles.seam} aria-hidden="true" />
        <div className={styles.valance} aria-hidden="true" />

        <div className={styles.curtainCopy}>
          <p className={styles.curtainKicker}>Cabinet four</p>
          <h1 className={styles.curtainTitle}>The Merchant&rsquo;s Window</h1>
          <p className={styles.curtainProse}>
            You run a small shop. The day is done and one lamp is still on over the counter.
          </p>
          <p className={styles.curtainProse}>
            A customer paid a deposit for a custom order. The message on the payment carries the
            order reference {DEPOSIT_MEMO}. Your supplier will not release the materials until
            someone can see that the money really arrived.
          </p>
          <p className={styles.curtainTeach}>
            You hold a viewing key for the shop account. It lets a person read what the account
            received. It cannot spend a single coin. Tonight you decide how much of it to show.
          </p>
        </div>

        <div
          className={styles.openWrap}
          onPointerDown={() => {
            /* a press on the button's own spot before it ignites both arms it
               and opens, so the first press is never lost */
            if (!ready && !opening) {
              setReady(true);
              open();
            }
          }}
        >
          <button type="button" className={styles.openBtn} data-on={ready} onClick={open}>
            Open
          </button>
        </div>
      </div>

      {/* ---------------- the room ---------------- */}
      <div className={styles.stageWrap}>
        <div className={styles.stage} data-lit={rowsOpen ? "wide" : "narrow"}>
          <div className={styles.backWall} aria-hidden="true" />

          {/* the supplier's window, part of the shop from the first beat */}
          <WindowPane
            mode={windowMode}
            receipts={receipts}
            deposit={deposit}
            proof={depositProof}
            proofLoad={proofLoad}
            proofError={proofError}
            address={win?.address ?? ""}
          />

          <div className={styles.cone} aria-hidden="true" />
          <div className={styles.lamp}>
            <Lamp />
          </div>
          <div className={styles.pool} aria-hidden="true" />

          {/* the auditor, across the counter, holding the letter */}
          <div className={styles.auditor}>
            <Auditor />
          </div>

          {/* the counter */}
          <div className={styles.counter} aria-hidden="true">
            <div className={styles.counterTop} />
            <div className={styles.counterLip} />
            <div className={styles.counterFace}>
              <span className={styles.scratch} style={{ left: "12%", top: "26%", width: "18%" }} />
              <span className={styles.scratch} style={{ left: "44%", top: "58%", width: "12%" }} />
              <span className={styles.scratch} style={{ left: "66%", top: "34%", width: "9%" }} />
            </div>
          </div>

          {/* your slip: the order the deposit pays for */}
          <div className={styles.slip}>
            <p className={styles.slipName}>CUSTOM ORDER</p>
            <div className={styles.slipRule} />
            <div className={styles.slipLine}>
              <span>Reference</span>
              <span className={styles.slipRef}>{DEPOSIT_MEMO}</span>
            </div>
            <div className={styles.slipLine}>
              <span>Deposit</span>
              <span className={styles.slipAmount}>1,000 zat</span>
            </div>
            <p className={styles.slipFoot}>Paid into your shop account, sealed.</p>
          </div>

          {/* the till: the key will not turn here */}
          <div className={styles.till}>
            <div className={styles.tillTop} />
            <div className={styles.tillDrawer} data-open={tried}>
              <span className={styles.tillPull} />
            </div>
            <span className={styles.tillPlate}>TILL</span>
          </div>

          {/* the till's lock plate, staged below the key so the bow settles
              over it: a key that is home in the lock, not laid beside it */}
          <div className={styles.tillHoleCap} aria-hidden="true">
            <Keyhole size={22} />
          </div>

          {/* the record board: your account's incoming side, as the chain holds it.
              The head sits above the panel like a sign; the panel holds the rows. */}
          <div className={styles.boardWrap}>
            <div className={styles.boardHead}>
              <span className={styles.boardName}>Your record</span>
              <span className={styles.boardNote}>one account, incoming</span>
            </div>

            <div className={styles.board}>
            {winLoad === "error" ? (
              <p className={styles.boardNote2}>
                {winError} Nothing here is invented.{" "}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setWinLoad("idle");
                    setWinError("");
                    void loadWindow();
                  }}
                >
                  Try again
                </button>
              </p>
            ) : winLoad !== "done" ? (
              <p className={styles.boardNote2}>Reading the shop account from the chain. One moment.</p>
            ) : count === 0 ? (
              <p className={styles.boardNote2}>
                No payment has landed in this account yet, so there is nothing to show.
              </p>
            ) : (
              <ul className={styles.rows}>
                {receipts.map((row, index) => {
                  const lit = index < litCount;
                  const isDeposit = row.memo === DEPOSIT_MEMO;
                  return (
                    <li
                      key={`${row.txid}:${row.outputIndex}`}
                      className={styles.row}
                      data-state={lit ? "lit" : "sealed"}
                      data-deposit={isDeposit}
                    >
                      <div className={styles.rowHead}>
                        <span className={styles.rowLabel}>
                          {isDeposit ? "The deposit" : "Another payment"}
                        </span>
                        <span className={styles.rowTag} data-on={lit}>
                          {lit ? (isDeposit ? "the one they asked about" : "same account") : ""}
                        </span>
                      </div>
                      <div className={styles.rowBody}>
                        <div className={styles.facts}>
                          <div className={styles.factLine}>
                            <span className={styles.factAmount}>{amountInWords(row.zatoshis)}</span>
                            <span className={styles.factPayer}>{WHO_PAID_SEALED}</span>
                          </div>
                          <div className={styles.factMeta}>
                            {`${addressInWords(win?.address ?? row.txid)} · block ${row.block}`}
                          </div>
                          <div className={styles.factMeta}>
                            {blockTimeInWords(row.blockTime)}
                            <span className={styles.factMemo}> · {memoInWords(row.memo)}</span>
                          </div>
                        </div>
                        <div className={styles.bars} aria-hidden="true">
                          <span className={styles.redact} style={{ width: "46%" }} />
                          <span className={styles.redact} style={{ width: "74%" }} />
                          <span className={styles.sealLine}>
                            <SealMark />
                            <span>Sealed. No key turned yet.</span>
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* the sealed boundary below the gold rows: what this key never covers */}
            <div className={styles.outStrip} data-on={rowsOpen} aria-hidden={!rowsOpen}>
              <SealMark />
              <span>Money going out: this key cannot see it.</span>
            </div>

            <div className={styles.boardFoot}>
              <span className={styles.slot}>
                <Keyhole />
                Keyhole
              </span>
              <span className={styles.boardVerdict} data-on={rowsOpen}>
                {rowsOpen ? "This is everything the key shows." : ""}
              </span>
            </div>
            </div>
          </div>

          <div className={styles.keyFlare} data-on={turned} aria-hidden="true" />

          {/* the key, travelling between the wood, the record and the till */}
          <div
            className={styles.key}
            data-at={keyAt}
            data-turned={turned}
            data-refuse={beat === "boundary"}
            aria-hidden="true"
          >
            <Key />
          </div>

          <div className={styles.vignette} aria-hidden="true" />

          {/* beat 4: three cards laid on the counter */}
          {beat === "choice" ? (
            <div className={styles.cards} role="group" aria-label="How much do you show the auditor?">
              <p className={styles.cardsPrompt}>How much of your record do you hand over?</p>
              <div className={styles.cardRow}>
                <button type="button" className={styles.card} onClick={() => choose("key")}>
                  <span className={styles.cardTitle}>Hand over the key</span>
                  <span className={styles.cardLine}>
                    They can read every payment that ever comes into this account. Sharing it is
                    permanent.
                  </span>
                </button>
                <button type="button" className={styles.card} onClick={() => choose("note")}>
                  <span className={styles.cardTitle}>Hand over one sealed note</span>
                  <span className={styles.cardLine}>
                    They see one payment proved against the chain, and nothing else.
                  </span>
                </button>
                <button type="button" className={styles.card} onClick={() => choose("nothing")}>
                  <span className={styles.cardTitle}>Hand over nothing</span>
                  <span className={styles.cardLine}>
                    They take your word. No record and no proof leaves the shop.
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {/* beat 6: the balance question, laid over the room */}
          {beat === "balance" ? (
            <div className={styles.ask}>
              <div className={styles.askCard}>
                <p className={styles.askQ}>How much is left in the account?</p>
                <p className={styles.askWho}>
                  The auditor asks one last thing before the night closes.
                </p>
                <p className={styles.askLine}>{BALANCE_ANSWER}</p>
                <p className={styles.askTeach}>
                  The key shows the incoming side of one account. It never shows what went out, so it
                  can never give a full balance. That is a limit of the key, not a trick.
                </p>
              </div>
            </div>
          ) : null}

          {/* beat 7: the summary laid over the room, so the ending actions stay
              on the same screen as everything else in this cabinet */}
          {beat === "end" ? (
            <EndCard
              choice={choice}
              deposit={deposit}
              windowAddress={win?.address ?? ""}
              proof={depositProof}
              onRestart={restart}
              onReplay={replay}
            />
          ) : null}
        </div>
      </div>

      {/* ---------------- the band ---------------- */}
      {beat === "curtain" || beat === "end" ? null : (
        <div className={styles.band} aria-live="polite">
          <div className={styles.speech}>
            <p className={styles.speaker}>{SPEAKER}</p>
            {speechFor(beat, { rowsOpen, tried, choice }).lines.map((line) => (
              <p className={styles.line} key={line}>
                {line}
              </p>
            ))}
            {speechFor(beat, { rowsOpen, tried, choice }).teach ? (
              <p className={styles.teachLine}>{speechFor(beat, { rowsOpen, tried, choice }).teach}</p>
            ) : null}
          </div>

          <div className={styles.action}>
            {beat === "choice" ? (
              <span className={styles.waitNote}>Choose one card. None of them is wrong.</span>
            ) : (
              <button
                type="button"
                className={styles.btn}
                disabled={speechFor(beat, { rowsOpen, tried, choice }).waiting}
                onClick={advance}
              >
                {speechFor(beat, { rowsOpen, tried, choice }).button}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The auditor is the only voice. The supplier is never on screen (section 5). */
const SPEAKER = "The auditor";

type Speech = {
  lines: string[];
  teach?: string;
  button: string;
  /** true while the beat is still happening, so the action waits */
  waiting: boolean;
};

function speechFor(
  beat: Beat,
  state: { rowsOpen: boolean; tried: boolean; choice: Choice | null },
): Speech {
  switch (beat) {
    case "request":
      return {
        lines: [
          "Good evening. Your supplier sent me.",
          `A deposit came into your shop account for the custom order, reference ${DEPOSIT_MEMO}. Your supplier will not release the materials until we can see it landed.`,
          "How much of your book you show me is your call. Your key is on the counter beside your slip.",
        ],
        teach: "The key reads what this account received. It cannot move your money, and you never have to hand it over.",
        button: "Take the key",
        waiting: false,
      };
    case "preview":
      return state.rowsOpen
        ? {
            lines: [
              `There it is. One payment of one thousand zatoshis, reference ${DEPOSIT_MEMO}, at block 4543955. Another sits beside it. Both came into this one account.`,
            ],
            teach: "This is what the incoming viewing key shows: every payment that arrived, the amount, your address, the time, the block, and any message. It never shows who paid.",
            button: "Try the till",
            waiting: false,
          }
        : {
            lines: ["Turn the key in the record board. Not the till."],
            button: "Try the till",
            waiting: true,
          };
    case "boundary":
      return state.tried
        ? {
            lines: [
              "It does not turn. That is not a broken lock. That key can read your money. It cannot spend it.",
            ],
            teach: "Reading and spending are two separate secrets. This key holds only the reading one, so sharing it can never let anyone move a coin.",
            button: "Decide",
            waiting: false,
          }
        : {
            lines: ["Go on. Try the same key in your own till. Everybody does."],
            button: "Decide",
            waiting: true,
          };
    case "choice":
      return {
        lines: [
          "So. How much do you show me? The whole key, one payment proved, or nothing at all.",
          "None of these is the wrong answer. Each one leaves a different thing open.",
        ],
        button: "",
        waiting: false,
      };
    case "consequence":
      return consequenceSpeech(state.choice);
    case "balance":
      return {
        lines: ["One last thing before I go. How much is left in this account now? All of it."],
        button: "Finish",
        waiting: false,
      };
    default:
      return { lines: [], button: "", waiting: false };
  }
}

function consequenceSpeech(choice: Choice | null): Speech {
  if (choice === "key") {
    return {
      lines: [
        "Now anyone holding that key can look into this account, any time.",
        "Every payment that lands from tonight onward shows up in that same window. There is no way to close it again.",
      ],
      teach: "A viewing key is ongoing. Handing it over is permanent, and it still cannot spend.",
      button: "Continue",
      waiting: false,
    };
  }
  if (choice === "note") {
    return {
      lines: [
        "That proves one payment and nothing more. The amount, the address, the message and the block all went into a fingerprint the chain keeps, and the fingerprint matches.",
        "It says nothing about any other payment, and it hands over no key.",
      ],
      teach: "A single payment can be proved on its own, without giving away the key that reads the whole account.",
      button: "Continue",
      waiting: false,
    };
  }
  return {
    lines: [
      "Then I go back with your word and no record. No amount, no block, no proof.",
      "Some suppliers will take that. This one may not release the materials on it.",
    ],
    teach: "Showing nothing keeps every fact private. The cost is that the other side has nothing to check.",
    button: "Continue",
    waiting: false,
  };
}

/* ------------------------------------------------------------------ */
/* the supplier's window                                               */
/* ------------------------------------------------------------------ */

function WindowPane({
  mode,
  receipts,
  deposit,
  proof,
  proofLoad,
  proofError,
  address,
}: {
  mode: "dark" | "one" | "all";
  receipts: readonly Receipt[];
  deposit: Receipt | null;
  proof: Proof | null;
  proofLoad: Load;
  proofError: string;
  address: string;
}) {
  const lit = mode !== "dark";
  const visible = mode === "all" ? receipts : mode === "one" && deposit ? [deposit] : [];

  return (
    <div className={styles.window} data-mode={mode} role="img" aria-label={windowLabel(mode)}>
      <div className={styles.windowFrame} aria-hidden="true">
        <span className={styles.windowMullion} data-dir="v" />
        <span className={styles.windowMullion} data-dir="h" />
      </div>
      <div className={styles.windowGlass} aria-hidden={!lit} />
      <div className={styles.windowView}>
        {mode === "dark" ? (
          <p className={styles.windowDark}>The supplier&rsquo;s window is dark. Nothing to see.</p>
        ) : (
          <>
            <p className={styles.windowHead}>
              {mode === "all" ? "All the key shows" : "One payment, proved"}
            </p>
            <ul className={styles.windowRows}>
              {visible.map((row) => (
                <li className={styles.windowRow} key={`${row.txid}:${row.outputIndex}`}>
                  <span className={styles.windowAmount}>{amountInWords(row.zatoshis)}</span>
                  <span className={styles.windowMeta}>
                    {row.memo ?? "no message"} · block {row.block}
                  </span>
                </li>
              ))}
            </ul>
            {mode === "all" ? (
              <p className={styles.windowLink}>
                Every row shares one address: {addressInWords(address)}. They belong to one account.
              </p>
            ) : (
              <p className={styles.windowProof}>
                {proofLoad === "loading"
                  ? "Checking the payment against the chain. One moment."
                  : proofLoad === "error"
                    ? `${proofError} Nothing is claimed either way.`
                    : proofInWords(proof)}
              </p>
            )}
          </>
        )}
      </div>
      <div className={styles.windowSpill} aria-hidden="true" />
    </div>
  );
}

function windowLabel(mode: "dark" | "one" | "all"): string {
  if (mode === "all") return "The supplier's window, lit, showing every payment the key can read.";
  if (mode === "one") return "The supplier's window, lit on one proved payment only.";
  return "The supplier's window, dark, showing nothing.";
}

/* ------------------------------------------------------------------ */
/* the end card (beat 7)                                               */
/* ------------------------------------------------------------------ */

function EndCard({
  choice,
  deposit,
  proof,
  onRestart,
  onReplay,
}: {
  choice: Choice | null;
  deposit: Receipt | null;
  windowAddress: string;
  proof: Proof | null;
  onRestart: () => void;
  onReplay: () => void;
}) {
  return (
    <div className={styles.end}>
      <div className={styles.endCard}>
        <div>
          <h2 className={styles.endTitle}>What your choice left open</h2>
          <p className={styles.endChoice}>{revealedLine(choice)}</p>

          <p className={styles.endSubHead}>The three boundaries, whichever card you picked</p>
          <ol className={styles.endList}>
            <li>
              The key shows what arrived: the amount, your address, the message, the time and the
              block. It never names who paid.
            </li>
            <li>The key cannot spend. Reading and spending are separate secrets.</li>
            <li>
              The key shows one account&rsquo;s incoming side. It never shows money going out, other
              accounts, or a full balance. Sharing it is permanent.
            </li>
          </ol>

          <p className={styles.endMech}>
            A single payment can be proved on its own, without handing over the key that reads the
            whole account. That is the middle card, and it is a real feature of the chain, not a
            trick of this game.
          </p>
        </div>

        <div className={styles.endReceipt}>
          <p className={styles.endReceiptHead}>Your keepsake: the deposit</p>
          {deposit ? (
            <>
              <div className={styles.endReceiptRow}>
                <span>Paid</span>
                <span>{amountInWords(deposit.zatoshis)}</span>
              </div>
              <div className={styles.endReceiptRow}>
                <span>Reference</span>
                <span>{memoInWords(deposit.memo)}</span>
              </div>
              <div className={styles.endReceiptRow}>
                <span>Transaction</span>
                <span>{shortTx(deposit.txid)}</span>
              </div>
              <div className={styles.endReceiptRow}>
                <span>Block</span>
                <span>{deposit.block}</span>
              </div>
              {choice === "note" && proof ? (
                <div className={styles.endReceiptRow}>
                  <span>Checked</span>
                  <span>{proofInWords(proof)}</span>
                </div>
              ) : null}
              <a
                className={styles.endLink}
                href={explorerUrl(deposit.txid)}
                target="_blank"
                rel="noreferrer"
              >
                Open it on the explorer and check the shop yourself
              </a>
              <p className={styles.endNote}>
                This is a real testnet payment into a real account. The explorer link opens the same
                transaction on the public record.
              </p>
            </>
          ) : (
            <p className={styles.endNote}>
              No deposit was read back from the chain, so there is no keepsake to show. Nothing here
              is invented.
            </p>
          )}

          <div className={styles.endActions}>
            <button type="button" className={styles.btn} onClick={onRestart}>
              Play it again
            </button>
            <button type="button" className={styles.btnGhost} onClick={onReplay}>
              Back to the curtain
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function revealedLine(choice: Choice | null): string {
  if (choice === "key") {
    return "You handed over the key. Your supplier can now read every payment that arrives in this account, for good, and still cannot spend any of it.";
  }
  if (choice === "note") {
    return "You proved one payment. Your supplier saw the amount, the address, the message and the block for the deposit alone, checked against the chain, and learned nothing about the rest.";
  }
  return "You handed over nothing. Your supplier left with no amount, no block and no proof, only your word that the deposit arrived.";
}
