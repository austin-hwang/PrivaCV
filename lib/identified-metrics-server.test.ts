import { describe, expect, it, vi } from "vitest";
import { handleExportMetric } from "@/lib/export-metrics-server";
import { handleJobApplicationMetric } from "@/lib/job-application-metrics-server";

const visitorId = "01234567-89ab-4cde-8fab-0123456789ab";
function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://privacv.app/api/metrics/${path}`, {
    method: "POST",
    headers: { Origin: "https://privacv.app", "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
describe("identified action metrics", () => {
  it("attaches the same visitor ID to both datasets and their sampling indexes", async () => {
    const exports = vi.fn();
    const applications = vi.fn();
    expect(
      (
        await handleExportMetric(request("export", { format: "pdf", visitorId }), {
          EXPORT_METRICS: { writeDataPoint: exports },
        })
      )?.status,
    ).toBe(204);
    expect(
      (
        await handleJobApplicationMetric(
          request("job-applications", { event: "job_application_created", visitorId }),
          { JOB_APPLICATION_METRICS: { writeDataPoint: applications } },
        )
      )?.status,
    ).toBe(204);
    expect(exports).toHaveBeenCalledWith({
      blobs: ["resume_export", "pdf", visitorId],
      doubles: [1],
      indexes: [visitorId],
    });
    expect(applications).toHaveBeenCalledWith({
      blobs: ["job_application_created", visitorId],
      doubles: [1],
      indexes: [visitorId],
    });
  });
  it("rejects malformed IDs and suppresses opted-out action events", async () => {
    const writeDataPoint = vi.fn();
    for (const id of ["person@example.com", 42, null]) {
      expect(
        (
          await handleExportMetric(request("export", { format: "pdf", visitorId: id }), {
            EXPORT_METRICS: { writeDataPoint },
          })
        )?.status,
      ).toBe(400);
      expect(
        (
          await handleJobApplicationMetric(
            request("job-applications", { event: "job_application_created", visitorId: id }),
            { JOB_APPLICATION_METRICS: { writeDataPoint } },
          )
        )?.status,
      ).toBe(400);
    }
    for (const header of ["DNT", "Sec-GPC"]) {
      expect(
        (
          await handleExportMetric(
            request("export", { format: "pdf", visitorId }, { [header]: "1" }),
            { EXPORT_METRICS: { writeDataPoint } },
          )
        )?.status,
      ).toBe(204);
      expect(
        (
          await handleJobApplicationMetric(
            request(
              "job-applications",
              { event: "job_application_created", visitorId },
              { [header]: "1" },
            ),
            { JOB_APPLICATION_METRICS: { writeDataPoint } },
          )
        )?.status,
      ).toBe(204);
    }
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
