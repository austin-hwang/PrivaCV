"use client";

import { useMemo } from "react";
import { AlarmClock, CalendarCheck, CalendarClock, CalendarPlus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
    <Button
      variant="outline"
      onPress={onOpen}
      className="h-auto w-full justify-between gap-3 px-4 py-3 text-left"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.activityType ? (
            <Badge variant="secondary" className="shrink-0">
              {APPLICATION_ACTIVITY_META[item.activityType].label}
            </Badge>
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
    </Button>
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
          isDisabled={!all.length}
          onClick={() => onExport(all)}
        >
          <CalendarPlus data-icon="inline-start" /> Export .ics
        </Button>
      </div>

      {all.length === 0 ? (
        <Empty className="mx-auto min-h-72 max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarCheck />
            </EmptyMedia>
            <EmptyTitle>You&apos;re all caught up</EmptyTitle>
            <EmptyDescription>
              Add a due date to a next action, or schedule an interview or call from an
              application&apos;s timeline, and it will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                  <Badge variant="secondary" className="tabular-nums">
                    {items.length}
                  </Badge>
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
