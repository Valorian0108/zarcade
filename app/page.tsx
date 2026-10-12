import type { Metadata } from "next";
import { Hub } from "@/components/hub/hub";

export const metadata: Metadata = {
  description:
    "A small arcade that teaches how Zcash keeps payments private. Each game shows one idea by letting you play it.",
};

export default function HomePage() {
  return <Hub />;
}
