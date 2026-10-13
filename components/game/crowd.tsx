"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GameFrame, type FrameReceipt } from "@/components/game/frame";
import type { WatcherMood } from "@/components/watcher";
import { formatTaz } from "@/lib/zcash/format";
import {
  C2_TARGET_ZATOSHIS,
  C3_CHOICES,
  CROWD_COPY,
  CROWD_RECORDS,
  judgeFindOpen,
  judgePointAtAmount,
  judgeWhyOpen,
  LEAK_OPEN,
  LEAK_SEALED,
  shieldedRowsWithAmount,
  type CrowdRecord,
} from "@/lib/crowd";

/**
 * The Crowd (D-074): the stranger holds the arcade's complete record book
 * and learns how much of it they can read. Three challenges inside the
 * shared frame (A5): find the open row, fail to point at a sealed amount,
 * then say why the open row is open at all.
 *
 * The stage is the book: a row of hoods, the crowd, one per record, and a
 * line per record carrying only public metadata (txid, block, explorer
 * link) until its challenge reveals more. A searchlight sweeps the hoods
 * once per challenge; only the open hood ever lights up. Under "less"
 * motion the global rule stills the sweep and every fact stays readable.
 *
 * No money moves in this game. The payments it reads are real and already
 * mined; the book ships as static config (lib/crowd.ts).
 */

type Step =
  | "setup"
  | "c1"
  | "c1found"
  | "c2"
  | "c2reveal"
  | "c3"
  | "c3reveal"
  | "end";

function CrowdHood({ lit }: { lit: boolean }) {
  return <span className="gm-crowdHood" data-lit={lit} aria-hidden="true" />;
}

function RecordLine({
  record,
  lit,
  onPick,
}: {
  record: CrowdRecord;
  lit: boolean;
  onPick?: () => void;
}) {
  return (
    <li className="gm-crowdLine">
      <button
        type="button"
        className="gm-crowdPick"
        data-lit={lit}
        onClick={onPick}
        disabled={onPick === undefined}
      >
        <CrowdHood lit={lit} />
        <span className="gm-mono">{`${record.txid.slice(0, 8)}…${record.txid.slice(-6)}`}</span>
        <span className="gm-crowdMeta">
          {record.block !== null ? `block ${record.block}` : "landed"}
        </span>
      </button>
      <a className="gm-receiptLink" href={record.url} target="_blank" rel="noreferrer">
        explorer
      </a>
    </li>
  );
}

