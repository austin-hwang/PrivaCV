// The custom Cloudflare Worker records this endpoint in production. Keeping a
// no-op route in the Next app makes local development and non-Cloudflare builds
// preserve the exact same fire-and-forget export behavior.
export async function POST() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
