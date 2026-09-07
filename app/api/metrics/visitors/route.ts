// Retired endpoint: acknowledge older open clients without collecting or writing data.
export async function POST() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