export function Crowd() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("setup");
  const [mood, setMood] = useState<WatcherMood>("calm");
  const [c1Line, setC1Line] = useState<string | null>(null);
  const [c2Tries, setC2Tries] = useState(0);
  const [c3Line, setC3Line] = useState<string | null>(null);
  const [found, setFound] = useState<CrowdRecord | null>(null);
  const flare = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (flare.current !== null) window.clearTimeout(flare.current);
    },
    [],
  );

  const openRecord = CROWD_RECORDS.find((r) => r.kind === "open") ?? null;
  const sealedRecords = CROWD_RECORDS.filter((r) => r.kind === "shielded");

  const pickC1 = (record: CrowdRecord) => {
    const result = judgeFindOpen(record.id);
    if (!result) return;
    if (result.outcome === "found") {
      setFound(result.record);
      setStep("c1found");
      return;
    }
    setC1Line(CROWD_COPY.c1Sealed);
  };

  const pickC2 = (record: CrowdRecord) => {
    if (!judgePointAtAmount(record.id)) return;
    setC2Tries((n) => n + 1);
  };

  const admit = () => {
    // You understood, and the public noticed: one lantern flare, then calm.
    setMood("alert");
    flare.current = window.setTimeout(() => setMood("calm"), 2100);
    setStep("c2reveal");
  };

  const pickC3 = (choiceId: string) => {
    const result = judgeWhyOpen(choiceId);
    if (!result) return;
    if (result.pass) {
      setStep("c3reveal");
      return;
    }
    setC3Line(CROWD_COPY.c3Wrong);
  };

  const receipts: FrameReceipt[] = CROWD_RECORDS.map((record) => ({
    label: record.kind === "open" ? "Open round" : "Shielded round",
    txid: record.txid,
    block: record.block,
    url: record.url,
  }));

  const stage = () => {
    switch (step) {
      case "setup":
        return (
          <>
            <div className="gm-goalCard">
              <p className="gm-goalLabel">The deal</p>
              <p className="gm-goalText">{CROWD_COPY.setupCard}</p>
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button type="button" className="gm-btnPrimary" onClick={() => setStep("c1")}>
                Open the record book
              </button>
            </div>
          </>
        );
      case "c1":
        return (
          <>
            <div className="gm-crowdRow" key="c1">
              {CROWD_RECORDS.map((record) => (
                <CrowdHood key={record.id} lit={false} />
              ))}
            </div>
            <ul className="gm-crowdList">
              {CROWD_RECORDS.map((record) => (
                <RecordLine key={record.id} record={record} lit={false} onPick={() => pickC1(record)} />
              ))}
            </ul>
            {c1Line ? <p className="gm-callSub">{c1Line}</p> : null}
          </>
        );
      case "c1found":
        return (
          <>
            <div className="gm-crowdRow" key="c1found">
              {CROWD_RECORDS.map((record) => (
                <CrowdHood key={record.id} lit={record.kind === "open"} />
              ))}
            </div>
            <ul className="gm-crowdList">
              {CROWD_RECORDS.map((record) => (
                <RecordLine key={record.id} record={record} lit={record.kind === "open"} />
              ))}
            </ul>
            {found ? (
              <div className="gm-goalCard gm-crowdFacts">
                <p className="gm-goalLabel">{CROWD_COPY.c1FactsLabel}</p>
                <p className="gm-goalText">
                  {CROWD_COPY.c1FactsAmount}{" "}
                  <span className="gm-mono">{formatTaz(found.amountZatoshis)} TAZ</span>
                </p>
                <p className="gm-goalText">{CROWD_COPY.c1FactsAddress}</p>
                <p className="gm-goalText">{CROWD_COPY.c1FactsSender}</p>
              </div>
            ) : null}
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button type="button" className="gm-btnGhost" onClick={() => setStep("c2")}>
                Next challenge
              </button>
            </div>
          </>
        );
      case "c2":
        return (
          <>
            <div className="gm-crowdRow" key="c2">
              {sealedRecords.map((record) => (
                <CrowdHood key={record.id} lit={false} />
              ))}
            </div>
            <ul className="gm-crowdList">
              {sealedRecords.map((record) => (
                <RecordLine key={record.id} record={record} lit={false} onPick={() => pickC2(record)} />
              ))}
            </ul>
            {c2Tries > 0 ? <p className="gm-callSub">{CROWD_COPY.c2Fail}</p> : null}
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              {c2Tries > 0 ? (
                <button type="button" className="gm-btnPrimary" onClick={admit}>
                  {CROWD_COPY.c2Admit}
                </button>
              ) : (
                <p className="gm-callSub">Pick a row, or say the true thing.</p>
              )}
            </div>
          </>
        );
      case "c2reveal":
        return (
          <>
            <div className="gm-goalCard">
              <p className="gm-goalLabel">What you pinned down</p>
              <p className="gm-goalText">{CROWD_COPY.c2Card}</p>
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button type="button" className="gm-btnGhost" onClick={() => setStep("c3")}>
                Next challenge
              </button>
            </div>
          </>
        );
      case "c3":
        return (
          <>
            <div className="gm-crowdRow" key="c3">
              {openRecord ? <CrowdHood lit /> : null}
            </div>
            <ul className="gm-crowdList">
              {C3_CHOICES.map((choice) => (
                <li className="gm-crowdLine" key={choice.id}>
                  <button
                    type="button"
                    className="gm-crowdPick gm-crowdChoice"
                    onClick={() => pickC3(choice.id)}
                  >
                    {choice.text}
                  </button>
                </li>
              ))}
            </ul>
            {c3Line ? <p className="gm-callSub">{c3Line}</p> : null}
          </>
        );
      case "c3reveal":
        return (
          <>
            <div className="gm-goalCard">
              <p className="gm-goalLabel">Both ends</p>
              <p className="gm-goalText">{CROWD_COPY.endOpen}</p>
              <p className="gm-goalText">{CROWD_COPY.endSealed}</p>
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button type="button" className="gm-btnGhost" onClick={() => setStep("end")}>
                See the book whole
              </button>
            </div>
          </>
        );
      case "end":
        return (
          <>
            <div className="gm-goalCard">
              <p className="gm-goalLabel">The book closes</p>
              <p className="gm-goalText">{CROWD_COPY.endOpen}</p>
              <p className="gm-goalText">{CROWD_COPY.endSealed}</p>
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              <button type="button" className="gm-btnPrimary" onClick={() => router.push("/arcade")}>
                Back to the arcade
              </button>
            </div>
          </>
        );
    }
  };

  const perStep: Record<
    Step,
    { chip: [string, string]; panelLabel: string; caption: string; description: string; leak: number; leakLabel: string }
  > = {
    setup: {
      chip: ["The Crowd", "The record book"],
      panelLabel: "The deal",
      caption: CROWD_COPY.setup,
      description: "The book is closed. Three challenges wait inside.",
      leak: LEAK_SEALED,
      leakLabel: "Nothing pinned down yet.",
    },
    c1: {
      chip: ["Challenge 1 of 3", "Find the open payment"],
      panelLabel: "The book",
      caption: CROWD_COPY.c1Brief,
      description: "You hold every record the arcade ever made. Nothing is kept from you.",
      leak: LEAK_SEALED,
      leakLabel: "Nothing pinned down yet.",
    },
    c1found: {
      chip: ["Challenge 1 of 3", "The open row"],
      panelLabel: "The book",
      caption: CROWD_COPY.c1Found,
      description: "The open row gave up its amount and its address. It still does not name a sender.",
      leak: LEAK_OPEN,
      leakLabel: "Two of four facts, on the one open row.",
    },
    c2: {
      chip: ["Challenge 2 of 3", "Point at the amount"],
      panelLabel: "The sealed rows",
      caption: CROWD_COPY.c2Brief,
      description: "The sealed rows give up when they landed and how many notes they carry. Nothing else.",
      leak: LEAK_SEALED,
      leakLabel: "Nothing pinned down yet.",
    },
    c2reveal: {
      chip: ["Challenge 2 of 3", "It cannot be known"],
      panelLabel: "The sealed rows",
      caption:
        shieldedRowsWithAmount(C2_TARGET_ZATOSHIS).length > 1
          ? `${CROWD_COPY.c2Reveal} ${CROWD_COPY.c2Every}`
          : CROWD_COPY.c2Reveal,
      description: "You held every record and you still could not point. That is what shielded means.",
      leak: LEAK_SEALED,
      leakLabel: "Zero. On the sealed rows, zero is the win.",
    },
    c3: {
      chip: ["Challenge 3 of 3", "Why is it open"],
      panelLabel: "The open row",
      caption: CROWD_COPY.c3Brief,
      description: "The open row is lit. One question left about it.",
      leak: LEAK_OPEN,
      leakLabel: "Two of four facts, on the one open row.",
    },
    c3reveal: {
      chip: ["Challenge 3 of 3", "Both ends"],
      panelLabel: "The open row",
      caption: CROWD_COPY.c3Reveal,
      description: "Privacy needs both ends. One open end and the trail shows.",
      leak: LEAK_OPEN,
      leakLabel: "Two of four facts, on the one open row.",
    },
    end: {
      chip: ["Done", "What you pinned down"],
      panelLabel: "The book closes",
      caption: `${CROWD_COPY.endLine} ${CROWD_COPY.endProse}`,
      description: "The book closes. The chain stays public.",
      leak: LEAK_OPEN,
      leakLabel: "Two of four facts, on the one open row.",
    },
  };

  const s = perStep[step];

  return (
    <GameFrame
      title="The Crowd"
      teach={CROWD_COPY.teach}
      chip={s.chip}
      panelLabel={s.panelLabel}
      watcherMood={mood}
      leak={s.leak}
      leakLabel={s.leakLabel}
      description={s.description}
      showLeakMeter={step !== "end"}
      receipts={step === "end" ? receipts : []}
      caption={<p>{s.caption}</p>}
    >
      {stage()}
    </GameFrame>
  );
}
