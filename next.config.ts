import type { NextConfig } from "next";

const isElectronBuild = process.env.ELECTRON_BUILD === "1";
const isDesktopApp = process.env.PRIVACV_DESKTOP_APP === "1";
const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

const desktopRedirects = [
  { source: "/about", destination: "/" },
  { source: "/ats-resume-checker", destination: "/" },
  { source: "/free-resume-builder", destination: "/" },
  { source: "/guides/:path*", destination: "/" },
  { source: "/job-application-tracker", destination: "/applications" },
  { source: "/job-search-sankey", destination: "/applications" },
  { source: "/pdf-to-docx-resume", destination: "/" },
  { source: "/plain-text-resume", destination: "/" },
  { source: "/privacy", destination: "/" },
  { source: "/resume-builder-comparison", destination: "/" },
  { source: "/resume-templates", destination: "/" },
].map((redirect) => ({ ...redirect, permanent: false }));

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // Next.js evaluates its development client bundle. Keep that allowance out
  // of production. WebLLM compiles its model runtime from WebAssembly only
  // after a user explicitly prepares a local model.
  // static.cloudflareinsights.com serves Cloudflare's cookieless Web Analytics
  // beacon, which Cloudflare injects at the edge in production.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com${developmentScriptSource}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  // huggingface/hf.co hosts serve WebLLM's model manifest/weights; the beacon
  // reports anonymous RUM to cloudflareinsights.com. Keeping the list explicit
  // preserves the local editor's narrow network boundary.
  "connect-src 'self' https://privacv.app https://huggingface.co https://*.hf.co https://*.xethub.hf.co https://raw.githubusercontent.com https://cloudflareinsights.com",
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
  // The Electron development window uses the explicit loopback address while
  // Next's dev server advertises localhost. Allow only that equivalent origin
  // so HMR assets are accepted inside the desktop window.
  allowedDevOrigins: ["127.0.0.1"],
  // Electron packages a minimal local Next server so the existing App Router,
  // route handlers, and WebLLM model proxy keep working without a network
  // connection. Web and Cloudflare builds retain their existing output shape.
  output: isElectronBuild ? "standalone" : undefined,
  // Let release checks use an isolated cache while a local dev server is open.
  // Production keeps Next's normal `.next` output unless explicitly overridden.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // OpenNext's Cloudflare deployment serves our generated social cards directly,
  // but does not expose Next's `/_next/image` optimizer endpoint. Keeping local
  // images unoptimized avoids broken article images while preserving responsive
  // dimensions, lazy loading, and the original generated PNG response.
  images: { unoptimized: true },
  // PDF import/export only runs in response to browser actions. Next still
  // compiles Client Components for server rendering, so importing the real
  // renderers there would add their font/PDF engines to the Cloudflare Worker.
  // Keep lightweight, fail-closed stubs in the server graph and replace them
  // with the real packages only for browser-targeted bundles.
  turbopack: {
    resolveAlias: {
      "@/lib/pdfjs-browser-runtime": { browser: "pdfjs-dist" },
      "@/lib/react-pdf-browser-runtime": { browser: "@react-pdf/renderer" },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return isDesktopApp ? desktopRedirects : [];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
