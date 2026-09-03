import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

// Flagship editorial assets are generated before Next resolves /public.
// Champion masters are already created by predev/prebuild; Batch B Structures
// are generated here as an additive release asset pipeline without changing
// the frozen gameplay/card presentation surfaces.
execFileSync(process.execPath, ["scripts/generate-flagship-structure-art.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // CSP is nonce-based and generated per request in src/proxy.ts.
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
