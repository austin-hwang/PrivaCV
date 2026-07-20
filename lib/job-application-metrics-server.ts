import {
  JOB_APPLICATION_CREATED_EVENT,
  JOB_APPLICATION_METRIC_PATH,
} from "./job-application-metrics";

type AnalyticsPoint = {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
};

export type JobApplicationMetricsEnv = {
  JOB_APPLICATION_METRICS?: {
    writeDataPoint(point: AnalyticsPoint): void;
  };
};

const noStoreHeaders = { "Cache-Control": "no-store" };

/** Handle the anonymous, same-origin application-creation metric. */
export async function handleJobApplicationMetric(
  request: Request,
  env: JobApplicationMetricsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== JOB_APPLICATION_METRIC_PATH) return null;

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

  try {
    const body = (await request.json()) as { event?: unknown };
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      body.event !== JOB_APPLICATION_CREATED_EVENT
    )
      throw new Error("Invalid event");
  } catch {
    return new Response("Invalid metric.", { status: 400, headers: noStoreHeaders });
  }

  env.JOB_APPLICATION_METRICS?.writeDataPoint({
    blobs: [JOB_APPLICATION_CREATED_EVENT],
    doubles: [1],
    indexes: ["job_applications"],
  });

  return new Response(null, { status: 204, headers: noStoreHeaders });
}
