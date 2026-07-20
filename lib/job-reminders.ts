import {
  APPLICATION_ACTIVITY_META,
  isApplicationActivityType,
  isClosedJobApplicationStatus,
  localDateToday,
  type ApplicationActivityType,
  type ApplicationEvent,
  type JobApplication,
  type JobApplicationStatus,
} from "@/lib/job-applications";

export type ReminderBucket = "overdue" | "today" | "upcoming";
export type ReminderKind = "next_action" | "activity";

export type ReminderItem = {
  /** Stable id: the application id for a next action, the event id for an activity. */
  id: string;
  applicationId: string;
  kind: ReminderKind;
  bucket: ReminderBucket;
  /** Local calendar date (YYYY-MM-DD) used for grouping and sorting. */
  date: string;
  /** ISO datetime when the source is a timed activity; absent for all-day next actions. */
  at?: string;
  title: string;
  detail?: string;
  company: string;
  role: string;
  status: JobApplicationStatus;
  activityType?: ApplicationActivityType;
};

export type ReminderGroups = {
  overdue: ReminderItem[];
  today: ReminderItem[];
  upcoming: ReminderItem[];
};

/** Convert an ISO datetime into a local YYYY-MM-DD calendar date. */
function localDateOf(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return localDateToday(date);
}

function bucketFor(date: string, today: string): ReminderBucket {
  if (date < today) return "overdue";
  if (date === today) return "today";
  return "upcoming";
}

/**
 * Build reminder items from open applications. Next actions with a due date can be
 * overdue, due today, or upcoming; scheduled activities (interviews, calls, follow-ups,
 * offer updates) surface only from today forward — past activities are timeline history.
 */
export function buildReminders(
  applications: JobApplication[],
  events: ApplicationEvent[],
  { today = localDateToday() }: { today?: string } = {},
): ReminderItem[] {
  const openApplications = new Map(
    applications
      .filter((application) => !isClosedJobApplicationStatus(application.status))
      .map((application) => [application.id, application]),
  );
  const items: ReminderItem[] = [];

  for (const application of openApplications.values()) {
    if (!application.nextActionAt) continue;
    items.push({
      id: application.id,
      applicationId: application.id,
      kind: "next_action",
      bucket: bucketFor(application.nextActionAt, today),
      date: application.nextActionAt,
      title: application.nextAction || "Follow up",
      company: application.company,
      role: application.role,
      status: application.status,
    });
  }

  for (const event of events) {
    if (!isApplicationActivityType(event.type)) continue;
    if (!APPLICATION_ACTIVITY_META[event.type].schedulable) continue;
    const application = openApplications.get(event.applicationId);
    if (!application) continue;
    const date = localDateOf(event.occurredAt);
    if (!date || date < today) continue;
    items.push({
      id: event.id,
      applicationId: event.applicationId,
      kind: "activity",
      bucket: bucketFor(date, today),
      date,
      at: event.occurredAt,
      title: event.title || APPLICATION_ACTIVITY_META[event.type].label,
      ...(event.detail ? { detail: event.detail } : {}),
      company: application.company,
      role: application.role,
      status: application.status,
      activityType: event.type,
    });
  }

  return items.sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    const leftAt = left.at ?? `${left.date}T00:00:00`;
    const rightAt = right.at ?? `${right.date}T00:00:00`;
    return leftAt.localeCompare(rightAt);
  });
}

export function groupReminders(items: ReminderItem[]): ReminderGroups {
  return items.reduce<ReminderGroups>(
    (groups, item) => {
      groups[item.bucket].push(item);
      return groups;
    },
    { overdue: [], today: [], upcoming: [] },
  );
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/** All-day date (YYYY-MM-DD) → ICS DATE value (YYYYMMDD). */
function icsDate(localDate: string) {
  return localDate.replace(/-/g, "");
}

/** ISO datetime → ICS UTC DATE-TIME value (YYYYMMDDTHHMMSSZ). */
function icsDateTime(iso: string) {
  const date = new Date(iso);
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

/** Add whole days to a YYYY-MM-DD date, staying calendar-only (no timezone drift). */
function shiftLocalDate(localDate: string, days: number) {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function icsEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Serialize reminders to an RFC 5545 calendar. Next actions become all-day events;
 * timed activities become one-hour events. Everything is generated on-device.
 */
export function remindersToIcs(items: ReminderItem[], now = new Date()): string {
  const stamp = icsDateTime(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PrivaCV//Job Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const item of items) {
    const summary = icsEscape(`${item.title} · ${item.company}`);
    const description = icsEscape(
      [item.role, item.detail].filter(Boolean).join(" — ") || item.role,
    );
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.kind}-${item.id}@privacv`);
    lines.push(`DTSTAMP:${stamp}`);
    if (item.at) {
      lines.push(`DTSTART:${icsDateTime(item.at)}`);
      lines.push(
        `DTEND:${icsDateTime(new Date(new Date(item.at).getTime() + 3_600_000).toISOString())}`,
      );
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(item.date)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(shiftLocalDate(item.date, 1))}`);
    }
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
