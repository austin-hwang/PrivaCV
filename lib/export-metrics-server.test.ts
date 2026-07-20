import { describe, expect, it, vi } from "vitest";
import { handleExportMetric, type ExportMetricsEnv } from "@/lib/export-metrics-server";

function exportRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://privacv.example/api/metrics/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://privacv.example",
      "Sec-Fetch-Site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("anonymous export metrics", () => {
  it("writes only the aggregate event name and allowed export format", async () => {
    const writeDataPoint = vi.fn();
    const response = await handleExportMetric(exportRequest({ format: "docx" }), {
      EXPORT_METRICS: { writeDataPoint },
    });

    expect(response?.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ["resume_export", "docx"],
      doubles: [1],
      indexes: ["resume_export"],
    });
  });

  it("rejects invalid formats and cross-site submissions", async () => {
    const writeDataPoint = vi.fn();
    const env: ExportMetricsEnv = { EXPORT_METRICS: { writeDataPoint } };

    expect(
      (await handleExportMetric(exportRequest({ format: "resume-content" }), env))?.status,
    ).toBe(400);
    expect(
      (
        await handleExportMetric(
          exportRequest(
            { format: "pdf" },
            { Origin: "https://example.com", "Sec-Fetch-Site": "cross-site" },
          ),
          env,
        )
      )?.status,
    ).toBe(403);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("stays non-blocking when the analytics binding is unavailable", async () => {
    expect((await handleExportMetric(exportRequest({ format: "json" }), {}))?.status).toBe(204);
  });
});
