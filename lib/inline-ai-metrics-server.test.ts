import { describe, expect, it, vi } from "vitest";
import { handleInlineAIMetric, type InlineAIMetricsEnv } from "@/lib/inline-ai-metrics-server";

function metricRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://privacv.example/api/metrics/inline-ai", {
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

describe("anonymous inline AI metrics", () => {
  it.each(["inline_ai_used", "inline_ai_accepted"])("records only the %s milestone", async (event) => {
    const writeDataPoint = vi.fn();
    const response = await handleInlineAIMetric(metricRequest({ event }), {
      INLINE_AI_METRICS: { writeDataPoint },
    });

    expect(response?.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: [event],
      doubles: [1],
      indexes: ["inline_ai"],
    });
  });

  it("rejects unknown milestones and cross-site submissions", async () => {
    const writeDataPoint = vi.fn();
    const env: InlineAIMetricsEnv = { INLINE_AI_METRICS: { writeDataPoint } };

    expect((await handleInlineAIMetric(metricRequest({ event: "prompt_text" }), env))?.status).toBe(400);
    expect((await handleInlineAIMetric(metricRequest(
      { event: "inline_ai_used" },
      { Origin: "https://example.com", "Sec-Fetch-Site": "cross-site" },
    ), env))?.status).toBe(403);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
