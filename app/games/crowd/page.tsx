import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { Crowd } from "@/components/game/crowd";

export const metadata: Metadata = {
  title: "The Crowd",
  description:
    "Hold three records from the arcade's recent history and learn how much a stranger can read.",
};

export default function CrowdPage() {
  return (
    <MotionPrefProvider>
      <Crowd />
    </MotionPrefProvider>
  );
}
