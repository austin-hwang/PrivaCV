import { VISITOR_ID_PATTERN, VISITOR_METRIC_PATH, type VisitorWorkspace } from "./visitor-metrics";

export type VisitorMetricsEnv = {
  VISITOR_METRICS?: {
    writeDataPoint(point: { blobs: string[]; doubles: number[]; indexes: string[] }): void;
  };
};
const headers = { "Cache-Control": "no-store" };

export async function handleVisitorMetric(
  request: Request,
  env: VisitorMetricsEnv,
  now = new Date(),
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== VISITOR_METRIC_PATH) return null;
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { ...headers, Allow: "POST" } });
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin !== url.origin || (fetchSite && fetchSite !== "same-origin"))
    return new Response(null, { status: 403, headers });
  if (request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1")
    return new Response(null, { status: 204, headers });
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return new Response(null, { status: 400, headers });

  let visitorId: string;
  let workspace: VisitorWorkspace;
  const day = now.toISOString().slice(0, 10);
  try {
    // Bound actual bytes even if Content-Length is absent or inaccurate.
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing metric");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128) {
        await reader.cancel();
        throw new Error("Metric too large");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid metric");
    const value = body as Record<string, unknown>;
    if (
      Object.keys(value).length !== 3 ||
      (value.workspace !== "resume" && value.workspace !== "job_applications") ||
      value.day !== day ||
      typeof value.visitorId !== "string" ||
      !VISITOR_ID_PATTERN.test(value.visitorId)
    )
      throw new Error("Invalid metric");
    visitorId = value.visitorId;
    workspace = value.workspace;
  } catch {
    return new Response(null, { status: 400, headers });
  }
  try {
    // Sample by daily visitor within each workspace; count DISTINCT index1, not rows.
    env.VISITOR_METRICS?.writeDataPoint({
      blobs: ["workspace_visitor", day, workspace, visitorId],
      doubles: [1],
      indexes: [`${workspace}:${visitorId}`],
    });
  } catch {
    return new Response(null, { status: 503, headers });
  }
  return new Response(null, { status: 204, headers });
}
