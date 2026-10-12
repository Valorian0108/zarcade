"use client";

import type { ReactNode } from "react";
import { Watcher, type WatcherMood } from "@/components/watcher";
import { MotionToggle } from "@/components/motion-pref";

/**
 * The shared game frame (A5, D-021), rebuilt line for line in the system the
 * owner approved in the sample (D-044). Every screen wears the same skin:
 *
 *   1. banner   — the one-line teach, quiet at the very top.
 *   2. marquee  — the gold ZARCADE wordmark, the game name in Syne, the round
 *                 chip and the motion question on the right.
 *   3. caption  — the teaching prose, ABOVE the stage (D-052): teach first,
 *                 then show the objects and the choices.
 *   4. stage    — two panels and a hinge. The left panel holds the moment
 *                 (the ask, the choices, the waiting clock). The Watcher
 *                 stands on the divider. The right panel is the running
 *                 record: what just happened, the pips, the receipts.
 *
 * The frame is PRESENTATIONAL only. Game logic lives in each game (Phase B);
 * it passes its current mood, chip, description and receipts down as props.
 *
 * There is no red and no green. A lit pip means "on the public list", the same
 * gold the rest of the site uses for that, never a verdict.
 */

export type FrameReceipt = {
  /** Shown first, e.g. "Round 1". */
  label: string;
  txid: string;
  block: number | null;
  url: string;
};

const LEAK_PARTS = 4;

export function GameFrame({
  title,
  teach,
  chip,
  panelLabel,
  watcherMood,
  leak,
  leakLabel,
  description,
  showLeakMeter = true,
  receipts = [],
  caption,
  children,
}: {
  title: string;
  teach: string;
  /** Round chip, e.g. ["Round 2 of 3", "Prove you paid"]. */
  chip: [string, string];
  /** Eyebrow for the left panel, e.g. "The ask". */
  panelLabel: string;
  watcherMood: WatcherMood;
  /** 0 = the public learned nothing, 1 = the public learned everything. */
  leak: number;
  leakLabel: string;
  description: string;
  /** Hide the pip readout (the summary screen shows receipts instead). */
  showLeakMeter?: boolean;
  /** Real payments so far, each with its explorer link. */
  receipts?: FrameReceipt[];
  /** The teaching prose, below the stage (D-046). Two short paragraphs max. */
  caption?: ReactNode;
  children: ReactNode;
}) {
  const litPips = Math.round(Math.min(1, Math.max(0, leak)) * LEAK_PARTS);

  return (
    <div className="gm-root">
      <p className="gm-banner">{teach}</p>

      <header className="gm-marquee">
        <div className="gm-brand">
          <span className="gm-wordmark">ZARCADE</span>
          <span className="gm-brandDiv" aria-hidden="true" />
          <span className="gm-gameName">{title}</span>
        </div>
        <div className="gm-marqueeRight">
          <div className="gm-roundChip">
            <span>{chip[0]}</span>
            <span className="gm-chipDiv" aria-hidden="true" />
            <span className="gm-roundTitle">{chip[1]}</span>
          </div>
          <MotionToggle />
        </div>
      </header>

      {/* the caption slot (D-046, moved above the stage by D-052): the single
          teaching place, read before any object or choice */}
      {caption ? (
        <section className="gm-caption" aria-label="What this moment means">
          {caption}
        </section>
      ) : null}

      <main className="gm-stage">
        <section className="gm-panel" aria-label={panelLabel}>
          <p className="gm-eyebrow">{panelLabel}</p>
          {children}
        </section>

        <div className="gm-hinge">
          <span className="gm-hingeLine" aria-hidden="true" />
          <Watcher mood={watcherMood} />
        </div>

        <section className="gm-panel gm-publicPanel" aria-label="The running record">
          <p className="gm-eyebrow">The running record</p>
          <p className="gm-recordText">{description}</p>

          {receipts.map((receipt) => (
            <div className="gm-receipt" key={receipt.txid}>
              <span>{receipt.label}</span>
              <span className="gm-receiptDot" aria-hidden="true" />
              <span className="gm-mono">{`${receipt.txid.slice(0, 8)}…${receipt.txid.slice(-8)}`}</span>
              <span className="gm-receiptDot" aria-hidden="true" />
              {receipt.block !== null ? <span>Block {receipt.block}</span> : <span>Not in a block yet</span>}
              <a
                className="gm-receiptLink"
                href={receipt.url}
                target="_blank"
                rel="noreferrer"
              >
                Check it on the explorer
              </a>
            </div>
          ))}

          {showLeakMeter && (
            <div className="gm-readout">
              <div className="gm-pips" aria-hidden="true">
                {Array.from({ length: LEAK_PARTS }).map((_, i) => (
                  <span key={i} className="gm-pip" data-lit={i < litPips} />
                ))}
              </div>
              <p className="gm-readoutText">{leakLabel}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
