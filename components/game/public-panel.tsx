"use client";

import { useEffect, useState } from "react";
import { shortenAddress } from "@/lib/zcash/format";
import {
  LEAK_PARTS,
  leakedParts,
  sentenceCase,
  type PublicFacts,
} from "@/lib/unseen";
import { useMotionPref } from "@/components/motion-pref";

/**
 * What a stranger can see (B5), in the exact markup the owner approved in the
 * sample (D-044).
 *
 * Everything in here came back from the chain through the server. Nothing is
 * inferred from which button was pressed, and nothing is decorated: if a fact
 * was not reported, it is not shown. Each row starts behind a shutter that
 * slides off on a short stagger, so the record is READ rather than dumped.
 * Gold light falls on what the public can read; sealed things stay in cool
 * shadow. There is no red and no green.
 *
 * The link at the bottom goes to the public block explorer so a player can
 * check this panel against the real record and find it telling the truth. That
 * is the honesty line from ARCHITECTURE.md, and the reason this panel exists.
 *
 * The monospace face is reserved for actual on-chain data, never for labels.
 */

/** When each row's shutter slides (ms from mount), for the non-reduced path. */
const SCHEDULE_MS = [700, 1500, 2200, 2800];

type RowKind = "lit" | "sealed" | "none";

type Row = {
  label: string;
  kind: RowKind;
  tag: string;
  /** On-chain data, shown in mono. Only for lit rows. */
  value?: string;
  /** What the sealed bar says, for sealed rows. */
  sealText?: string;
  sub: string;
};

export function PublicPanel({
  facts,
  txid,
  explorerUrl,
  amountTaz,
  landed,
  block,
  confirmations,
  poolName,
}: {
  facts: PublicFacts;
  txid: string;
  explorerUrl: string;
  amountTaz: string;
  landed: boolean;
  block: number | null;
  confirmations: number;
  /** "Ironwood, the private pool" the first time, "the private pool" after (D-029). */
  poolName: string;
}) {
  const { reduced } = useMotionPref();
  const exposed = new Set(leakedParts(facts));
  /** -1 = every shutter down. Row i is open once step >= i. */
  const [step, setStep] = useState(-1);

  // Read the record one row at a time. Under "less" motion the finished state
  // renders immediately and the lesson still reads.
  useEffect(() => {
    if (reduced) return;
    const timers = SCHEDULE_MS.map((ms, i) => window.setTimeout(() => setStep(i), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduced]);

  const open = (i: number) => reduced || step >= i;

  const rows: Row[] = [
    exposed.has("who paid")
      ? {
          label: "who paid",
          kind: "lit",
          tag: "On the public list",
          value: "The arcade's wallet",
          sub: "The transaction names who sent it.",
        }
      : {
          label: "who paid",
          kind: "sealed",
          tag: "Sealed",
          sealText: "Sealed by the private pool",
          sub: "The coins came out of the private pool. The pool never says which of its users they came from.",
        },
    exposed.has("who got paid")
      ? {
          label: "who got paid",
          kind: "lit",
          tag: "On the public list",
          value: facts.recipient ? shortenAddress(facts.recipient) : "An open address",
          sub: "The transaction carries the full address.",
        }
      : {
          label: "who got paid",
          kind: "sealed",
          tag: "Sealed",
          sealText: sentenceCase(poolName),
          sub: "The address itself is not shown.",
        },
    exposed.has("how much")
      ? {
          label: "how much",
          kind: "lit",
          tag: "On the public list",
          value: `${amountTaz} TAZ`,
          sub: "A tiny amount, but the number itself is public.",
        }
      : {
          label: "how much",
          kind: "sealed",
          tag: "Sealed",
          sealText: "Sealed",
          sub: "How much moved is not on the public list.",
        },
    exposed.has("the note")
      ? {
          label: "the note",
          kind: "lit",
          tag: "On the public list",
          value: "Readable by anyone",
          sub: "Anyone can read the note that rode along.",
        }
      : facts.notePossible
        ? {
            label: "the note",
            kind: "sealed",
            tag: "Sealed",
            sealText: "Sealed",
            sub: "A note rode along, but it is sealed shut.",
          }
        : {
            label: "the note",
            kind: "none",
            tag: "Nothing exists",
            sub: "Open payments cannot carry a note, so there is nothing here to see.",
          },
  ];

  return (
    <section className="gm-panel gm-publicPanel" aria-label="What a stranger can see">
      <p className="gm-eyebrow">What a stranger can see</p>

      <ul className="gm-rows">
        {rows.map((row, i) => (
          <li key={row.label} className="gm-row" data-state={open(i) ? row.kind : "covered"}>
            <div className="gm-rowHead">
              <span className="gm-rowLabel">{row.label}</span>
              <span className="gm-rowTag" data-on={open(i)}>
                {row.tag}
              </span>
            </div>
            <div className="gm-rowBody">
              {row.sealText ? (
                <span className="gm-sealBar">
                  <LockGlyph size={13} /> {row.sealText}
                </span>
              ) : null}
              {row.value ? <span className="gm-rowValue">{row.value}</span> : null}
              <span className="gm-rowSub">{row.sub}</span>
              <div className="gm-cover" aria-hidden="true">
                <span className="gm-coverSeam" />
                <LockGlyph size={16} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="gm-readout">
        <div className="gm-pips" aria-hidden="true">
          {rows.map((row, i) => (
            <span key={row.label} className="gm-pip" data-lit={open(i) && row.kind === "lit"} />
          ))}
        </div>
        <p className="gm-readoutText">
          The public learned{" "}
          <strong>
            {exposed.size} of {LEAK_PARTS.length}
          </strong>{" "}
          things.
        </p>
      </div>

      <div className="gm-receipt">
        <span className="gm-mono">{`${txid.slice(0, 8)}…${txid.slice(-8)}`}</span>
        <span className="gm-receiptDot" aria-hidden="true" />
        {landed && block !== null ? (
          <span>
            Block {block}
            {confirmations > 1 && ` · ${confirmations} deep`}
          </span>
        ) : (
          <span>Not in a block yet</span>
        )}
        <a className="gm-receiptLink" href={explorerUrl} target="_blank" rel="noreferrer">
          Check it on the explorer
        </a>
      </div>
    </section>
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
