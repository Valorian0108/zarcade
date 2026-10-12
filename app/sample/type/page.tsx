import type { Metadata } from "next";
import { Newsreader, Space_Grotesk } from "next/font/google";
import { LEAK_PARTS, ROUNDS } from "@/lib/unseen";
import "@/components/game/game.css";
import "./type-sample.css";

/**
 * Throwaway type specimen for the prose-voice decision (candidate D-047).
 * Same pattern as /sample: no money moves here, nothing on this page is the
 * product. It exists so the owner can pick the teaching voice by looking at
 * the real game copy in the real composition, three ways.
 */

// Candidate 1: storyteller serif.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--ts-serif",
  weight: ["400", "500", "600"],
});

// Candidate 2: machine grotesk.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--ts-grotesk",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Type specimen",
  description:
    "Three candidate prose voices for Zarcade, shown on the real game copy. A throwaway page for one decision.",
};

const DIRECTIONS = [
  {
    dir: "1",
    fontClass: newsreader.variable,
    kicker: "Direction 1",
    name: "Storyteller serif: Newsreader",
    why: "The teaching voice reads like the printed program inside an arcade cabinet. Warm and human next to the machine gold. Reference: Stripe Press books, newspaper dark modes.",
  },
  {
    dir: "2",
    fontClass: spaceGrotesk.variable,
    kicker: "Direction 2",
    name: "Machine grotesk: Space Grotesk",
    why: "The prose keeps the cabinet's techy energy. Every sentence reads like it came out of the same machine as the titles. Reference: arcade manuals from the 80s, teletype printouts.",
  },
  {
    dir: "3",
    fontClass: "",
    kicker: "Direction 3",
    name: "All Syne, tuned for reading",
    why: "One family everywhere, the first option you raised. The prose is Syne at lighter weight, a bigger size and wider line spacing so paragraphs stay readable. Maximum unity. Judge the reading cost with your own eyes.",
  },
] as const;

/** One full specimen: the real brief screen on the left, the real record
    panel on the right, the real teaching caption below. Identical in all
    three directions; only the prose family changes. */
function Specimen() {
  return (
    <>
      <main className="ts-stage">
        <section className="gm-panel" aria-label="Your side">
          <p className="gm-eyebrow">Round 2 of 3</p>
          <p className="gm-callChoice" style={{ marginBottom: 12 }}>
            {ROUNDS[1].title}
          </p>

          <div className="gm-goalCard">
            <p className="gm-goalLabel">The ask</p>
            <p className="gm-goalText">{ROUNDS[1].goal}</p>
          </div>

          <p role="status" className="gm-notice" data-tone="wait" style={{ margin: "0 0 24px" }}>
            The arcade is refilling its coins. Please wait a few minutes and try this round again.
          </p>

          <div
            className="gm-actions"
            style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}
          >
            <button type="button" className="gm-btnPrimary">
              Hide it
            </button>
            <button type="button" className="gm-btnGhost">
              Do not hide it
            </button>
          </div>
        </section>

        <section className="gm-panel gm-publicPanel" aria-label="The running record">
          <p className="gm-eyebrow">The running record</p>
          <p className="gm-recordText">One real payment landed. The chain says:</p>

          <div className="gm-receipt">
            <span>Round 1 · hidden</span>
            <span className="gm-receiptDot" aria-hidden="true" />
            <span className="gm-mono">a4f9c210…7be38d5c</span>
            <span className="gm-receiptDot" aria-hidden="true" />
            <span>Block 3194552</span>
            <a className="gm-receiptLink" href="#">
              Check it on the explorer
            </a>
          </div>

          <div className="gm-readout">
            <div className="gm-pips" aria-hidden="true">
              {Array.from({ length: LEAK_PARTS.length }).map((_, i) => (
                <span key={i} className="gm-pip" data-lit={false} />
              ))}
            </div>
            <p className="gm-readoutText">
              Sealed: <strong>who paid, who got paid, how much</strong>
            </p>
          </div>
        </section>
      </main>

      <section className="gm-caption" aria-label="What this moment means">
        <p className="gm-teach" data-on={true}>
          {ROUNDS[0].teachHidden}
        </p>
        <p className="gm-teach" data-on={true}>
          The one thing to work out is when hiding helps and when it gets in the way. The rounds do
          not all want the same answer.
        </p>
      </section>
    </>
  );
}

export default function TypeSamplePage() {
  return (
    <div className="ts-page">
      <header className="ts-pageHead">
        <h1 className="ts-pageTitle">The prose voice: three directions</h1>
        <p className="ts-pageIntro">
          <strong style={{ color: "#edb64a" }}>
            Decided 2026-10-12: Direction 1 first (D-047), then the owner flipped the prose voice
            to Direction 2, Space Grotesk (D-049). Direction 2 is the prose voice of the arcade.
            This page stays up as the record of the pick.
          </strong>
        </p>
        <p className="ts-pageIntro">
          The lines like &ldquo;Keep a payment to yourself&rdquo; are Syne, and they stay Syne in
          all three directions. What changes below is every sentence that talks to you: the
          teaching caption, the round brief, the status line, the card text, the notices. Each
          direction shows the real game copy in the real layout. Read the caption paragraphs twice
          in each direction. The winner is the one you would happily read a whole paragraph of.
        </p>
        <p className="ts-constants">
          <span>Stays the same everywhere:</span>
          <span className="ts-chip">Syne titles and buttons</span>
          <span className="ts-chip">Mono receipts</span>
          <span className="ts-chip">Gold and shadow</span>
          <span className="ts-chip">The slot grammar</span>
        </p>
      </header>

      {DIRECTIONS.map((direction) => (
        <section
          key={direction.dir}
          className={`gm-root ts-dir ${direction.fontClass}`}
          data-dir={direction.dir}
          aria-label={direction.name}
        >
          <header className="ts-head">
            <p className="ts-kicker">{direction.kicker}</p>
            <h2 className="ts-name">{direction.name}</h2>
            <p className="ts-why">{direction.why}</p>
          </header>
          <Specimen />
        </section>
      ))}
    </div>
  );
}
