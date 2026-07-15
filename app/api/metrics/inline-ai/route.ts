// Production requests are intercepted by the custom Cloudflare Worker. This
// no-op keeps local and non-Cloudflare builds silent and non-blocking.
export async function POST() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
