import { EXPORT_FORMATS, EXPORT_METRIC_PATH, type ResumeExportFormat } from "./export-metrics";

type AnalyticsPoint = {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
};

export type ExportMetricsEnv = {
  EXPORT_METRICS?: {
    writeDataPoint(point: AnalyticsPoint): void;
  };
};

const allowedFormats = new Set<string>(EXPORT_FORMATS);
const noStoreHeaders = { "Cache-Control": "no-store" };

/** Handle the Worker's tiny same-origin export metric endpoint. */
export async function handleExportMetric(
  request: Request,
  env: ExportMetricsEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== EXPORT_METRIC_PATH) return null;

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

  let format: ResumeExportFormat;
  try {
    const body = (await request.json()) as { format?: unknown };
    if (typeof body.format !== "string" || !allowedFormats.has(body.format))
      throw new Error("Invalid format");
    format = body.format as ResumeExportFormat;
  } catch {
    return new Response("Invalid metric.", { status: 400, headers: noStoreHeaders });
  }

  // Analytics Engine writes are non-blocking. The index keeps all export
  // events in one sampling group; blob2 remains available for format totals.
  env.EXPORT_METRICS?.writeDataPoint({
    blobs: ["resume_export", format],
    doubles: [1],
    indexes: ["resume_export"],
  });

  return new Response(null, { status: 204, headers: noStoreHeaders });
}
