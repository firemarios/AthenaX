import type { NextConfig } from "next";

const apiOrigin = (
  process.env.POLICYLAB_API_INTERNAL_URL ??
  process.env.POLICYLAB_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // AI simulations run the planner + composer LLMs synchronously and can take
    // a few minutes. The /api rewrite proxy defaults to a 30s upstream timeout,
    // which aborts the request ("socket hang up" / 500). Allow up to 10 minutes.
    proxyTimeout: 600_000,
  },
  allowedDevOrigins: ["athenax.akcore.dev", "*.akcore.dev"],
  transpilePackages: ["@policylab/ui", "@policylab/types", "@policylab/api-client", "@policylab/schemas"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/:path*`,
      },
      {
        source: "/openapi.json",
        destination: `${apiOrigin}/openapi.json`,
      },
    ];
  },
};

export default nextConfig;
