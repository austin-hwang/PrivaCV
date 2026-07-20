"use client";

import { useMemo } from "react";
import { BarChart3, MailCheck, Send, Trophy, Users } from "lucide-react";
import { STATUS_DOT_CLASSES } from "@/features/applications/components/application-components";
import { JOB_APPLICATION_STATUS_META } from "@/lib/job-applications";
import type { ApplicationEvent, JobApplication } from "@/lib/job-applications";
import { buildJobInsights } from "@/lib/job-insights";
import { cn } from "@/lib/utils";

function formatPercent(rate: number | null) {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

function formatDays(days: number | null) {
  if (days === null) return "—";
  if (days < 1) return "<1 day";
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} ${rounded === 1 ? "day" : "days"}`;
}

function weekLabel(weekStart: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
    new Date(`${weekStart}T12:00:00`),
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Send;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function InsightsView({
  applications,
  events,
}: {
  applications: JobApplication[];
  events: ApplicationEvent[];
}) {
  const insights = useMemo(() => buildJobInsights(applications, events), [applications, events]);
  const weeklyMax = Math.max(1, ...insights.perWeek.map((week) => week.count));
  const stageDurations = insights.stageDurations.filter((entry) => entry.samples > 0);
  const stageMax = Math.max(1, ...stageDurations.map((entry) => entry.averageDays ?? 0));

  if (!insights.submitted) {
    return (
      <div className="bg-muted/15 p-4">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-dashed bg-card px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border bg-muted/40">
            <BarChart3 className="size-5 text-primary" />
          </span>
          <h3 className="mt-4 text-base font-semibold">No insights yet</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            Once you move applications to Applied and beyond, PrivaCV charts your response rate,
            interview conversion, weekly pace, and time in each stage here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 bg-muted/15 p-4">
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Conversion metrics">
        <StatTile
          label="Applications sent"
          value={String(insights.submitted)}
          hint="Reached Applied or beyond"
          icon={Send}
        />
        <StatTile
          label="Response rate"
          value={formatPercent(insights.responseRate)}
          hint={`${insights.responded} of ${insights.submitted} heard back`}
          icon={MailCheck}
        />
        <StatTile
          label="Interview rate"
          value={formatPercent(insights.interviewRate)}
          hint={`${insights.interviewed} reached interviewing`}
          icon={Users}
        />
        <StatTile
          label="Offer rate"
          value={formatPercent(insights.offerRate)}
          hint={`${insights.offered} of ${insights.interviewed} interviewed`}
          icon={Trophy}
        />
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Applications per week</h2>
        <p className="mt-1 text-xs text-muted-foreground">Submissions by the week you applied.</p>
        {insights.perWeek.length ? (
          <div className="mt-5 flex items-end gap-2" style={{ minHeight: "9rem" }}>
            {insights.perWeek.map((week) => (
              <div key={week.weekStart} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {week.count}
                </span>
                <div className="flex h-28 w-full items-end">
                  <div
                    className="w-full rounded-t bg-primary/80 transition-[height]"
                    style={{
                      height: `${Math.max(week.count ? 6 : 0, (week.count / weeklyMax) * 100)}%`,
                    }}
                    title={`${week.count} on week of ${weekLabel(week.weekStart)}`}
                  />
                </div>
                <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                  {weekLabel(week.weekStart)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No submissions recorded yet.</p>
        )}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Time in each stage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Average time an application waited before moving on.
        </p>
        {stageDurations.length ? (
          <ul className="mt-4 grid gap-3">
            {stageDurations.map((entry) => (
              <li key={entry.status} className="grid grid-cols-[7rem_1fr_4rem] items-center gap-3">
                <span className="flex items-center gap-2 text-xs font-medium">
                  <span className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[entry.status])} />
                  <span className="truncate">
                    {JOB_APPLICATION_STATUS_META[entry.status].label}
                  </span>
                </span>
                <span className="h-2.5 rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", STATUS_DOT_CLASSES[entry.status])}
                    style={{
                      width: `${Math.max(4, ((entry.averageDays ?? 0) / stageMax) * 100)}%`,
                    }}
                  />
                </span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                  {formatDays(entry.averageDays)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Move applications between stages to measure how long each step takes.
          </p>
        )}
      </section>
    </div>
  );
}
