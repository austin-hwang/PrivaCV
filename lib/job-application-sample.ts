import type {
  ApplicationEvent,
  ApplicationEventType,
  JobApplication,
  JobApplicationStatus,
  JobPipelineData,
  JobSnapshot,
} from "@/lib/job-applications";

type SampleApplication = {
  key: string;
  company: string;
  role: string;
  status: JobApplicationStatus;
  location: string;
  compensation: string;
  source: string;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  appliedDaysAgo?: number;
  closedDaysAgo?: number;
  nextAction?: string;
  nextActionDaysFromNow?: number;
  contactName?: string;
  contactEmail?: string;
  notes: string;
  description: string;
};

type SampleEvent = {
  applicationKey: string;
  key: string;
  type: ApplicationEventType;
  title: string;
  detail?: string;
  daysFromNow: number;
  fromStatus?: JobApplicationStatus;
  toStatus?: JobApplicationStatus;
};

const APPLICATIONS: SampleApplication[] = [
  {
    key: "northstar",
    company: "Northstar Analytics",
    role: "Senior Product Designer",
    status: "saved",
    location: "Remote (US)",
    compensation: "$155k–$185k + equity",
    source: "LinkedIn",
    createdDaysAgo: 4,
    updatedDaysAgo: 1,
    nextAction: "Review portfolio fit and ask Maya for a referral",
    nextActionDaysFromNow: 2,
    contactName: "Maya Chen",
    contactEmail: "maya.chen@example.com",
    notes: "Strong match for analytics workflows and design systems experience.",
    description:
      "Lead end-to-end product design for an analytics platform used by operations teams. Partner with product and engineering, evolve the design system, and mentor designers.",
  },
  {
    key: "lantern",
    company: "Lantern Health",
    role: "Staff UX Researcher",
    status: "preparing",
    location: "Boston, MA / Hybrid",
    compensation: "$170k–$200k",
    source: "Company site",
    createdDaysAgo: 8,
    updatedDaysAgo: 1,
    nextAction: "Finish healthcare case-study edits",
    nextActionDaysFromNow: 1,
    notes: "Emphasize mixed-method research and work with regulated products.",
    description:
      "Shape the research strategy for patient and clinician tools. Plan generative and evaluative studies, synthesize insights, and influence the product roadmap.",
  },
  {
    key: "harborpay",
    company: "HarborPay",
    role: "Product Design Lead",
    status: "applied",
    location: "New York, NY / Hybrid",
    compensation: "$180k–$215k",
    source: "Referral",
    createdDaysAgo: 15,
    updatedDaysAgo: 9,
    appliedDaysAgo: 9,
    nextAction: "Follow up with recruiter",
    nextActionDaysFromNow: 1,
    contactName: "Elena Ruiz",
    contactEmail: "elena.ruiz@example.com",
    notes: "Referred by Jordan. Submitted the fintech-focused resume.",
    description:
      "Lead product design for merchant payments and reconciliation. Define experience strategy, facilitate workshops, and raise craft quality across the team.",
  },
  {
    key: "cedar",
    company: "Cedar Labs",
    role: "Principal Product Designer",
    status: "applied",
    location: "Remote",
    compensation: "$190k–$225k",
    source: "Otta",
    createdDaysAgo: 7,
    updatedDaysAgo: 5,
    appliedDaysAgo: 5,
    nextAction: "Wait for application review",
    nextActionDaysFromNow: 5,
    notes: "Role is focused on developer tooling and complex technical workflows.",
    description:
      "Own product design for cloud developer tooling. Simplify complex infrastructure workflows and establish reusable interaction patterns across the platform.",
  },
  {
    key: "aster",
    company: "Aster Cloud",
    role: "Staff Product Designer",
    status: "interviewing",
    location: "San Francisco, CA / Hybrid",
    compensation: "$185k–$220k + equity",
    source: "Referral",
    createdDaysAgo: 34,
    updatedDaysAgo: 1,
    appliedDaysAgo: 31,
    nextAction: "Final interview with VP Product",
    nextActionDaysFromNow: 2,
    contactName: "Priya Shah",
    contactEmail: "priya.shah@example.com",
    notes: "Recruiter screen and hiring-manager interview went well. Final round is next.",
    description:
      "Design administration and observability experiences for a multi-cloud platform. Work closely with enterprise customers and lead cross-product design initiatives.",
  },
  {
    key: "brightline",
    company: "Brightline Mobility",
    role: "Senior Product Designer, Growth",
    status: "interviewing",
    location: "Los Angeles, CA / Hybrid",
    compensation: "$150k–$180k",
    source: "LinkedIn",
    createdDaysAgo: 25,
    updatedDaysAgo: 2,
    appliedDaysAgo: 22,
    nextAction: "Present take-home exercise",
    nextActionDaysFromNow: 3,
    contactName: "Marcus Bell",
    contactEmail: "marcus.bell@example.com",
    notes: "Focus presentation on experimentation choices and customer trust.",
    description:
      "Improve rider activation and retention across mobile and web. Partner with growth, research, and data science to run high-quality experiments.",
  },
  {
    key: "fieldstone",
    company: "Fieldstone AI",
    role: "Design Manager",
    status: "interviewing",
    location: "Remote (US)",
    compensation: "$195k–$230k",
    source: "Recruiter outreach",
    createdDaysAgo: 40,
    updatedDaysAgo: 2,
    appliedDaysAgo: 37,
    nextAction: "Send panel thank-you notes",
    nextActionDaysFromNow: 0,
    contactName: "Noah Williams",
    contactEmail: "noah.williams@example.com",
    notes: "Completed leadership, cross-functional, and portfolio panels.",
    description:
      "Manage a team designing AI-assisted knowledge workflows. Coach designers, improve team operations, and partner with leaders on product strategy.",
  },
  {
    key: "juniper",
    company: "Juniper Commerce",
    role: "Principal UX Designer",
    status: "offer",
    location: "Seattle, WA / Hybrid",
    compensation: "$205k base + equity",
    source: "Former colleague",
    createdDaysAgo: 47,
    updatedDaysAgo: 1,
    appliedDaysAgo: 43,
    nextAction: "Review equity and respond to offer",
    nextActionDaysFromNow: 2,
    contactName: "Sofia Patel",
    contactEmail: "sofia.patel@example.com",
    notes: "Verbal offer received. Asked for the equity grant and refresh schedule in writing.",
    description:
      "Set experience direction for seller operations and fulfillment tools. Lead ambiguous initiatives across multiple product groups.",
  },
  {
    key: "orbit",
    company: "Orbit Systems",
    role: "Lead Product Designer",
    status: "accepted",
    location: "Denver, CO / Remote",
    compensation: "$178k + 15% bonus",
    source: "Referral",
    createdDaysAgo: 68,
    updatedDaysAgo: 8,
    appliedDaysAgo: 63,
    closedDaysAgo: 8,
    notes: "Accepted after negotiating the start date and remote-work terms.",
    description:
      "Lead design for planning and collaboration software used by distributed operations teams. Build a cohesive product vision and mentor senior designers.",
  },
  {
    key: "riverbend",
    company: "Riverbend Energy",
    role: "Senior Service Designer",
    status: "rejected",
    location: "Austin, TX / Hybrid",
    compensation: "$145k–$170k",
    source: "Company site",
    createdDaysAgo: 31,
    updatedDaysAgo: 20,
    appliedDaysAgo: 29,
    closedDaysAgo: 20,
    notes: "Recruiter said they needed deeper utility-sector experience.",
    description:
      "Map end-to-end customer and employee journeys for distributed energy products, then turn insights into service and product improvements.",
  },
  {
    key: "meridian",
    company: "Meridian Works",
    role: "Staff Product Designer",
    status: "rejected",
    location: "Chicago, IL / Hybrid",
    compensation: "$175k–$205k",
    source: "LinkedIn",
    createdDaysAgo: 55,
    updatedDaysAgo: 12,
    appliedDaysAgo: 51,
    closedDaysAgo: 12,
    notes: "Reached the portfolio panel; team selected someone with more marketplace experience.",
    description:
      "Define experiences for a two-sided professional marketplace, balancing buyer discovery, provider workflows, and platform trust.",
  },
  {
    key: "canvasworks",
    company: "CanvasWorks",
    role: "Product Design Director",
    status: "no_response",
    location: "Remote",
    compensation: "$210k–$245k",
    source: "Executive recruiter",
    createdDaysAgo: 49,
    updatedDaysAgo: 24,
    appliedDaysAgo: 45,
    closedDaysAgo: 24,
    notes: "No response after two follow-ups following the initial recruiter conversation.",
    description:
      "Lead the product design organization for a collaborative creative platform and partner with executives on company and product strategy.",
  },
  {
    key: "redwood",
    company: "Redwood Robotics",
    role: "Head of Product Design",
    status: "withdrawn",
    location: "San Jose, CA / On-site",
    compensation: "$220k–$260k + equity",
    source: "Recruiter outreach",
    createdDaysAgo: 28,
    updatedDaysAgo: 14,
    appliedDaysAgo: 25,
    closedDaysAgo: 14,
    notes: "Withdrew after learning the role requires five days per week on-site.",
    description:
      "Build and lead the product design function for industrial robotics software, spanning operator controls, fleet management, and analytics.",
  },
];

