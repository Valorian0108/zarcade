/**
 * Where the arcade lives, written down once (D-135).
 *
 * The robots file and the sitemap both need an absolute address, and today
 * that address is the rented machine's own name. Milestone one of the grant
 * puts a real domain in front of it, and then this is set by the environment
 * rather than edited here: `NEXT_PUBLIC_SITE_URL` is read at build time, so
 * changing it means rebuilding and redeploying.
 *
 * Nothing else may hardcode the address. A second copy is a second place to
 * forget when the domain lands.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://web-production-22d97.up.railway.app";
