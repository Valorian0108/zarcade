"use client";

import { shortenAddress } from "@/lib/zcash/format";
import { leakedParts, sentenceCase, type PublicFacts } from "@/lib/unseen";

/**
 * What a stranger can see (B5).
 *
 * Everything in here came back from the chain through the server. Nothing is
 * inferred from which button was pressed, and nothing is decorated: if a fact was
 * not reported, it is not shown. The link at the bottom goes to the public block
 * explorer so a player can check this panel against the real record and find the
 * panel is telling the truth. That is the honesty line from ARCHITECTURE.md, and
 * it is the reason this panel exists at all.
 *
 * The monospace face is reserved for actual on-chain data, never for labels
 * (Layer 3 amendment 2). Players learn to tell the machine's own words from the
 * game's dressing by font alone.
 */
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
  const exposed = new Set(leakedParts(facts));
  const sealed = "Sealed. Not on the public list.";

  const rows: { label: string; value: string; mono: boolean }[] = [
    {
      label: "Who paid",
      value: exposed.has("who paid") ? "The arcade's wallet" : sealed,
      mono: false,
    },
    {
      label: "Who got paid",
      value: exposed.has("who got paid")
        ? facts.recipient
          ? shortenAddress(facts.recipient)
          : "An open address"
        : `${sentenceCase(poolName)}. The address itself is not shown.`,
      mono: exposed.has("who got paid") && facts.recipient !== null,
    },
    {
      label: "How much",
      value: exposed.has("how much") ? `${amountTaz} TAZ` : sealed,
      mono: exposed.has("how much"),
    },
    {
      label: "The note",
      value: exposed.has("the note")
        ? "Readable by anyone"
        : facts.notePossible
          ? sealed
          : "There is no note. An open payment cannot carry one.",
      mono: false,
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">What a stranger can see</p>

      <dl className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4">
            <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
            <dd
              className={
                "min-w-0 text-right text-sm leading-5 " +
                (row.mono ? "font-mono " : "") +
                (exposed.size === 0 ? "text-valid" : "text-foreground")
              }
            >
              <span className="break-all">{row.value}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 space-y-2 border-t border-border pt-3.5">
        <div className="flex items-start justify-between gap-4">
          <span className="shrink-0 text-xs text-muted-foreground">Transaction</span>
          <span className="min-w-0 text-right font-mono text-xs leading-5 text-foreground">
            <span className="break-all">{`${txid.slice(0, 16)}...${txid.slice(-8)}`}</span>
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <span className="shrink-0 text-xs text-muted-foreground">Block</span>
          {landed && block !== null ? (
            <span className="text-right font-mono text-xs leading-5 text-valid">
              {block}
              {confirmations > 1 && (
                <span className="font-sans text-muted-foreground">
                  {`, ${confirmations} blocks deep`}
                </span>
              )}
            </span>
          ) : (
            <span className="text-right text-xs leading-5 text-muted-foreground">
              Not in a block yet. The network is still agreeing on it.
            </span>
          )}
        </div>

        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block pt-1 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors hover:decoration-primary focus-visible:underline"
        >
          Check it on the public record
        </a>
      </div>
    </div>
  );
}
