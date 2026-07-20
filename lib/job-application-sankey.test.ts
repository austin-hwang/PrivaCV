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
    expect(links).toEqual(
      new Map([
        ["applications:awaiting", 1],
        ["applications:rejected", 1],
        ["applications:interviewing", 2],
        ["interviewing:rejected", 1],
        ["interviewing:offer", 1],
        ["offer:accepted", 1],
      ]),
    );
    expect(data.nodes.find((node) => node.id === "interviewing")?.count).toBe(2);
    expect(data.nodes.find((node) => node.id === "accepted")?.count).toBe(1);
  });

  it("infers the prerequisite stages for an application recorded directly as accepted", () => {
    const data = buildJobSankeyData([application("accepted", "accepted")], []);

    expect(data.links).toEqual([
      { source: "applications", target: "interviewing", value: 1 },
      { source: "interviewing", target: "offer", value: 1 },
      { source: "offer", target: "accepted", value: 1 },
    ]);
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
