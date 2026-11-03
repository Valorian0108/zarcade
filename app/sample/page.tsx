import type { Metadata } from "next";
import { RevealSample } from "@/components/sample/reveal-sample";
import "./reveal-sample.css";

export const metadata: Metadata = {
  title: "Design sample",
  description:
    "A throwaway visual sample of the redesigned Unseen reveal moment. No money moves on this page.",
  // A scratch page for the owner, not part of the arcade. It is kept out of
  // the index by this tag rather than by robots.txt, because a crawler that
  // is told to stay away can never read a tag like this one (D-135).
  robots: { index: false, follow: false },
};

export default function SamplePage() {
  return <RevealSample />;
}
