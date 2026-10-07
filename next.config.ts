import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "unpdf"],
  experimental: {
    // bodySizeLimit: resume PDF uploads (we accept up to 5 MB). allowedOrigins: the free custom URL forwards to us (see ../ocus-proxy).
    serverActions: { bodySizeLimit: "6mb", allowedOrigins: ["ocus-ai.vercel.app"] },
  },
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
