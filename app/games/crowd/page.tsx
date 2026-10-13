import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { Crowd } from "@/components/game/crowd";

export const metadata: Metadata = {
  title: "The Crowd",
  description:
    "Hold the arcade's complete public record book and learn how much a stranger can read.",
};

export default function CrowdPage() {
  return (
    <MotionPrefProvider>
      <Crowd />
    </MotionPrefProvider>
  );
}
