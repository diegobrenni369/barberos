import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.E2E_BUILD === "1" ? ".next-e2e" : ".next",
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/book\/[^/]+\/manage\//, /\/api\/webhooks\/twilio\//] },
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
      ...(process.env.NODE_ENV === "production" && process.env.APP_URL?.startsWith("https://") ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }, { source: "/book/:slug/manage/:token", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store" },
    ] }];
  },
};

export default nextConfig;
