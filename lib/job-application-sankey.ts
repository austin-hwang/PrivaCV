import {
  type ApplicationEvent,
  type JobApplication,
  type JobApplicationStatus,
} from "@/lib/job-applications";

/**
 * Node ids are strings because interview rounds are dynamic: the funnel has one
 * node per round reached (`round-1`, `round-2`, …), followed by shared offer and
 * terminal-outcome nodes.
 */
export type JobSankeyNodeId = string;

export const APPLICATIONS_NODE_ID = "applications";
export const OFFER_NODE_ID = "offer";

export type JobSankeyNode = {
  id: JobSankeyNodeId;
  label: string;
  count: number;
  /** Semantic phase in the funnel; drives the column layout. */
  column: number;
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
  /** Highest column index in use; layout distributes columns across this range. */
  maxColumn: number;
};

const APPLICATIONS_COLOR = "#059669";
const OFFER_COLOR = "#d97706";

/** Colours cycled across interview rounds, deepening as the funnel narrows. */
const ROUND_COLORS = ["#ea580c", "#65a30d", "#0d9488", "#4f46e5", "#a16207", "#0891b2"];

type NodeMeta = { label: string; color: string };

const OUTCOME_META: Record<string, NodeMeta> = {
  awaiting: { label: "Awaiting response", color: "#0284c7" },
  accepted: { label: "Accepted", color: "#16a34a" },
  declined: { label: "Declined", color: "#db2777" },
  rejected: { label: "Not selected", color: "#7c3aed" },
  withdrawn: { label: "Withdrawn", color: "#64748b" },
  no_response: { label: "No response", color: "#e11d48" },
};

const SUBMITTED_STATUSES = new Set<JobApplicationStatus>([
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "no_response",
]);

function ordinal(value: number) {
  const suffixes = ["th", "st", "nd", "rd"];
  const remainder = value % 100;
  return `${value}${suffixes[(remainder - 20) % 10] ?? suffixes[remainder] ?? suffixes[0]}`;
}

function roundNode(round: number): { id: string } & NodeMeta {
  return {
    id: `round-${round}`,
    label: `${ordinal(round)} round`,
    color: ROUND_COLORS[(round - 1) % ROUND_COLORS.length],
  };
}

function journeyStatuses(application: JobApplication, events: ApplicationEvent[]) {
  const statuses = new Set<JobApplicationStatus>([application.status]);
  events.forEach((event) => {
    if (event.applicationId !== application.id) return;
    if (event.fromStatus) statuses.add(event.fromStatus);
    if (event.toStatus) statuses.add(event.toStatus);
  });
  return statuses;
}

function interviewRounds(application: JobApplication, events: ApplicationEvent[]) {
  return events.filter(
    (event) => event.applicationId === application.id && event.type === "interview",
  ).length;
}

/**
 * The outcome node for a closed application. Offer-stage withdrawals surface as
 * their own "Declined" node so declining an offer reads differently from
 * bowing out earlier.
 */
function outcomeId(status: JobApplicationStatus, fromOffer: boolean): string {
  switch (status) {
    case "accepted":
      return "accepted";
    case "rejected":
      return "rejected";
    case "no_response":
      return "no_response";
    case "withdrawn":
      return fromOffer ? "declined" : "withdrawn";
    default:
      return "awaiting";
  }
}

export function buildJobSankeyData(
  applications: JobApplication[],
  events: ApplicationEvent[],
): JobSankeyData {
  const nodeCounts = new Map<JobSankeyNodeId, number>();
  const nodeMeta = new Map<JobSankeyNodeId, NodeMeta>();
  const linkCounts = new Map<string, JobSankeyLink>();

  const ensureMeta = (id: JobSankeyNodeId, meta: NodeMeta) => {
    if (!nodeMeta.has(id)) nodeMeta.set(id, meta);
  };
  const incrementNode = (id: JobSankeyNodeId, meta: NodeMeta) => {
    ensureMeta(id, meta);
    nodeCounts.set(id, (nodeCounts.get(id) ?? 0) + 1);
  };
  const incrementLink = (source: JobSankeyNodeId, target: JobSankeyNodeId) => {
    const key = `${source}\u0000${target}`;
    const current = linkCounts.get(key);
    linkCounts.set(key, { source, target, value: (current?.value ?? 0) + 1 });
  };

  let excluded = 0;
  applications.forEach((application) => {
    const statuses = journeyStatuses(application, events);
    const submitted =
      Boolean(application.appliedAt) ||
      [...statuses].some((status) => SUBMITTED_STATUSES.has(status));
    if (!submitted) {
      excluded += 1;
      return;
    }

    incrementNode(APPLICATIONS_NODE_ID, { label: "Applications", color: APPLICATIONS_COLOR });

    const reachedOffer = statuses.has("offer") || statuses.has("accepted");
    const reachedInterview =
      reachedOffer || statuses.has("interviewing") || interviewRounds(application, events) > 0;

    // No interviews recorded: the application flows straight to its outcome.
    if (!reachedInterview) {
      const outcome = outcomeId(application.status, false);
      incrementNode(outcome, OUTCOME_META[outcome]);
      incrementLink(APPLICATIONS_NODE_ID, outcome);
      return;
    }

    // At least one round; a bare status transition into interviewing still
    // counts as a first round even when no interview event was logged.
    const rounds = Math.max(interviewRounds(application, events), 1);
    let previous = APPLICATIONS_NODE_ID;
    for (let round = 1; round <= rounds; round += 1) {
      const node = roundNode(round);
      incrementNode(node.id, { label: node.label, color: node.color });
      incrementLink(previous, node.id);
      previous = node.id;
    }

    if (reachedOffer) {
      incrementNode(OFFER_NODE_ID, { label: "Offers", color: OFFER_COLOR });
      incrementLink(previous, OFFER_NODE_ID);
      previous = OFFER_NODE_ID;
    }

    // The natural in-progress status of the deepest stage is an endpoint, not a
    // terminal outcome (the node itself represents "still here").
    const inProgressStatus: JobApplicationStatus = reachedOffer ? "offer" : "interviewing";
    if (application.status !== inProgressStatus) {
      const outcome = outcomeId(application.status, reachedOffer);
      incrementNode(outcome, OUTCOME_META[outcome]);
      incrementLink(previous, outcome);
    }
  });

  const links = [...linkCounts.values()];
  const maxRound = [...nodeCounts.keys()].reduce((deepest, id) => {
    const match = /^round-(\d+)$/.exec(id);
    return match ? Math.max(deepest, Number(match[1])) : deepest;
  }, 0);
  const offerColumn = maxRound + 1;
  const outcomeColumn = maxRound + (nodeCounts.has(OFFER_NODE_ID) ? 2 : 1);
  const columnFor = (id: JobSankeyNodeId) => {
    if (id === APPLICATIONS_NODE_ID) return 0;
    const round = /^round-(\d+)$/.exec(id);
    if (round) return Number(round[1]);
    if (id === OFFER_NODE_ID) return offerColumn;
    return outcomeColumn;
  };

  const nodes: JobSankeyNode[] = [...nodeCounts.entries()].map(([id, count]) => ({
    id,
    label: nodeMeta.get(id)?.label ?? id,
    color: nodeMeta.get(id)?.color ?? "#64748b",
    count,
    column: columnFor(id),
  }));
  nodes.sort((left, right) => left.column - right.column);

  return {
    nodes,
    links,
    total: nodeCounts.get(APPLICATIONS_NODE_ID) ?? 0,
    excluded,
    maxColumn: nodes.reduce((max, node) => Math.max(max, node.column), 0),
  };
}
