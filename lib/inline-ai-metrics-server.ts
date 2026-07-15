import { INLINE_AI_EVENTS, INLINE_AI_METRIC_PATH, type InlineAIEvent } from "./inline-ai-metrics";

type AnalyticsPoint = {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
};

export type InlineAIMetricsEnv = {
  INLINE_AI_METRICS?: {
    writeDataPoint(point: AnalyticsPoint): void;
  };
};

const allowedEvents = new Set<string>(INLINE_AI_EVENTS);
const noStoreHeaders = { "Cache-Control": "no-store" };

/** Handle anonymous, same-origin inline-AI milestone events. */
export async function handleInlineAIMetric(request: Request, env: InlineAIMetricsEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== INLINE_AI_METRIC_PATH) return null;

  if (request.method !== "POST") {
    return new Response("Method not allowed.", {
      status: 405,
      headers: { ...noStoreHeaders, Allow: "POST" },
    });
  }

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== url.origin) || (fetchSite && fetchSite !== "same-origin")) {
    return new Response("Forbidden.", { status: 403, headers: noStoreHeaders });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 128) {
    return new Response("Invalid metric.", { status: 400, headers: noStoreHeaders });
  }

  let event: InlineAIEvent;
  try {
    const body = await request.json() as { event?: unknown };
    if (typeof body.event !== "string" || !allowedEvents.has(body.event)) throw new Error("Invalid event");
    event = body.event as InlineAIEvent;
  } catch {
    return new Response("Invalid metric.", { status: 400, headers: noStoreHeaders });
  }

  env.INLINE_AI_METRICS?.writeDataPoint({
    blobs: [event],
    doubles: [1],
    indexes: ["inline_ai"],
  });

  return new Response(null, { status: 204, headers: noStoreHeaders });
}
