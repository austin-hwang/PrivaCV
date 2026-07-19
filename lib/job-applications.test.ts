import { describe, expect, it } from "vitest";
import { createJobPipelineBackup, parseJobPipelineBackup } from "@/lib/job-application-db";
import {
  createJobApplicationRecord,
  isApplicationOverdue,
  jobApplicationMatches,
  jobApplicationsCsv,
  jobPipelineStats,
  sortJobApplications,
  transitionJobApplication,
  type JobApplication,
} from "@/lib/job-applications";

const NOW = "2026-07-19T18:00:00.000Z";

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: "application-1",
    company: "Acme",
    role: "Product Designer",
    status: "saved",
    sourceUrl: "",
    source: "",
    location: "Remote",
    compensation: "",
    contactName: "",
    contactEmail: "",
    notes: "",
    nextAction: "",
    nextActionAt: "",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("job application lifecycle", () => {
  it("normalizes a new application and records applied lifecycle dates", () => {
    const result = createJobApplicationRecord({
      company: "  Acme  ",
      role: " Product Designer ",
      status: "applied",
      sourceUrl: " https://example.com/job ",
    }, NOW);

    expect(result).toMatchObject({
      company: "Acme",
      role: "Product Designer",
      status: "applied",
      sourceUrl: "https://example.com/job",
      appliedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("timestamps closing and clears the closed date when an application is reopened", () => {
    const rejected = transitionJobApplication(application({ status: "interviewing", appliedAt: NOW }), "rejected", "2026-07-20T18:00:00.000Z");
    expect(rejected.closedAt).toBe("2026-07-20T18:00:00.000Z");
    expect(rejected.appliedAt).toBe(NOW);

    const reopened = transitionJobApplication(rejected, "preparing", "2026-07-21T18:00:00.000Z");
    expect(reopened.closedAt).toBeUndefined();
    expect(reopened.appliedAt).toBe(NOW);
  });

  it("calculates active, interview, offer, overdue, and closed counts", () => {
    const applications = [
      application({ id: "1", nextActionAt: "2026-07-18" }),
      application({ id: "2", status: "interviewing" }),
      application({ id: "3", status: "offer" }),
      application({ id: "4", status: "rejected", nextActionAt: "2026-07-01" }),
    ];

    expect(jobPipelineStats(applications, "2026-07-19")).toEqual({
      total: 4,
      active: 3,
      interviewing: 1,
      offers: 1,
      overdue: 1,
      closed: 1,
    });
    expect(isApplicationOverdue(applications[3], "2026-07-19")).toBe(false);
  });
});

describe("job application views and portability", () => {
  it("searches useful application fields and sorts next actions first", () => {
    const later = application({ id: "later", company: "Beta", nextActionAt: "2026-07-25" });
    const sooner = application({ id: "sooner", company: "Acme", nextActionAt: "2026-07-20", notes: "Referred by Sam" });

    expect(sortJobApplications([later, sooner]).map((item) => item.id)).toEqual(["sooner", "later"]);
    expect(jobApplicationMatches(sooner, "sam")).toBe(true);
    expect(jobApplicationMatches(later, "sam")).toBe(false);
  });

  it("exports CSV safely and round-trips a versioned JSON backup", () => {
    const item = application({ company: "Acme, Inc.", notes: "Asked: \"Why us?\"" });
    const csv = jobApplicationsCsv([item]);
    expect(csv).toContain('"Acme, Inc."');
    expect(csv).toContain('"Asked: ""Why us?"""');

    const backup = createJobPipelineBackup({
      applications: [item],
      events: [],
      jobSnapshots: [],
      resumeSnapshots: [],
    });
    expect(parseJobPipelineBackup(JSON.stringify(backup))).toMatchObject({
      format: "privacv-job-pipeline-backup",
      version: 1,
      applications: [{ id: "application-1" }],
    });
  });
});
