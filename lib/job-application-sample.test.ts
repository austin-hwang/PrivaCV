import { describe, expect, it } from "vitest";
import { createSampleJobPipeline } from "@/lib/job-application-sample";

describe("sample job pipeline", () => {
  it("covers a realistic range of application stages and interview rounds", () => {
    const pipeline = createSampleJobPipeline(new Date("2026-07-22T12:00:00-07:00"));
    const statuses = new Set(pipeline.applications.map((application) => application.status));
    const asterEvents = pipeline.events.filter(
      (event) => event.applicationId === "application-sample-aster",
    );

    expect(pipeline.applications).toHaveLength(13);
    expect(statuses).toEqual(
      new Set([
        "saved",
        "preparing",
        "applied",
        "interviewing",
        "offer",
        "accepted",
        "rejected",
        "withdrawn",
        "no_response",
      ]),
    );
    expect(asterEvents.filter((event) => event.type === "interview")).toHaveLength(3);
    expect(pipeline.jobSnapshots).toHaveLength(13);
    expect(
      pipeline.applications.find((item) => item.id === "application-sample-aster")?.nextActionAt,
    ).toBe("2026-07-24");
  });

  it("uses stable IDs so loading the sample is idempotent", () => {
    const first = createSampleJobPipeline(new Date("2026-07-22T12:00:00-07:00"));
    const second = createSampleJobPipeline(new Date("2026-08-01T12:00:00-07:00"));

    expect(second.applications.map((item) => item.id)).toEqual(
      first.applications.map((item) => item.id),
    );
    expect(new Set(second.events.map((item) => item.id)).size).toBe(second.events.length);
  });
});
