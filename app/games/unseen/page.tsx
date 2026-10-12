import type { Metadata } from "next";
import { Unseen } from "@/components/game/unseen";

export const metadata: Metadata = {
  title: "Unseen",
  description:
    "Hide a payment from the public record and watch what the network can and cannot see.",
};

export default function UnseenPage() {
  return <Unseen />;
}
