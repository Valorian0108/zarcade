"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { GameFrame, type FrameReceipt } from "@/components/game/frame";
import type { WatcherMood } from "@/components/watcher";
import { formatTaz } from "@/lib/zcash/format";
import {
  C3_CHOICES,
  CROWD_COPY,
  CROWD_RECORDS,
  judgeFindOpen,
  judgePointAtAmount,
  judgeWhyOpen,
  LEAK_OPEN,
  LEAK_SEALED,
  shuffled,
  type CrowdRecord,
} from "@/lib/crowd";

/**
 * The Crowd (D-074): the stranger holds the arcade's complete record book
 * and learns how much of it they can read. Three challenges inside the
 * shared frame (A5): find the open row, fail to point at a sealed amount,
 * then say why the open row is open at all.
 *
 * The stage is the book: a row of hoods, the crowd, one per record, and a
 * line per record carrying only a shortened id and its block until its
 * challenge reveals more; the explorer link joins only when the row's truth
 * does (D-096), so the hunt cannot be solved from outside the book. A
 * searchlight sweeps the hoods once per challenge; only the open hood ever
 * lights up. Feedback the room speaks arrives lit in gold (D-096), challenge
 * two springs its trap in two beats (a no that keeps hope, then the gotcha),
 * and challenge three shows the open row itself. Under "less" motion the
 * global rule stills all of it and every fact stays readable.
 *
 * No money moves in this game. The payments it reads are real and already
 * mined; the book arrives from the page, served from the wallet's live
 * ledger where it can and from the curated rows where history is thin
 * (D-093), and its order is shuffled once per visit (D-092).
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

/** The shape of the live book answer (D-093). Never trusted, always checked. */
type BookBody = { ok?: boolean; book?: CrowdRecord[] };

/**
 * One order per visit (D-092). The seed is drawn once per page load, on the
 * client only, through `useSyncExternalStore`: the server snapshot is null,
 * so the prerendered book keeps the canonical order and hydration stays
 * honest, and the client snapshot is stable for the whole load, so the
 * shuffled order never changes mid-playthrough. The seed is a UI detail,
 * never a secret.
 */
let visitSeed: number | null = null;

function readVisitSeed(): number {
  if (visitSeed === null) {
    visitSeed = Math.floor(Math.random() * 0xffffffff);
  }
  return visitSeed;
}

function readServerSeed(): null {
  return null;
}

function neverSubscribe(): () => void {
  return () => {};
}

function CrowdHood({ lit }: { lit: boolean }) {
  return <span className="gm-crowdHood" data-lit={lit} aria-hidden="true" />;
}

function RecordLine({
  record,
  lit,
  onPick,
  showLink = false,
}: {
  record: CrowdRecord;
  lit: boolean;
  onPick?: () => void;
  /** The explorer link arrives only once this row's truth is on the table
   *  (D-096): a live link during the hunt would solve challenge one from
   *  outside the book. Verification is deferred, never denied. */
  showLink?: boolean;
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
      {showLink ? (
        <a className="gm-receiptLink" href={record.url} target="_blank" rel="noreferrer">
          explorer
        </a>
      ) : null}
    </li>
  );
}

