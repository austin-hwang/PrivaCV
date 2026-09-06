// Cloudflare records this endpoint in production; local and desktop builds do not.
export async function POST() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
