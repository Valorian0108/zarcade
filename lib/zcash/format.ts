/**
 * Turning wallet numbers into words a person can read (B4).
 *
 * Money is held as a whole number of zatoshis because that is what the network
 * uses, and whole numbers never lose a fraction to rounding. It is only turned
 * into a decimal string here, at the last moment, for display.
 */

const ZATOSHIS_PER_TAZ = 100_000_000;

/**
 * Formats zatoshis as a TAZ amount with all eight decimal places and no
 * rounding, matching what the block explorer shows. 1,000 becomes
 * "0.00001000", which reads as a very small amount and teaches that on its
 * own.
 */
export function formatTaz(zatoshis: number): string {
  if (!Number.isInteger(zatoshis) || zatoshis < 0) {
    throw new RangeError(`zatoshis must be a whole number, got ${zatoshis}`);
  }
  const whole = Math.floor(zatoshis / ZATOSHIS_PER_TAZ);
  const fraction = String(zatoshis % ZATOSHIS_PER_TAZ).padStart(8, "0");
  return `${whole}.${fraction}`;
}

/** Shortens an address for display: "tmXbq7...3Kfub". The full one is still linked. */
export function shortenAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 14) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-5)}`;
}
