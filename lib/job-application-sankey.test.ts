import { describe, expect, it } from "vitest";
import { buildJobSankeyData } from "@/lib/job-application-sankey";
import type {
  ApplicationEvent,
  JobApplication,
  JobApplicationStatus,
} from "@/lib/job-applications";
import { buildJobSankeyLayout } from "@/lib/job-sankey-layout";

const NOW = "2026-07-20T12:00:00.000Z";

function application(
  id: string,
  status: JobApplicationStatus,
  applied = status !== "saved" && status !== "preparing",
): JobApplication {
  return {
    id,
    company: `${id} company`,
    role: `${id} role`,
    status,
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
    ...(applied ? { appliedAt: NOW } : {}),
  };
}

function transition(
  applicationId: string,
  fromStatus: JobApplicationStatus,
  toStatus: JobApplicationStatus,
  order: number,
): ApplicationEvent {
  return {
    id: `event-${applicationId}-${order}`,
    applicationId,
    type: "status_changed",
    title: "Moved",
    occurredAt: `2026-07-${String(10 + order).padStart(2, "0")}T12:00:00.000Z`,
    fromStatus,
    toStatus,
  };
}

function interview(applicationId: string, order: number): ApplicationEvent {
  return {
    id: `interview-${applicationId}-${order}`,
    applicationId,
    type: "interview",
    title: `Round ${order}`,
    occurredAt: `2026-07-${String(10 + order).padStart(2, "0")}T12:00:00.000Z`,
  };
}

describe("job search Sankey", () => {
  it("reconstructs direct outcomes and interview-to-offer journeys", () => {
    const applications = [
      application("waiting", "applied"),
      application("direct-rejection", "rejected"),
      application("interview-rejection", "rejected"),
      application("accepted", "accepted"),
      application("saved", "saved", false),
    ];
    const events = [
      transition("interview-rejection", "applied", "interviewing", 1),
      transition("interview-rejection", "interviewing", "rejected", 2),
      transition("accepted", "applied", "interviewing", 1),
      transition("accepted", "interviewing", "offer", 2),
      transition("accepted", "offer", "accepted", 3),
    ];

    const data = buildJobSankeyData(applications, events);
    const links = new Map(data.links.map((link) => [`${link.source}:${link.target}`, link.value]));

    expect(data.total).toBe(4);
    expect(data.excluded).toBe(1);
    // A status transition into interviewing counts as a first round even with no
    // interview event logged.
    expect(links).toEqual(
      new Map([
        ["applications:awaiting", 1],
        ["applications:rejected", 1],
        ["applications:round-1", 2],
        ["round-1:rejected", 1],
        ["round-1:offer", 1],
        ["offer:accepted", 1],
      ]),
    );
    expect(data.nodes.find((node) => node.id === "round-1")?.count).toBe(2);
    expect(data.nodes.find((node) => node.id === "accepted")?.count).toBe(1);
  });

  it("infers the prerequisite stages for an application recorded directly as accepted", () => {
    const data = buildJobSankeyData([application("accepted", "accepted")], []);

    expect(data.links).toEqual([
      { source: "applications", target: "round-1", value: 1 },
      { source: "round-1", target: "offer", value: 1 },
      { source: "offer", target: "accepted", value: 1 },
    ]);
  });

  it("builds one node per interview round and splits an offer decline from earlier withdrawals", () => {
    const applications = [
      application("late-decline", "withdrawn"),
      application("early-withdraw", "withdrawn"),
    ];
    const events = [
      interview("late-decline", 1),
      interview("late-decline", 2),
      transition("late-decline", "interviewing", "offer", 3),
      interview("early-withdraw", 1),
      transition("early-withdraw", "interviewing", "withdrawn", 2),
    ];

    const data = buildJobSankeyData(applications, events);
    const links = new Map(data.links.map((link) => [`${link.source}:${link.target}`, link.value]));

    expect(links).toEqual(
      new Map([
        ["applications:round-1", 2],
        ["round-1:round-2", 1],
        ["round-2:offer", 1],
        ["offer:declined", 1],
        ["round-1:withdrawn", 1],
      ]),
    );
    // Declined (offer stage) and withdrawn (earlier) are distinct outcome nodes.
    expect(data.nodes.find((node) => node.id === "declined")?.count).toBe(1);
    expect(data.nodes.find((node) => node.id === "withdrawn")?.count).toBe(1);
    // round-2 sits one column deeper than round-1.
    const roundOne = data.nodes.find((node) => node.id === "round-1");
    const roundTwo = data.nodes.find((node) => node.id === "round-2");
    expect(roundTwo?.column).toBe((roundOne?.column ?? 0) + 1);
  });

  it("converges matching results from different rounds into shared terminal nodes", () => {
    const applications = [
      application("direct-no-response", "no_response"),
      application("late-no-response", "no_response"),
      application("short-offer", "accepted"),
      application("late-offer", "accepted"),
    ];
    const events = [
      interview("late-no-response", 1),
      interview("late-no-response", 2),
      interview("late-no-response", 3),
      interview("late-offer", 1),
      interview("late-offer", 2),
      interview("late-offer", 3),
    ];

    const data = buildJobSankeyData(applications, events);
    const noResponses = data.nodes.filter((node) => node.label === "No response");
    const offers = data.nodes.filter((node) => node.label === "Offers");
    const columns = new Map(data.nodes.map((node) => [node.id, node.column]));
    const links = new Map(data.links.map((link) => [`${link.source}:${link.target}`, link.value]));

    expect(noResponses).toHaveLength(1);
    expect(noResponses[0].count).toBe(2);
    expect(offers).toHaveLength(1);
    expect(offers[0].count).toBe(2);
    expect(links.get("applications:no_response")).toBe(1);
    expect(links.get("round-3:no_response")).toBe(1);
    expect(links.get("round-1:offer")).toBe(1);
    expect(links.get("round-3:offer")).toBe(1);
    expect(columns.get("offer")).toBe(4);
    expect(columns.get("no_response")).toBe(5);
    expect(columns.get("accepted")).toBe(5);

    const layout = buildJobSankeyLayout(data);
    const positioned = new Map(layout.nodes.map((node) => [node.id, node]));
    const sourceBottom = positioned.get("applications")!.y + positioned.get("applications")!.height;
    expect(layout.width).toBe(1200);
    ["round-1", "round-2", "round-3", "offer"].forEach((id) => {
      const node = positioned.get(id)!;
      expect(node.y + node.height).toBeCloseTo(sourceBottom);
    });
  });

  it("connects every ribbon exactly to its source and target node", () => {
    const data = buildJobSankeyData(
      [application("waiting", "applied"), application("accepted", "accepted")],
      [],
    );
    const layout = buildJobSankeyLayout(data);
    const nodes = new Map(layout.nodes.map((node) => [node.id, node]));

    layout.links.forEach((link) => {
      const source = nodes.get(link.source)!;
      const target = nodes.get(link.target)!;
      expect(link.sourceX).toBe(source.x + source.width);
      expect(link.targetX).toBe(target.x);
      expect(link.sourceTop).toBeGreaterThanOrEqual(source.y);
      expect(link.sourceTop + link.thickness).toBeLessThanOrEqual(source.y + source.height);
      expect(link.targetTop).toBeGreaterThanOrEqual(target.y);
      expect(link.targetTop + link.thickness).toBeLessThanOrEqual(target.y + target.height);
    });
  });
});
