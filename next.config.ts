import type { NextConfig } from "next";

// Security headers applied to every route. Blocking framing matters most for
// the public /validate/[token] page (the CEO's Validate/Reject buttons), which
// must never be embeddable in a third-party iframe (clickjacking).
// frame-ancestors is the modern control; X-Frame-Options covers older browsers.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