const EVENTS: SampleEvent[] = [
  {
    applicationKey: "aster",
    key: "screen",
    type: "call",
    title: "Recruiter screen",
    detail: "Discussed scope, hybrid schedule, and compensation range.",
    daysFromNow: -27,
  },
  {
    applicationKey: "aster",
    key: "manager",
    type: "interview",
    title: "Hiring-manager interview",
    detail: "Talked through platform strategy and a complex enterprise workflow.",
    daysFromNow: -19,
  },
  {
    applicationKey: "aster",
    key: "portfolio",
    type: "interview",
    title: "Portfolio review",
    detail: "Presented observability redesign and design-system case studies.",
    daysFromNow: -10,
  },
  {
    applicationKey: "aster",
    key: "final",
    type: "interview",
    title: "Final interview",
    detail: "Conversation with VP Product about influence and product direction.",
    daysFromNow: 2,
  },
  {
    applicationKey: "brightline",
    key: "screen",
    type: "call",
    title: "Recruiter screen",
    daysFromNow: -18,
  },
  {
    applicationKey: "brightline",
    key: "manager",
    type: "interview",
    title: "Growth design interview",
    detail: "Reviewed experiment design and activation metrics.",
    daysFromNow: -9,
  },
  {
    applicationKey: "brightline",
    key: "exercise",
    type: "interview",
    title: "Take-home presentation",
    detail: "Present activation audit to design, product, and data partners.",
    daysFromNow: 3,
  },
  {
    applicationKey: "fieldstone",
    key: "screen",
    type: "call",
    title: "Recruiter introduction",
    daysFromNow: -34,
  },
  {
    applicationKey: "fieldstone",
    key: "leadership",
    type: "interview",
    title: "Leadership interview",
    detail: "Discussed coaching, hiring, and team health.",
    daysFromNow: -20,
  },
  {
    applicationKey: "fieldstone",
    key: "portfolio",
    type: "interview",
    title: "Portfolio panel",
    detail: "Presented team-scale impact and AI workflow research.",
    daysFromNow: -8,
  },
  {
    applicationKey: "fieldstone",
    key: "panel",
    type: "interview",
    title: "Cross-functional panel",
    detail: "Met product, engineering, and research leaders.",
    daysFromNow: -2,
  },
  {
    applicationKey: "fieldstone",
    key: "thanks",
    type: "follow_up",
    title: "Panel thank-you notes",
    detail: "Send a short follow-up to each interviewer.",
    daysFromNow: 0,
  },
  {
    applicationKey: "juniper",
    key: "offer",
    type: "offer_update",
    title: "Verbal offer received",
    detail: "$205k base; equity details to follow.",
    daysFromNow: -3,
  },
  {
    applicationKey: "juniper",
    key: "negotiate",
    type: "offer_update",
    title: "Requested complete offer details",
    detail: "Asked about equity, refresh grants, and decision deadline.",
    daysFromNow: -1,
  },
  {
    applicationKey: "orbit",
    key: "accepted",
    type: "offer_update",
    title: "Offer accepted",
    detail: "Start date and remote terms confirmed.",
    daysFromNow: -8,
  },
  {
    applicationKey: "meridian",
    key: "screen",
    type: "call",
    title: "Recruiter screen",
    daysFromNow: -44,
  },
  {
    applicationKey: "meridian",
    key: "manager",
    type: "interview",
    title: "Hiring-manager interview",
    daysFromNow: -34,
  },
  {
    applicationKey: "meridian",
    key: "panel",
    type: "interview",
    title: "Portfolio panel",
    daysFromNow: -19,
  },
  {
    applicationKey: "canvasworks",
    key: "followup-one",
    type: "follow_up",
    title: "First follow-up sent",
    daysFromNow: -34,
  },
  {
    applicationKey: "canvasworks",
    key: "followup-two",
    type: "follow_up",
    title: "Second follow-up sent",
    daysFromNow: -27,
  },
];

