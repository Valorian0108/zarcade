import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // No `output` setting on purpose: Next's own Railway path builds a normal
  // .next and starts it with `next start` (D-084). The earlier standalone
  // experiment was removed after the first live deploy answered 502.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
