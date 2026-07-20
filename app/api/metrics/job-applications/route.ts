// The custom Cloudflare Worker records this endpoint in production. This
// no-op preserves the same fire-and-forget behavior in local Next.js builds.
export async function POST() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
