import { describe, expect, it } from "vitest";
import { buildReminders, groupReminders, remindersToIcs } from "@/lib/job-reminders";
import type { ApplicationEvent, JobApplication } from "@/lib/job-applications";

const NOW = "2026-07-20T12:00:00.000Z";
const TODAY = "2026-07-20";

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
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function event(overrides: Partial<ApplicationEvent> = {}): ApplicationEvent {
  return {
    id: "event-1",
    applicationId: "application-1",
    type: "interview",
    title: "Onsite loop",
    occurredAt: NOW,
    ...overrides,
  };
}

describe("buildReminders", () => {
  it("buckets next actions into overdue, today, and upcoming", () => {
    const applications = [
      application({ id: "a", nextAction: "Ping recruiter", nextActionAt: "2026-07-18" }),
      application({ id: "b", nextAction: "Send thank-you", nextActionAt: TODAY }),
      application({ id: "c", nextAction: "Prep answers", nextActionAt: "2026-07-25" }),
    ];
    const groups = groupReminders(buildReminders(applications, [], { today: TODAY }));
    expect(groups.overdue.map((item) => item.applicationId)).toEqual(["a"]);
    expect(groups.today.map((item) => item.applicationId)).toEqual(["b"]);
    expect(groups.upcoming.map((item) => item.applicationId)).toEqual(["c"]);
  });

  it("includes future scheduled activities but excludes closed apps and past activities", () => {
    const applications = [
      application({ id: "open" }),
      application({ id: "closed", status: "rejected" }),
    ];
    const events = [
      event({ id: "future", applicationId: "open", occurredAt: "2026-07-24T15:00:00.000Z" }),
      event({ id: "past", applicationId: "open", occurredAt: "2026-07-10T15:00:00.000Z" }),
      event({
        id: "closed-future",
        applicationId: "closed",
        occurredAt: "2026-07-24T15:00:00.000Z",
      }),
      event({
        id: "note",
        applicationId: "open",
        type: "note",
        occurredAt: "2026-07-24T15:00:00.000Z",
      }),
    ];
    const items = buildReminders(applications, events, { today: TODAY });
    expect(items.map((item) => item.id)).toEqual(["future"]);
    expect(items[0].kind).toBe("activity");
  });

  it("sorts by date then time", () => {
    const applications = [application({ id: "open" })];
    const events = [
      event({ id: "later", applicationId: "open", occurredAt: "2026-07-22T09:00:00.000Z" }),
      event({ id: "sooner", applicationId: "open", occurredAt: "2026-07-21T17:00:00.000Z" }),
    ];
    const items = buildReminders(applications, events, { today: TODAY });
    expect(items.map((item) => item.id)).toEqual(["sooner", "later"]);
  });
});

describe("remindersToIcs", () => {
  it("emits all-day events for next actions and timed events for activities", () => {
    const applications = [
      application({ id: "a", nextAction: "Follow up; nicely", nextActionAt: "2026-07-25" }),
    ];
    const events = [
      event({ id: "iv", applicationId: "a", occurredAt: "2026-07-24T15:00:00.000Z" }),
    ];
    const ics = remindersToIcs(
      buildReminders(applications, events, { today: TODAY }),
      new Date(NOW),
    );

    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260725");
    expect(ics).toContain("DTEND;VALUE=DATE:20260726");
    expect(ics).toContain("DTSTART:20260724T150000Z");
    // Semicolons in free text are escaped.
    expect(ics).toContain("Follow up\\; nicely");
  });
});
