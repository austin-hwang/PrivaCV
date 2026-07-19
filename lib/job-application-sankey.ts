import {
  type ApplicationEvent,
  type JobApplication,
  type JobApplicationStatus,
} from "@/lib/job-applications";

export const JOB_SANKEY_NODE_IDS = [
  "applications",
  "interviewing",
  "offer",
  "awaiting",
  "accepted",
  "rejected",
  "withdrawn",
  "no_response",
] as const;

export type JobSankeyNodeId = (typeof JOB_SANKEY_NODE_IDS)[number];

export type JobSankeyNode = {
  id: JobSankeyNodeId;
  label: string;
  count: number;
  column: 0 | 1 | 2 | 3;
  color: string;
};

export type JobSankeyLink = {
  source: JobSankeyNodeId;
  target: JobSankeyNodeId;
  value: number;
};

export type JobSankeyData = {
  nodes: JobSankeyNode[];
  links: JobSankeyLink[];
  total: number;
  excluded: number;
};

const NODE_META: Record<JobSankeyNodeId, Omit<JobSankeyNode, "count">> = {
  applications: { id: "applications", label: "Applications", column: 0, color: "#2563eb" },
  interviewing: { id: "interviewing", label: "Interviewing", column: 1, color: "#7c3aed" },
  offer: { id: "offer", label: "Offers", column: 2, color: "#d97706" },
  awaiting: { id: "awaiting", label: "Awaiting response", column: 3, color: "#0284c7" },
  accepted: { id: "accepted", label: "Accepted", column: 3, color: "#16a34a" },
  rejected: { id: "rejected", label: "Not selected", column: 3, color: "#dc2626" },
  withdrawn: { id: "withdrawn", label: "Withdrawn", column: 3, color: "#64748b" },
  no_response: { id: "no_response", label: "No response", column: 3, color: "#475569" },
};

const SUBMITTED_STATUSES = new Set<JobApplicationStatus>([
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "no_response",
]);

function journeyStatuses(application: JobApplication, events: ApplicationEvent[]) {
  const statuses = new Set<JobApplicationStatus>([application.status]);
  events.forEach((event) => {
    if (event.applicationId !== application.id) return;
    if (event.fromStatus) statuses.add(event.fromStatus);
    if (event.toStatus) statuses.add(event.toStatus);
  });
  return statuses;
}

function terminalNode(status: JobApplicationStatus): JobSankeyNodeId {
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "withdrawn") return "withdrawn";
  if (status === "no_response") return "no_response";
  return "awaiting";
}

export function buildJobSankeyData(applications: JobApplication[], events: ApplicationEvent[]): JobSankeyData {
  const nodeCounts = new Map<JobSankeyNodeId, number>();
  const linkCounts = new Map<string, JobSankeyLink>();

  const incrementNode = (id: JobSankeyNodeId) => nodeCounts.set(id, (nodeCounts.get(id) ?? 0) + 1);
  const incrementLink = (source: JobSankeyNodeId, target: JobSankeyNodeId) => {
    const key = `${source}:${target}`;
    const current = linkCounts.get(key);
    linkCounts.set(key, { source, target, value: (current?.value ?? 0) + 1 });
  };

  let excluded = 0;
  applications.forEach((application) => {
    const statuses = journeyStatuses(application, events);
    const submitted = Boolean(application.appliedAt)
      || [...statuses].some((status) => SUBMITTED_STATUSES.has(status));
    if (!submitted) {
      excluded += 1;
      return;
    }

    incrementNode("applications");
    const reachedOffer = statuses.has("offer") || statuses.has("accepted");
    const reachedInterview = reachedOffer || statuses.has("interviewing");

    if (!reachedInterview) {
      const outcome = terminalNode(application.status);
      incrementNode(outcome);
      incrementLink("applications", outcome);
      return;
    }

    incrementNode("interviewing");
    incrementLink("applications", "interviewing");
    if (!reachedOffer) {
      if (application.status !== "interviewing") {
        const outcome = terminalNode(application.status);
        incrementNode(outcome);
        incrementLink("interviewing", outcome);
      }
      return;
    }

    incrementNode("offer");
    incrementLink("interviewing", "offer");
    if (application.status !== "offer") {
      const outcome = terminalNode(application.status);
      incrementNode(outcome);
      incrementLink("offer", outcome);
    }
  });

  return {
    nodes: JOB_SANKEY_NODE_IDS
      .filter((id) => (nodeCounts.get(id) ?? 0) > 0)
      .map((id) => ({ ...NODE_META[id], count: nodeCounts.get(id) ?? 0 })),
    links: [...linkCounts.values()],
    total: nodeCounts.get("applications") ?? 0,
    excluded,
  };
}
