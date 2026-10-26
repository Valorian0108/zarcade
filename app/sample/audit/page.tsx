import type { Metadata } from "next";
import { MotionPrefProvider } from "@/components/motion-pref";
import { AuditSample } from "@/components/sample/audit-sample";
import "./audit-sample.css";

export const metadata: Metadata = {
  title: "Design sample: The Auditor's Key",
  description:
    "A throwaway visual sample of cabinet four: the curtain entry and the counter scene. No money moves on this page.",
};

export default function AuditSamplePage() {
  return (
    <MotionPrefProvider>
      <AuditSample />
    </MotionPrefProvider>
  );
}
