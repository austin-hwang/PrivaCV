export const JOB_APPLICATION_STATUSES = [
  "saved",
  "preparing",
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "no_response",
] as const;

export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export const ACTIVE_JOB_APPLICATION_STATUSES = [
  "saved",
  "preparing",
  "applied",
  "interviewing",
  "offer",
] as const satisfies readonly JobApplicationStatus[];

export const CLOSED_JOB_APPLICATION_STATUSES = [
  "accepted",
  "rejected",
  "withdrawn",
  "no_response",
] as const satisfies readonly JobApplicationStatus[];

export const JOB_APPLICATION_STATUS_META: Record<
  JobApplicationStatus,
  { label: string; shortLabel: string; description: string }
> = {
  saved: { label: "Saved", shortLabel: "Saved", description: "Interesting roles to review" },
  preparing: { label: "Preparing", shortLabel: "Preparing", description: "Tailoring materials before applying" },
  applied: { label: "Applied", shortLabel: "Applied", description: "Submitted and awaiting a response" },
  interviewing: { label: "Interviewing", shortLabel: "Interview", description: "Active conversations and interviews" },
  offer: { label: "Offer", shortLabel: "Offer", description: "An offer is under consideration" },
  accepted: { label: "Accepted", shortLabel: "Accepted", description: "Offer accepted" },
  rejected: { label: "Not selected", shortLabel: "Rejected", description: "The employer chose another candidate" },
  withdrawn: { label: "Withdrawn", shortLabel: "Withdrawn", description: "You ended the process" },
  no_response: { label: "No response", shortLabel: "No response", description: "The process went quiet" },
};

export type JobApplication = {
  id: string;
  company: string;
  role: string;
  status: JobApplicationStatus;
  sourceUrl: string;
  source: string;
  location: string;
  compensation: string;
  contactName: string;
  contactEmail: string;
  notes: string;
  nextAction: string;
  /** Local calendar date in YYYY-MM-DD format. */
  nextActionAt: string;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  closedAt?: string;
};

export type JobSnapshot = {
  applicationId: string;
  sourceUrl: string;
  description: string;
  capturedAt: string;
  updatedAt: string;
};

export type ResumeSnapshot = {
  id: string;
  applicationId: string;
  resumeId?: string;
  checkpointId?: string;
  label: string;
  capturedAt: string;
  /** Reserved for an immutable resume snapshot when resume linking is added. */
  data?: unknown;
};

export type ApplicationEventType = "created" | "status_changed" | "note";

export type ApplicationEvent = {
  id: string;
  applicationId: string;
  type: ApplicationEventType;
  title: string;
  detail?: string;
  occurredAt: string;
  fromStatus?: JobApplicationStatus;
  toStatus?: JobApplicationStatus;
};

export type JobApplicationDraft = Pick<JobApplication, "company" | "role"> &
  Partial<Omit<JobApplication, "id" | "company" | "role" | "createdAt" | "updatedAt">> & {
    jobDescription?: string;
  };

export type JobPipelineData = {
  applications: JobApplication[];
  events: ApplicationEvent[];
  jobSnapshots: JobSnapshot[];
  resumeSnapshots: ResumeSnapshot[];
};

export type JobPipelineStats = {
  total: number;
  active: number;
  interviewing: number;
  offers: number;
  overdue: number;
  closed: number;
};

const statusSet = new Set<string>(JOB_APPLICATION_STATUSES);
const closedStatusSet = new Set<JobApplicationStatus>(CLOSED_JOB_APPLICATION_STATUSES);
const appliedStatusSet = new Set<JobApplicationStatus>(["applied", "interviewing", "offer", "accepted", "rejected", "no_response"]);

export function isJobApplicationStatus(value: unknown): value is JobApplicationStatus {
  return typeof value === "string" && statusSet.has(value);
}

export function isClosedJobApplicationStatus(status: JobApplicationStatus) {
  return closedStatusSet.has(status);
}

