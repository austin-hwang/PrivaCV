import {
  JOB_APPLICATION_STATUSES,
  localDateToday,
  type ApplicationEvent,
  type JobApplication,
  type JobApplicationStatus,
} from "@/lib/job-applications";

/** Statuses that indicate an employer actually replied. */
const RESPONSE_STATUSES: readonly JobApplicationStatus[] = [
  "interviewing",
  "offer",
  "accepted",
  "rejected",
];
const OFFER_STATUSES: readonly JobApplicationStatus[] = ["offer", "accepted"];

export type WeeklyCount = { weekStart: string; count: number };
export type StageDuration = {
  status: JobApplicationStatus;
  averageDays: number | null;
  samples: number;
};

export type JobInsights = {
  submitted: number;
  responded: number;
  responseRate: number | null;
  interviewed: number;
  interviewRate: number | null;
  offered: number;
  offeredAfterInterview: number;
  offerRate: number | null;
  perWeek: WeeklyCount[];
  stageDurations: StageDuration[];
  reachedCounts: Record<JobApplicationStatus, number>;
};

type StageEntry = { status: JobApplicationStatus; at: string };

const DAY_MS = 86_400_000;

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/** Monday (local) of the week containing the given YYYY-MM-DD date. */
function weekStartOf(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7; // 0 = Monday
  date.setUTCDate(date.getUTCDate() - weekday);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function localDateOf(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return localDateToday(date);
}

/** Ordered stage-entry timeline for one application, derived from its events. */
function stageEntriesFor(application: JobApplication, events: ApplicationEvent[]): StageEntry[] {
  const entries: StageEntry[] = [];
  const ordered = [...events].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );
  for (const event of ordered) {
    if ((event.type === "created" || event.type === "status_changed") && event.toStatus) {
      entries.push({ status: event.toStatus, at: event.occurredAt });
    }
  }
  if (!entries.length) {
    entries.push({ status: application.status, at: application.createdAt });
  }
  return entries;
}

export function buildJobInsights(
  applications: JobApplication[],
  events: ApplicationEvent[],
  { today = localDateToday(), maxWeeks = 12 }: { today?: string; maxWeeks?: number } = {},
): JobInsights {
  const eventsByApplication = new Map<string, ApplicationEvent[]>();
  for (const event of events) {
    const list = eventsByApplication.get(event.applicationId) ?? [];
    list.push(event);
    eventsByApplication.set(event.applicationId, list);
  }

  const reachedCounts = Object.fromEntries(
    JOB_APPLICATION_STATUSES.map((status) => [status, 0]),
  ) as Record<JobApplicationStatus, number>;

  const durationTotals = new Map<JobApplicationStatus, { total: number; samples: number }>();
  const weekTotals = new Map<string, number>();
  let submitted = 0;
  let responded = 0;
  let interviewed = 0;
  let offered = 0;
  let offeredAfterInterview = 0;

  for (const application of applications) {
    const appEvents = eventsByApplication.get(application.id) ?? [];
    const reached = new Set<JobApplicationStatus>([application.status]);
    for (const event of appEvents) if (event.toStatus) reached.add(event.toStatus);
    for (const status of reached) reachedCounts[status] += 1;

    if (application.appliedAt) {
      submitted += 1;
      if (RESPONSE_STATUSES.some((status) => reached.has(status))) responded += 1;
      if (reached.has("interviewing")) interviewed += 1;
      if (OFFER_STATUSES.some((status) => reached.has(status))) {
        offered += 1;
        if (reached.has("interviewing")) offeredAfterInterview += 1;
      }
      const week = weekStartOf(localDateOf(application.appliedAt));
      if (week) weekTotals.set(week, (weekTotals.get(week) ?? 0) + 1);
    }

    const entries = stageEntriesFor(application, appEvents);
    for (let index = 0; index < entries.length - 1; index += 1) {
      const span =
        new Date(entries[index + 1].at).getTime() - new Date(entries[index].at).getTime();
      if (!Number.isFinite(span) || span < 0) continue;
      const bucket = durationTotals.get(entries[index].status) ?? { total: 0, samples: 0 };
      bucket.total += span;
      bucket.samples += 1;
      durationTotals.set(entries[index].status, bucket);
    }
  }

  return {
    submitted,
    responded,
    responseRate: submitted ? responded / submitted : null,
    interviewed,
    interviewRate: submitted ? interviewed / submitted : null,
    offered,
    offeredAfterInterview,
    offerRate: interviewed ? offeredAfterInterview / interviewed : null,
    perWeek: buildWeeklySeries(weekTotals, today, maxWeeks),
    stageDurations: JOB_APPLICATION_STATUSES.map((status) => {
      const bucket = durationTotals.get(status);
      return {
        status,
        samples: bucket?.samples ?? 0,
        averageDays: bucket && bucket.samples ? bucket.total / bucket.samples / DAY_MS : null,
      };
    }),
    reachedCounts,
  };
}

/** A continuous run of weeks ending at the current week, with zero-filled gaps. */
function buildWeeklySeries(
  weekTotals: Map<string, number>,
  today: string,
  maxWeeks: number,
): WeeklyCount[] {
  if (!weekTotals.size) return [];
  const currentWeek = weekStartOf(today);
  const earliest = [...weekTotals.keys()].sort()[0];
  const series: WeeklyCount[] = [];
  let cursor = earliest;
  // Guard against runaway loops on malformed data.
  for (let guard = 0; guard < 520 && cursor <= currentWeek; guard += 1) {
    series.push({ weekStart: cursor, count: weekTotals.get(cursor) ?? 0 });
    const [year, month, day] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + 7));
    cursor = `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
  }
  return series.slice(-maxWeeks);
}
