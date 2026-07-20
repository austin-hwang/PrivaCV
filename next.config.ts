import type { NextConfig } from "next";

const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next.js evaluates its development client bundle. Keep that allowance out
  // of production. WebLLM compiles its model runtime from WebAssembly only
  // after a user explicitly prepares a local model.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${developmentScriptSource}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // These are WebLLM's model manifest/weight hosts. Keeping the list explicit
  // preserves the local editor's narrow network boundary.
  "connect-src 'self' https://huggingface.co https://*.hf.co https://*.xethub.hf.co https://raw.githubusercontent.com",
  "frame-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // Let release checks use an isolated cache while a local dev server is open.
  // Production keeps Next's normal `.next` output unless explicitly overridden.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // OpenNext's Cloudflare deployment serves our generated social cards directly,
  // but does not expose Next's `/_next/image` optimizer endpoint. Keeping local
  // images unoptimized avoids broken article images while preserving responsive
  // dimensions, lazy loading, and the original generated PNG response.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