export function createJobPipelineId(prefix: "application" | "event" | "resume") {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

export function createJobApplicationRecord(draft: JobApplicationDraft, now = new Date().toISOString()): JobApplication {
  const status = isJobApplicationStatus(draft.status) ? draft.status : "saved";
  const appliedAt = draft.appliedAt || (appliedStatusSet.has(status) ? now : undefined);
  const closedAt = draft.closedAt || (isClosedJobApplicationStatus(status) ? now : undefined);

  return {
    id: createJobPipelineId("application"),
    company: draft.company.trim(),
    role: draft.role.trim(),
    status,
    sourceUrl: draft.sourceUrl?.trim() ?? "",
    source: draft.source?.trim() ?? "",
    location: draft.location?.trim() ?? "",
    compensation: draft.compensation?.trim() ?? "",
    contactName: draft.contactName?.trim() ?? "",
    contactEmail: draft.contactEmail?.trim() ?? "",
    notes: draft.notes?.trim() ?? "",
    nextAction: draft.nextAction?.trim() ?? "",
    nextActionAt: draft.nextActionAt?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
    ...(appliedAt ? { appliedAt } : {}),
    ...(closedAt ? { closedAt } : {}),
  };
}

export function transitionJobApplication(
  application: JobApplication,
  status: JobApplicationStatus,
  now = new Date().toISOString(),
): JobApplication {
  if (status === application.status) return application;
  const appliedAt = application.appliedAt || (appliedStatusSet.has(status) ? now : undefined);
  const closedAt = isClosedJobApplicationStatus(status) ? now : undefined;

  return {
    ...application,
    status,
    updatedAt: now,
    ...(appliedAt ? { appliedAt } : {}),
    ...(closedAt ? { closedAt } : { closedAt: undefined }),
  };
}

export function createApplicationEvent(
  applicationId: string,
  type: ApplicationEventType,
  title: string,
  options: Partial<Pick<ApplicationEvent, "detail" | "fromStatus" | "toStatus" | "occurredAt">> = {},
): ApplicationEvent {
  return {
    id: createJobPipelineId("event"),
    applicationId,
    type,
    title,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    ...(options.detail ? { detail: options.detail } : {}),
    ...(options.fromStatus ? { fromStatus: options.fromStatus } : {}),
    ...(options.toStatus ? { toStatus: options.toStatus } : {}),
  };
}

export function sortJobApplications(applications: JobApplication[]) {
  return [...applications].sort((left, right) => {
    const leftDue = left.nextActionAt || "9999-12-31";
    const rightDue = right.nextActionAt || "9999-12-31";
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function jobApplicationMatches(application: JobApplication, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [
    application.company,
    application.role,
    application.location,
    application.source,
    application.contactName,
    application.notes,
  ].some((value) => value.toLocaleLowerCase().includes(normalized));
}

export function localDateToday(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isApplicationOverdue(application: JobApplication, today = localDateToday()) {
  return !isClosedJobApplicationStatus(application.status)
    && Boolean(application.nextActionAt)
    && application.nextActionAt < today;
}

export function jobPipelineStats(applications: JobApplication[], today = localDateToday()): JobPipelineStats {
  return applications.reduce<JobPipelineStats>((stats, application) => {
    stats.total += 1;
    if (isClosedJobApplicationStatus(application.status)) stats.closed += 1;
    else stats.active += 1;
    if (application.status === "interviewing") stats.interviewing += 1;
    if (application.status === "offer") stats.offers += 1;
    if (isApplicationOverdue(application, today)) stats.overdue += 1;
    return stats;
  }, { total: 0, active: 0, interviewing: 0, offers: 0, overdue: 0, closed: 0 });
}

export function formatApplicationDate(value: string, fallback = "No date") {
  if (!value) return fallback;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function applicationToCsvRow(application: JobApplication) {
  return [
    application.company,
    application.role,
    JOB_APPLICATION_STATUS_META[application.status].label,
    application.sourceUrl,
    application.source,
    application.location,
    application.compensation,
    application.contactName,
    application.contactEmail,
    application.nextAction,
    application.nextActionAt,
    application.appliedAt ?? "",
    application.closedAt ?? "",
    application.notes,
    application.createdAt,
    application.updatedAt,
  ];
}

export const JOB_APPLICATION_CSV_HEADERS = [
  "Company",
  "Role",
  "Status",
  "Job URL",
  "Source",
  "Location",
  "Compensation",
  "Contact name",
  "Contact email",
  "Next action",
  "Next action date",
  "Applied at",
  "Closed at",
  "Notes",
  "Created at",
  "Updated at",
];

export function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function jobApplicationsCsv(applications: JobApplication[]) {
  return [
    JOB_APPLICATION_CSV_HEADERS,
    ...sortJobApplications(applications).map(applicationToCsvRow),
  ].map((row) => row.map(csvCell).join(",")).join("\n");
}
