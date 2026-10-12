"use client";

import { useEffect, useState } from "react";
import { Watcher } from "@/components/watcher";
import { MotionToggle, useMotionPref } from "@/components/motion-pref";
import { PublicPanel } from "./public-panel";
import {
  AFTER_HIDDEN_LINE,
  POOL_LATER,
  ROUNDS,
  metGoal,
  type Branch,
  type PublicFacts,
} from "@/lib/unseen";

/**
 * The reveal (Layer 5, D-044): the climax of a round, staged exactly like the
 * sample the owner approved.
 *
 * Two panels and a hinge. Your side holds what the round asked and the call
 * you made, written as a margin note rather than a badge. The Watcher stands
 * on the divider: alert and lit when the payment is readable, blind and dim
 * when you hid it. The stranger's panel reads itself out one shuttered row at
 * a time, and only after the record has been read does the twist line land.
 * The sequence IS the lesson: the truth arrives last and loudest.
 *
 * All of it is driven by facts the server read back off the chain. Motion
 * level comes from the page's motion preference (D-045); under "less" the
 * finished state simply appears, with the same words and the same meaning.
 */

/** The twist line lands after the last shutter has finished sliding. */
const TWIST_AT_MS = 3500;

export function Reveal({
  index,
  choice,
  amountTaz,
  facts,
  txid,
  explorerUrl,
  landed,
  block,
  confirmations,
  onNext,
}: {
  index: number;
  choice: Branch;
  amountTaz: string;
  facts: PublicFacts;
  txid: string;
  explorerUrl: string;
  landed: boolean;
  block: number | null;
  confirmations: number;
  onNext: () => void;
}) {
  const { reduced } = useMotionPref();
  const round = ROUNDS[index];
  const hidden = choice === "hide";
  const met = metGoal(round, choice);
  const last = index >= ROUNDS.length - 1;
  const teach = hidden ? (round.teachHidden ?? round.teachOpen) : round.teachOpen;

  const [twist, setTwist] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => setTwist(true), TWIST_AT_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);
  // Derived, never set in an effect: switching to "less" mid-reveal shows the
  // finished state immediately.
  const twistOn = twist || reduced;

  return (
    <div className="gm-root">
      <header className="gm-marquee">
        <div className="gm-brand">
          <span className="gm-wordmark">ZARCADE</span>
          <span className="gm-brandDiv" aria-hidden="true" />
          <span className="gm-gameName">Unseen</span>
        </div>
        <div className="gm-marqueeRight">
          <div className="gm-roundChip">
            <span>{round.label}</span>
            <span className="gm-chipDiv" aria-hidden="true" />
            <span className="gm-roundTitle">{round.title}</span>
          </div>
          <MotionToggle />
        </div>
      </header>

      <main className="gm-stage">
        <section className="gm-panel" aria-label="Your side">
          <p className="gm-eyebrow">Your side</p>

          <div className="gm-goalCard">
            <p className="gm-goalLabel">The round asked</p>
            <p className="gm-goalText">{round.goal}</p>
          </div>

          <p className="gm-amountLabel">You sent</p>
          <p className="gm-amount">
            {amountTaz} <span className="gm-amountUnit">TAZ</span>
          </p>
          <p className="gm-amountSub">
            A tiny practice amount, sent for real on the Zcash test network.
          </p>

          {/* the decision, as a note in the margin. Never a badge. */}
          <div className="gm-callNote">
            <span className="gm-callRule" aria-hidden="true" />
            <div className="gm-callBody">
              <p className="gm-callLabel">Your call</p>
              <p className="gm-callChoice">
                <SealGlyph open={!hidden} />
                {hidden ? (
                  <>
                    You kept it <span className="gm-shadowWord">hidden</span>
                  </>
                ) : (
                  <>
                    You left it <span className="gm-litWord">open</span>
                  </>
                )}
              </p>
              <p className="gm-callSub">
                {met
                  ? "That is exactly what this round asked for."
                  : "This round asked for the other choice."}
              </p>
            </div>
          </div>
        </section>

        <div className="gm-hinge">
          <span className="gm-hingeLine" aria-hidden="true" />
          <Watcher mood={hidden ? "blind" : "alert"} />
        </div>

        <PublicPanel
          facts={facts}
          txid={txid}
          explorerUrl={explorerUrl}
          amountTaz={amountTaz}
          landed={landed}
          block={block}
          confirmations={confirmations}
          poolName={POOL_LATER}
        />
      </main>

      <section className="gm-caption" aria-label="What this round taught">
        <h2 className="gm-twist" data-on={twistOn}>
          {hidden ? (
            <>
              You paid <span className="gm-shadowWord">in the dark</span>.
              <br />
              The record shows a payment happened and{" "}
              <span className="gm-shadowWord">nothing more</span>.
            </>
          ) : (
            <>
              You paid <span className="gm-litWord">in the open</span>.
              <br />
              The record still does not say <span className="gm-shadowWord">who paid</span>.
            </>
          )}
        </h2>
        <p className="gm-teach" data-on={twistOn}>
          {teach}
          {!landed && " The payment is on its way into a block."}
        </p>
        {hidden && (
          <p className="gm-teach" data-on={twistOn}>
            {AFTER_HIDDEN_LINE}
          </p>
        )}
      </section>

      <footer className="gm-actions">
        <button type="button" className="gm-btnPrimary" onClick={onNext}>
          {last ? "See how you did" : `Go to round ${index + 2}`}
        </button>
        {!landed && (
          <p className="gm-callSub">
            You do not have to wait for it. The payment is already broadcast and the network will
            agree on it in its own time. The link above shows the real record either way.
          </p>
        )}
      </footer>
    </div>
  );
}

/**
 * The choice made physical, exactly as approved in the sample. A wax seal that
 * was never pressed: the ring is broken open at the top with a speck of light
 * where the gap is, because "open" is the gold, public thing in this world.
 * The pressed version fills in with cool shadow for the hidden rounds.
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
