import type { NextConfig } from "next";

const apiOrigin = (
  process.env.POLICYLAB_API_INTERNAL_URL ??
  process.env.POLICYLAB_API_BASE_URL ??
  "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
