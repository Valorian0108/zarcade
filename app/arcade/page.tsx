import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { Floor } from "@/components/hub/floor";

export const metadata: Metadata = {
  title: "The arcade floor",
  description:
    "Pick a machine. Each game teaches one way Zcash keeps payments private.",
};

export default function ArcadePage() {
  return (
    <MotionPrefProvider>
      <Floor />
    </MotionPrefProvider>
  );
}
