import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/\/book\/[^/]+\/manage\//, /\/api\/webhooks\/twilio\//] },
  },
  async headers() {
    return [{ source: "/book/:slug/manage/:token", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store" },
    ] }];
  },
};

export default nextConfig;
