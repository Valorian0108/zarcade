import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { Proof } from "@/components/game/proof";

export const metadata: Metadata = {
  title: "The Proof Puzzle",
  description:
    "Prove you know a secret without saying it, and watch a private payment move.",
};

export default function ProofPage() {
  return (
    <MotionPrefProvider>
      <Proof />
    </MotionPrefProvider>
  );
}
