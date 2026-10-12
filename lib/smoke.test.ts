import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("scaffold smoke", () => {
  it("the class-name helper joins and merges classes", () => {
    expect(cn("a", "b")).toContain("a");
    expect(cn("a", "b")).toContain("b");
  });
});
