import type { Metadata } from "next";
import { WorldPreview } from "@/components/world-preview";

export const metadata: Metadata = {
  title: "A first look at the game",
  description:
    "Send a friend 5 ZEC and choose how much of it the network gets to see. A first look at Unseen, the first game.",
};

export default function PreviewPage() {
  return <WorldPreview />;
}