function isoAtDay(reference: Date, daysFromNow: number, hour = 16) {
  const date = new Date(reference);
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function localDateAtDay(reference: Date, daysFromNow: number) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A realistic, repeatable pipeline that merges safely with a person's existing records. */
export function createSampleJobPipeline(reference = new Date()): JobPipelineData {
  const applications: JobApplication[] = APPLICATIONS.map((sample) => {
    const id = `application-sample-${sample.key}`;
    return {
      id,
      company: sample.company,
      role: sample.role,
      status: sample.status,
      sourceUrl: `https://jobs.example.com/${sample.key}`,
      source: sample.source,
      location: sample.location,
      compensation: sample.compensation,
      contactName: sample.contactName ?? "",
      contactEmail: sample.contactEmail ?? "",
      notes: sample.notes,
      nextAction: sample.nextAction ?? "",
      nextActionAt:
        sample.nextActionDaysFromNow === undefined
          ? ""
          : localDateAtDay(reference, sample.nextActionDaysFromNow),
      createdAt: isoAtDay(reference, -sample.createdDaysAgo, 10),
      updatedAt: isoAtDay(reference, -sample.updatedDaysAgo, 16),
      ...(sample.appliedDaysAgo === undefined
        ? {}
        : { appliedAt: isoAtDay(reference, -sample.appliedDaysAgo, 11) }),
      ...(sample.closedDaysAgo === undefined
        ? {}
        : { closedAt: isoAtDay(reference, -sample.closedDaysAgo, 16) }),
    };
  });

  const createdEvents: ApplicationEvent[] = applications.map((application) => ({
    id: `event-sample-${application.id.replace("application-sample-", "")}-created`,
    applicationId: application.id,
    type: "created",
    title: "Added to pipeline",
    occurredAt: application.createdAt,
    toStatus: "saved",
  }));
  const statusEvents: ApplicationEvent[] = applications
    .filter((application) => application.status !== "saved")
    .map((application) => ({
      id: `event-sample-${application.id.replace("application-sample-", "")}-status`,
      applicationId: application.id,
      type: "status_changed",
      title: `Moved to ${application.status.replace("_", " ")}`,
      occurredAt: application.appliedAt ?? application.updatedAt,
      fromStatus: "saved",
      toStatus: application.status,
    }));
  const activityEvents: ApplicationEvent[] = EVENTS.map((event) => ({
    id: `event-sample-${event.applicationKey}-${event.key}`,
    applicationId: `application-sample-${event.applicationKey}`,
    type: event.type,
    title: event.title,
    ...(event.detail ? { detail: event.detail } : {}),
    occurredAt: isoAtDay(reference, event.daysFromNow),
    ...(event.fromStatus ? { fromStatus: event.fromStatus } : {}),
    ...(event.toStatus ? { toStatus: event.toStatus } : {}),
  }));

  const jobSnapshots: JobSnapshot[] = APPLICATIONS.map((sample) => ({
    applicationId: `application-sample-${sample.key}`,
    sourceUrl: `https://jobs.example.com/${sample.key}`,
    description: sample.description,
    capturedAt: isoAtDay(reference, -sample.createdDaysAgo, 10),
    updatedAt: isoAtDay(reference, -sample.updatedDaysAgo, 16),
  }));

  return {
    applications,
    events: [...createdEvents, ...statusEvents, ...activityEvents],
    jobSnapshots,
    resumeSnapshots: [],
  };
}
