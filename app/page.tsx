import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { Door } from "@/components/hub/door";

export const metadata: Metadata = {
  description:
    "An arcade that teaches Zcash. Every machine is a small game about one privacy feature, played with real practice money on the Zcash test network.",
};

export default function HomePage() {
  return (
    <MotionPrefProvider>
      <Door />
    </MotionPrefProvider>
  );
}
