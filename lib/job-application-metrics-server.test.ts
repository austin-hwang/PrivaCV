import { describe, expect, it, vi } from "vitest";
import {
  handleJobApplicationMetric,
  type JobApplicationMetricsEnv,
} from "@/lib/job-application-metrics-server";

function metricRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://privacv.example/api/metrics/job-applications", {
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

describe("anonymous job application metrics", () => {
  it("writes only the fixed application-created milestone", async () => {
    const writeDataPoint = vi.fn();
    const response = await handleJobApplicationMetric(
      metricRequest({ event: "job_application_created" }),
      {
        JOB_APPLICATION_METRICS: { writeDataPoint },
      },
    );

    expect(response?.status).toBe(204);
    expect(writeDataPoint).toHaveBeenCalledWith({
      blobs: ["job_application_created"],
      doubles: [1],
      indexes: ["job_applications"],
    });
  });

  it("rejects arbitrary application data and cross-site submissions", async () => {
    const writeDataPoint = vi.fn();
    const env: JobApplicationMetricsEnv = { JOB_APPLICATION_METRICS: { writeDataPoint } };

    expect(
      (
        await handleJobApplicationMetric(
          metricRequest({
            event: "job_application_created",
            company: "Private Company",
          }),
          env,
        )
      )?.status,
    ).toBe(400);
    expect(
      (
        await handleJobApplicationMetric(
          metricRequest(
            { event: "job_application_created" },
            { Origin: "https://example.com", "Sec-Fetch-Site": "cross-site" },
          ),
          env,
        )
      )?.status,
    ).toBe(403);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it("rejects unknown events and stays non-blocking without a binding", async () => {
    const writeDataPoint = vi.fn();
    const env: JobApplicationMetricsEnv = { JOB_APPLICATION_METRICS: { writeDataPoint } };

    expect(
      (await handleJobApplicationMetric(metricRequest({ event: "application_updated" }), env))
        ?.status,
    ).toBe(400);
    expect(writeDataPoint).not.toHaveBeenCalled();
    expect(
      (await handleJobApplicationMetric(metricRequest({ event: "job_application_created" }), {}))
        ?.status,
    ).toBe(204);
  });
});
