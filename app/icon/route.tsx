import { ImageResponse } from "next/og";

const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#151b27"/>
  <path d="M15 10h23l10 10v33H15z" fill="#f8fafc"/>
  <path d="M38 10v10h10" fill="#dbeafe"/>
  <path d="M22 24h17M22 30h12M22 36h14" fill="none" stroke="#60a5fa" stroke-linecap="round" stroke-width="3.5"/>
  <path d="M35 43v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#2563eb" stroke-linecap="round" stroke-width="3.5"/>
  <rect x="30" y="42" width="20" height="14" rx="3.5" fill="#2563eb"/>
  <circle cx="40" cy="48.5" r="2" fill="#f8fafc"/>
  <path d="M40 50.5v2" stroke="#f8fafc" stroke-linecap="round" stroke-width="2"/>
</svg>`;

/** Stable raster favicon URL for search crawlers and installed-app metadata. */
export function GET() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%" }}>
      {/* oxlint-disable-next-line nextjs/no-img-element */}
      <img
        width={96}
        height={96}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(mark)}`}
        alt=""
      />
    </div>,
    {
      width: 96,
      height: 96,
      headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    },
  );
}
