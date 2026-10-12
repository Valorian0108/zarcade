import type { Metadata } from "next";
import { RevealSample } from "@/components/sample/reveal-sample";
import "./reveal-sample.css";

export const metadata: Metadata = {
  title: "Design sample",
  description:
    "A throwaway visual sample of the redesigned Unseen reveal moment. No money moves on this page.",
};

export default function SamplePage() {
  return <RevealSample />;
}
