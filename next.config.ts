import type { NextConfig } from "next";

const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

// Ko-fi's floating support widget loads its script/iframe/images from these
// hosts. This is the one third-party the editor talks to; resume content still
// never leaves the browser.
const kofi = "https://ko-fi.com https://*.ko-fi.com";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next.js evaluates its development client bundle. Keep that allowance out
  // of production, where the editor's static bundle does not need it.
  `script-src 'self' 'unsafe-inline' https://storage.ko-fi.com${developmentScriptSource}`,
  "style-src 'self' 'unsafe-inline' https://storage.ko-fi.com",
  `img-src 'self' blob: data: ${kofi}`,
  "font-src 'self' https://storage.ko-fi.com",
  `connect-src 'self' ${kofi}`,
  `frame-src 'self' ${kofi}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