export function Crowd() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("setup");
  const [mood, setMood] = useState<WatcherMood>("calm");
  const [c1Line, setC1Line] = useState<string | null>(null);
  const [c2Picks, setC2Picks] = useState<readonly string[]>([]);
  const [c2Line, setC2Line] = useState<string | null>(null);
  const [c3Line, setC3Line] = useState<string | null>(null);
  const [found, setFound] = useState<CrowdRecord | null>(null);
  const flare = useRef<number | null>(null);
  // Where the playthrough is right now, readable from the ledger fetch when
  // it lands: the book may only swap while it is still closed.
  const stepRef = useRef<Step>("setup");

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(
    () => () => {
      if (flare.current !== null) window.clearTimeout(flare.current);
    },
    [],
  );

  // D-092: one order per visit. The server render and the first paint use
  // the canonical order, then React swaps in this visit's seed, and that
  // order holds still for the whole playthrough. The judges decide by id,
  // never by position, so the order is pure presentation.
  const seed = useSyncExternalStore<number | null>(
    neverSubscribe,
    readVisitSeed,
    readServerSeed,
  );

  // D-093: the live ledger swaps in once, quietly, while the book is still
  // closed. If the wallet is busy, the answer is malformed, or the player
  // has already opened the book, the curated rows stand and nothing about
  // the visit changes.
  const [liveBook, setLiveBook] = useState<readonly CrowdRecord[] | null>(null);
  useEffect(() => {
    let ignore = false;
    fetch("/api/game/crowd/book")
      .then((r) => (r.ok ? (r.json() as Promise<BookBody | null>) : null))
      .then((data) => {
        if (ignore) return;
        const rows = data?.book;
        if (
          Array.isArray(rows) &&
          rows.length === 3 &&
          rows.every(
            (r) =>
              typeof r.txid === "string" && (r.kind === "open" || r.kind === "shielded"),
          ) &&
          stepRef.current === "setup"
        ) {
          setLiveBook(rows);
        }
      })
      .catch(() => {
        // Deliberately quiet: the curated book stands.
      });
    return () => {
      ignore = true;
    };
  }, []);
  const book = liveBook ?? CROWD_RECORDS;

  const rows = useMemo(
    () => (seed === null ? book.slice() : shuffled(book, seed)),
    [book, seed],
  );
  const choices = useMemo(
    () => (seed === null ? C3_CHOICES.slice() : shuffled(C3_CHOICES, seed + 1)),
    [seed],
  );

  const openRecord = rows.find((r) => r.kind === "open") ?? null;
  const sealedRecords = rows.filter((r) => r.kind === "shielded");

  const pickC1 = (record: CrowdRecord) => {
    const result = judgeFindOpen(rows, record.id);
    if (!result) return;
    if (result.outcome === "found") {
      setFound(result.record);
      setStep("c1found");
      return;
    }
    setC1Line(CROWD_COPY.c1Sealed);
  };

  // Challenge two's trap (D-096), in the owner's two beats: the first sealed
  // row answers with a no that keeps hope alive, the second springs the
  // gotcha and the lantern flare. Re-clicking a row never advances a beat,
  // and once both are down the reveal is the only door left.
  const pickC2 = (record: CrowdRecord) => {
    if (!judgePointAtAmount(rows, record.id)) return;
    if (c2Picks.length >= 2) return;
    if (c2Picks.includes(record.id)) {
      setC2Line(CROWD_COPY.c2Same);
      return;
    }
    const next = [...c2Picks, record.id];
    setC2Picks(next);
    if (next.length === 1) {
      setC2Line(CROWD_COPY.c2First);
      return;
    }
    setC2Line(CROWD_COPY.c2Gotcha);
    setMood("alert");
    flare.current = window.setTimeout(() => setMood("calm"), 2100);
  };

  const pickC3 = (choiceId: string) => {
    const result = judgeWhyOpen(choiceId);
    if (!result) return;
    if (result.pass) {
      setStep("c3reveal");
      return;
    }
    // Every wrong answer is refuted with evidence the book itself holds
    // (D-096): the block answer dies on the sealed rows' own block numbers,
    // the tiny answer dies on challenge two's 1,000-zatoshi proof.
    setC3Line(
      result.choice.id === "block"
        ? CROWD_COPY.c3WrongBlock
        : result.choice.id === "tiny"
          ? CROWD_COPY.c3WrongTiny
          : CROWD_COPY.c3Wrong,
    );
  };

  const receipts: FrameReceipt[] = rows.map((record) => ({
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
              {rows.map((record) => (
                <CrowdHood key={record.id} lit={false} />
              ))}
            </div>
            <ul className="gm-crowdList">
              {rows.map((record) => (
                <RecordLine key={record.id} record={record} lit={false} onPick={() => pickC1(record)} />
              ))}
            </ul>
            <div role="status" aria-live="polite">
              {c1Line ? (
                <p key={c1Line} className="gm-callSub gm-msgIn">
                  {c1Line}
                </p>
              ) : null}
            </div>
          </>
        );
      case "c1found":
        return (
          <>
            <div className="gm-crowdRow" key="c1found">
              {rows.map((record) => (
                <CrowdHood key={record.id} lit={record.kind === "open"} />
              ))}
            </div>
            <ul className="gm-crowdList">
              {rows.map((record) => (
                <RecordLine
                  key={record.id}
                  record={record}
                  lit={record.kind === "open"}
                  showLink={record.kind === "open"}
                />
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
                <RecordLine
                  key={record.id}
                  record={record}
                  lit={false}
                  showLink
                  onPick={() => pickC2(record)}
                />
              ))}
            </ul>
            <div role="status" aria-live="polite">
              {c2Line ? (
                <p key={c2Line} className="gm-callSub gm-msgIn">
                  {c2Line}
                </p>
              ) : null}
            </div>
            <div className="gm-actions" style={{ margin: 0, padding: 0, marginTop: "auto", paddingTop: 22 }}>
              {c2Picks.length >= 2 ? (
                <button type="button" className="gm-btnPrimary" onClick={() => setStep("c2reveal")}>
                  See what that means
                </button>
              ) : (
                <p className="gm-callSub">Pick a row.</p>
              )}
            </div>
          </>
        );
      case "c2reveal":
        return (
          <>
            <div className="gm-goalCard gm-cardIn">
              <p className="gm-goalLabel">What just happened</p>
              <p className="gm-goalText">{CROWD_COPY.c2Reveal}</p>
              <p className="gm-goalText">{CROWD_COPY.c2Every}</p>
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
            {openRecord ? (
              <ul className="gm-crowdList gm-crowdListTight">
                <RecordLine record={openRecord} lit showLink />
              </ul>
            ) : null}
            <ul className="gm-crowdList">
              {choices.map((choice) => (
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
            <div role="status" aria-live="polite">
              {c3Line ? (
                <p key={c3Line} className="gm-callSub gm-msgIn">
                  {c3Line}
                </p>
              ) : null}
            </div>
          </>
        );
      case "c3reveal":
        return (
          <>
            <div className="gm-goalCard gm-cardIn">
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
      caption: `${CROWD_COPY.c2Gotcha} ${CROWD_COPY.c2Card}`,
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
