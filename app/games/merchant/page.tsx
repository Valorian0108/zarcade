import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { Merchant } from "@/components/game/merchant";
import "@/components/game/game.css";
import "./merchant.css";

export const metadata: Metadata = {
  title: "The Merchant's Window",
  description:
    "You are the shopkeeper. A deposit has landed and your partner wants proof. Decide how much of your private record to show, and see what each choice leaves open.",
};

export default function MerchantPage() {
  return (
    <MotionPrefProvider>
      <Merchant />
    </MotionPrefProvider>
  );
}
