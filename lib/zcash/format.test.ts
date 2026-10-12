import { describe, expect, it } from "vitest";

import { formatTaz, shortenAddress } from "@/lib/zcash/format";

describe("writing money the way the explorer writes it", () => {
  it("keeps all eight decimal places", () => {
    expect(formatTaz(0)).toBe("0.00000000");
    expect(formatTaz(1)).toBe("0.00000001");
    expect(formatTaz(1_000)).toBe("0.00001000");
    expect(formatTaz(12_472_000)).toBe("0.12472000");
    expect(formatTaz(100_000_000)).toBe("1.00000000");
    expect(formatTaz(123_456_789)).toBe("1.23456789");
  });

  it("matches the amounts the house wallet really reported", () => {
    // The three balances from the B3 test sends, in order.
    expect(formatTaz(12_500_000)).toBe("0.12500000");
    expect(formatTaz(12_489_000)).toBe("0.12489000");
    expect(formatTaz(12_472_000)).toBe("0.12472000");
  });

  it("refuses anything that is not a whole number of zatoshis", () => {
    expect(() => formatTaz(-1)).toThrow(RangeError);
    expect(() => formatTaz(1.5)).toThrow(RangeError);
    expect(() => formatTaz(Number.NaN)).toThrow(RangeError);
  });
});

describe("shortening an address for a small screen", () => {
  it("keeps both ends of a real open address", () => {
    expect(shortenAddress("tmXbq7ghCfNyszcBFT9sYiWvKZoHjt3Kfub")).toBe("tmXbq7...3Kfub");
  });

  it("leaves a short string alone rather than mangling it", () => {
    expect(shortenAddress("tmShort")).toBe("tmShort");
    expect(shortenAddress("")).toBe("");
  });
});
