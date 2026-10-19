/**
 * The Proof Puzzle (cabinet three), the honest kernel of it: what the safe
 * says back, word for word.
 *
 * The fiction and the machine agree on one rule (D-108): the safe checks each
 * answer against the code inside it and says one word, open or shut. That word
 * is about the answer matching the code. It is never the button the player
 * pressed. A player who answers No and is right reads open; a player who
 * answers Yes and is wrong reads shut. The panel that shows these words is
 * named The Safe, so the reader knows who is speaking.
 *
 * Copy follows the Layer 4 voice (D-018): plain words, short sentences, no em
 * dashes, grandma-readable.
 */

/** One yes-or-no question the Watcher asks, with the true answer for the
 *  player's own code. The truth lives in the safe and never leaves it. */
export interface ProofQuestion {
  text: string;
  answer: boolean;
}

/** The only two words the safe ever says. */
export type SafeReply = "open" | "shut";

/** The name of the panel that carries the safe's answers (D-108). Elsewhere
 *  the panel is the running record; here it is the safe, because here the
 *  safe is the one speaking. */
export const PROOF_RECORD_LABEL = "The Safe";

/** What the safe says about one answer: open when it matched the code inside,
 *  shut when it did not. The player's button is not the reply. */
export function safeReply(matched: boolean): SafeReply {
  return matched ? "open" : "shut";
}

/** The record the safe keeps, one line per question: unasked questions read
 *  as a dash, asked ones read the safe's own reply about the match. */
export function proofRecord(
  questions: readonly ProofQuestion[],
  answers: readonly boolean[],
): { label: string; note: string }[] {
  return questions.map((q, i) => {
    const given = answers[i];
    return {
      label: q.text,
      note: given === undefined ? "—" : safeReply(q.answer === given),
    };
  });
}
