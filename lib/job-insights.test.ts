import { describe, expect, it } from "vitest";
import { buildJobInsights } from "@/lib/job-insights";
import type { ApplicationEvent, JobApplication } from "@/lib/job-applications";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "application-1",
    company: "Acme",
    role: "Product Designer",
    status: "applied",
    sourceUrl: "",
    source: "",
    location: "",
    compensation: "",
    contactName: "",
    contactEmail: "",
    notes: "",
    nextAction: "",
    nextActionAt: "",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function statusEvent(
  applicationId: string,
  toStatus: JobApplication["status"],
  occurredAt: string,
  type: ApplicationEvent["type"] = "status_changed",
): ApplicationEvent {
  return {
    id: `${applicationId}-${toStatus}`,
    applicationId,
    type,
    title: toStatus,
    occurredAt,
    toStatus,
  };
}

describe("buildJobInsights", () => {
  it("keeps interview-to-offer conversion within the interviewed population", () => {
    const applications = [
      application({ id: "a", status: "offer", appliedAt: "2026-06-02T00:00:00Z" }),
      application({ id: "b", status: "offer", appliedAt: "2026-06-03T00:00:00Z" }),
    ];
    const insights = buildJobInsights(applications, [
      statusEvent("a", "interviewing", "2026-06-02T00:00:00Z"),
    ]);
    expect(insights.offered).toBe(2);
    expect(insights.offeredAfterInterview).toBe(1);
    expect(insights.offerRate).toBe(1);
    expect(buildJobInsights(applications, []).offerRate).toBeNull();
  });
  it("computes response, interview, and offer conversion from stages ever reached", () => {
    const applications = [
      // Applied and now rejected, but did interview -> counts as responded + interviewed.
      application({ id: "a", status: "rejected", appliedAt: "2026-06-02T00:00:00.000Z" }),
      // Applied, still waiting -> submitted but no response.
      application({ id: "b", status: "applied", appliedAt: "2026-06-03T00:00:00.000Z" }),
      // Applied -> interviewing -> offer.
      application({ id: "c", status: "offer", appliedAt: "2026-06-04T00:00:00.000Z" }),
      // Never applied (saved) -> excluded from submitted denominators.
      application({ id: "d", status: "saved" }),
    ];
    const events = [
      statusEvent("a", "interviewing", "2026-06-05T00:00:00.000Z"),
      statusEvent("a", "rejected", "2026-06-08T00:00:00.000Z"),
      statusEvent("c", "interviewing", "2026-06-06T00:00:00.000Z"),
      statusEvent("c", "offer", "2026-06-10T00:00:00.000Z"),
    ];

    const insights = buildJobInsights(applications, events, { today: "2026-06-15" });
    expect(insights.submitted).toBe(3);
    expect(insights.responded).toBe(2); // a and c
    expect(insights.responseRate).toBeCloseTo(2 / 3);
    expect(insights.interviewed).toBe(2);
    expect(insights.interviewRate).toBeCloseTo(2 / 3);
    expect(insights.offered).toBe(1); // c
    expect(insights.offerRate).toBeCloseTo(1 / 2); // of the 2 interviewed
  });

  it("returns null rates when there is nothing to divide by", () => {
    const insights = buildJobInsights([application({ status: "saved" })], [], {
      today: "2026-06-15",
    });
    expect(insights.submitted).toBe(0);
    expect(insights.responseRate).toBeNull();
    expect(insights.offerRate).toBeNull();
    expect(insights.perWeek).toEqual([]);
  });

  it("averages time spent in each stage from consecutive transitions", () => {
    const applications = [
      application({ id: "c", status: "offer", appliedAt: "2026-06-04T00:00:00.000Z" }),
    ];
    const events = [
      statusEvent("c", "applied", "2026-06-04T00:00:00.000Z", "created"),
      statusEvent("c", "interviewing", "2026-06-06T00:00:00.000Z"),
      statusEvent("c", "offer", "2026-06-10T00:00:00.000Z"),
    ];
    const insights = buildJobInsights(applications, events, { today: "2026-06-15" });
    const applied = insights.stageDurations.find((entry) => entry.status === "applied");
    const interviewing = insights.stageDurations.find((entry) => entry.status === "interviewing");
    const offer = insights.stageDurations.find((entry) => entry.status === "offer");
    expect(applied?.averageDays).toBeCloseTo(2); // 06-04 -> 06-06
    expect(interviewing?.averageDays).toBeCloseTo(4); // 06-06 -> 06-10
    expect(offer?.averageDays).toBeNull(); // current, open-ended stage
  });

  it("builds a zero-filled weekly submission series", () => {
    const applications = [
      application({ id: "w1", appliedAt: "2026-06-01T12:00:00.000Z" }), // Mon week of 06-01
      application({ id: "w3", appliedAt: "2026-06-15T12:00:00.000Z" }), // two weeks later
    ];
    const insights = buildJobInsights(applications, [], { today: "2026-06-15" });
    expect(insights.perWeek).toEqual([
      { weekStart: "2026-06-01", count: 1 },
      { weekStart: "2026-06-08", count: 0 },
      { weekStart: "2026-06-15", count: 1 },
    ]);
  });
});
