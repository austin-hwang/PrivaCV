"use client";

import { useMemo } from "react";
import { AlarmClock, CalendarCheck, CalendarClock, CalendarPlus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/features/applications/components/application-components";
import { APPLICATION_ACTIVITY_META, formatApplicationDate } from "@/lib/job-applications";
import type { ApplicationEvent, JobApplication } from "@/lib/job-applications";
import {
  buildReminders,
  groupReminders,
  type ReminderBucket,
  type ReminderItem,
} from "@/lib/job-reminders";
import { cn } from "@/lib/utils";

const BUCKET_META: Record<
  ReminderBucket,
  { title: string; description: string; tone: string; icon: typeof AlarmClock }
> = {
  overdue: {
    title: "Overdue",
    description: "Past their due date and still open",
    tone: "text-destructive",
    icon: AlarmClock,
  },
  today: {
    title: "Due today",
    description: "Everything on deck for today",
    tone: "text-primary",
    icon: CalendarClock,
  },
  upcoming: {
    title: "Upcoming",
    description: "What's coming next",
    tone: "text-muted-foreground",
    icon: CalendarCheck,
  },
};

function reminderTime(item: ReminderItem) {
  if (item.at) {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(item.at),
    );
  }
  return formatApplicationDate(item.date);
}

function ReminderRow({ item, onOpen }: { item: ReminderItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-left transition hover:border-primary/35 hover:shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.activityType ? (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {APPLICATION_ACTIVITY_META[item.activityType].label}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.role} · {item.company}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={item.status} />
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" /> {reminderTime(item)}
        </span>
      </div>
    </button>
  );
}

export function RemindersView({
  applications,
  events,
  onOpen,
  onExport,
}: {
  applications: JobApplication[];
  events: ApplicationEvent[];
  onOpen: (applicationId: string) => void;
  onExport: (items: ReminderItem[]) => void;
}) {
  const { groups, all } = useMemo(() => {
    const items = buildReminders(applications, events);
    return { groups: groupReminders(items), all: items };
  }, [applications, events]);

  const orderedBuckets: ReminderBucket[] = ["overdue", "today", "upcoming"];

  return (
    <div className="bg-muted/15 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {all.length
            ? `${all.length} ${all.length === 1 ? "reminder" : "reminders"} from your open applications`
            : "Reminders come from next-action dates and scheduled interviews, calls, and follow-ups."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!all.length}
          onClick={() => onExport(all)}
        >
          <CalendarPlus /> Export .ics
        </Button>
      </div>

      {all.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
            <CalendarCheck className="size-5 text-primary" />
          </span>
          <h3 className="mt-4 text-base font-semibold">You&apos;re all caught up</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Add a due date to a next action, or schedule an interview or call from an
            application&apos;s timeline, and it will show up here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          {orderedBuckets.map((bucket) => {
            const meta = BUCKET_META[bucket];
            const items = groups[bucket];
            return (
              <section key={bucket} className="rounded-xl border bg-muted/20 p-3">
                <header className="flex items-center justify-between gap-2 px-1 pb-3">
                  <h2 className={cn("flex items-center gap-2 text-sm font-semibold", meta.tone)}>
                    <meta.icon className="size-4" /> {meta.title}
                  </h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                </header>
                {items.length ? (
                  <div className="grid gap-2">
                    {items.map((item) => (
                      <ReminderRow
                        key={`${item.kind}-${item.id}`}
                        item={item}
                        onOpen={() => onOpen(item.applicationId)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-1 pb-2 text-xs text-muted-foreground">{meta.description}.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
