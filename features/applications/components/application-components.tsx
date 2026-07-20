"use client";

import {
  ArrowRightLeft,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileText,
  GripVertical,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Send,
  Sparkles,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ResumeSourceOption } from "@/features/applications/hooks/use-resume-sources";
import type { ApplicationActivityInput, ApplicationActivityUpdate } from "@/lib/job-application-db";
import {
  APPLICATION_ACTIVITY_META,
  APPLICATION_ACTIVITY_TYPES,
  JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_META,
  formatApplicationDate,
  isApplicationActivityType,
  isApplicationOverdue,
  type ApplicationActivityType,
  type ApplicationEvent,
  type ApplicationEventType,
  type JobApplication,
  type JobApplicationDraft,
  type JobApplicationStatus,
  type ResumeSnapshot,
} from "@/lib/job-applications";
import { cn } from "@/lib/utils";

export type ApplicationForm = {
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
  nextActionAt: string;
  jobDescription: string;
  resumeSourceKey: string;
};

const EMPTY_APPLICATION_FORM: ApplicationForm = {
  company: "",
  role: "",
  status: "saved",
  sourceUrl: "",
  source: "",
  location: "",
  compensation: "",
  contactName: "",
  contactEmail: "",
  notes: "",
  nextAction: "",
  nextActionAt: "",
  jobDescription: "",
  resumeSourceKey: "",
};

export const STATUS_DOT_CLASSES: Record<JobApplicationStatus, string> = {
  saved: "bg-slate-400",
  preparing: "bg-violet-500",
  applied: "bg-blue-500",
  interviewing: "bg-amber-500",
  offer: "bg-emerald-500",
  accepted: "bg-green-500",
  rejected: "bg-rose-500",
  withdrawn: "bg-zinc-500",
  no_response: "bg-orange-500",
};

const STATUS_BADGE_CLASSES: Record<JobApplicationStatus, string> = {
  saved: "border-slate-400/30 bg-slate-400/10 text-foreground",
  preparing: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  applied: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  interviewing: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  offer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  accepted: "border-green-500/30 bg-green-500/10 text-green-800 dark:text-green-300",
  rejected: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  withdrawn: "border-zinc-500/30 bg-zinc-500/10 text-muted-foreground",
  no_response: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",
};

export function StatusBadge({ status }: { status: JobApplicationStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 whitespace-nowrap font-medium", STATUS_BADGE_CLASSES[status])}
    >
      <span
        className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[status])}
        aria-hidden="true"
      />
      {JOB_APPLICATION_STATUS_META[status].label}
    </Badge>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm font-medium", className)}>
      <span>
        {label}
        {hint ? <span className="ml-1 font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function ApplicationFields({
  form,
  setField,
  includeDetails = true,
  statusOptions = JOB_APPLICATION_STATUSES,
  resumeSources,
  attachedSnapshot,
}: {
  form: ApplicationForm;
  setField: <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) => void;
  includeDetails?: boolean;
  statusOptions?: readonly JobApplicationStatus[];
  resumeSources: ResumeSourceOption[];
  attachedSnapshot?: ResumeSnapshot;
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company">
          <Input
            required
            autoComplete="organization"
            value={form.company}
            onChange={(event) => setField("company", event.target.value)}
            placeholder="Acme"
          />
        </Field>
        <Field label="Role">
          <Input
            required
            value={form.role}
            onChange={(event) => setField("role", event.target.value)}
            placeholder="Product designer"
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.status}
            onChange={(event) => setField("status", event.target.value as JobApplicationStatus)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {JOB_APPLICATION_STATUS_META[status].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location" hint="— optional">
          <Input
            value={form.location}
            onChange={(event) => setField("location", event.target.value)}
            placeholder="Remote or Seattle, WA"
          />
        </Field>
        <Field label="Resume for this application" hint="— optional" className="sm:col-span-2">
          <Select
            value={form.resumeSourceKey}
            onChange={(event) => setField("resumeSourceKey", event.target.value)}
          >
            <option value="">No resume attached</option>
            {resumeSources.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </Select>
          <span className="text-xs font-normal leading-relaxed text-muted-foreground">
            {attachedSnapshot
              ? `Submitted snapshot captured ${formatApplicationDate(attachedSnapshot.capturedAt)} · ${attachedSnapshot.label}`
              : "PrivaCV captures an immutable copy when this application reaches Applied."}
          </span>
        </Field>
      </div>

      <Field label="Job posting URL" hint="— optional">
        <Input
          type="url"
          inputMode="url"
          value={form.sourceUrl}
          onChange={(event) => setField("sourceUrl", event.target.value)}
          placeholder="https://company.com/jobs/..."
        />
      </Field>

      {includeDetails ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source" hint="— optional">
              <Input
                value={form.source}
                onChange={(event) => setField("source", event.target.value)}
                placeholder="LinkedIn, referral, company site"
              />
            </Field>
            <Field label="Compensation" hint="— optional">
              <Input
                value={form.compensation}
                onChange={(event) => setField("compensation", event.target.value)}
                placeholder="$120k–$150k"
              />
            </Field>
            <Field label="Contact name" hint="— optional">
              <Input
                value={form.contactName}
                onChange={(event) => setField("contactName", event.target.value)}
                placeholder="Recruiter or hiring manager"
              />
            </Field>
            <Field label="Contact email" hint="— optional">
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(event) => setField("contactEmail", event.target.value)}
                placeholder="name@company.com"
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Next action" hint="— optional">
              <Input
                value={form.nextAction}
                onChange={(event) => setField("nextAction", event.target.value)}
                placeholder="Follow up with recruiter"
              />
            </Field>
            <Field label="Due date" hint="— optional">
              <Input
                type="date"
                value={form.nextActionAt}
                onChange={(event) => setField("nextActionAt", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes" hint="— optional">
            <Textarea
              className="min-h-28"
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Interview context, people, questions, or decisions"
            />
          </Field>
        </>
      ) : null}

      <Field label="Job description snapshot" hint="— saved on this device">
        <Textarea
          className="min-h-40"
          value={form.jobDescription}
          onChange={(event) => setField("jobDescription", event.target.value)}
          placeholder="Paste the job description before the posting disappears..."
        />
      </Field>
    </div>
  );
}

export function CreateApplicationDialog({
  open,
  onOpenChange,
  saving,
  onCreate,
  resumeSources,
  defaultResumeSourceKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onCreate: (form: ApplicationForm) => Promise<unknown>;
  resumeSources: ResumeSourceOption[];
  defaultResumeSourceKey: string;
}) {
  const [form, setForm] = useState<ApplicationForm>(EMPTY_APPLICATION_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      setForm({ ...EMPTY_APPLICATION_FORM, resumeSourceKey: defaultResumeSourceKey });
      setFormError(null);
    }
    wasOpen.current = open;
  }, [defaultResumeSourceKey, open]);
  useEffect(() => {
    if (!open || !defaultResumeSourceKey) return;
    setForm((current) =>
      current.resumeSourceKey ? current : { ...current, resumeSourceKey: defaultResumeSourceKey },
    );
  }, [defaultResumeSourceKey, open]);

  const setField = <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      setFormError("Company and role are required.");
      return;
    }
    try {
      await onCreate(form);
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The application could not be created.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add an application</DialogTitle>
            <DialogDescription>
              Capture the role now. You can add contacts, notes, and follow-ups from its detail
              view.
            </DialogDescription>
          </DialogHeader>
          <ApplicationFields
            form={form}
            setField={setField}
            includeDetails={false}
            statusOptions={["saved", "preparing", "applied"]}
            resumeSources={resumeSources}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />} Add application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const EVENT_ICONS: Record<ApplicationEventType, LucideIcon> = {
  created: Sparkles,
  status_changed: ArrowRightLeft,
  resume_attached: FileText,
  note: StickyNote,
  interview: Users,
  call: Phone,
  follow_up: Send,
  offer_update: BadgeCheck,
};

/** ISO datetime → value for an <input type="datetime-local">. */
function toDateTimeLocal(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** datetime-local value → ISO datetime, or undefined when empty/invalid. */
function fromDateTimeLocal(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function ActivityComposer({
  applicationId,
  editing,
  disabled,
  onLog,
  onUpdate,
  onCancelEdit,
}: {
  applicationId: string;
  editing: ApplicationEvent | null;
  disabled: boolean;
  onLog: (applicationId: string, input: ApplicationActivityInput) => Promise<unknown>;
  onUpdate: (eventId: string, update: ApplicationActivityUpdate) => Promise<unknown>;
  onCancelEdit: () => void;
}) {
  const [type, setType] = useState<ApplicationActivityType>("note");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setType(isApplicationActivityType(editing.type) ? editing.type : "note");
    setTitle(editing.title);
    setDetail(editing.detail ?? "");
    setWhen(toDateTimeLocal(editing.occurredAt));
    setError(null);
  }, [editing]);

  const reset = () => {
    setType("note");
    setTitle("");
    setDetail("");
    setWhen("");
    setError(null);
  };

  const submit = async () => {
    if (!title.trim()) {
      setError("Add a short title for this activity.");
      return;
    }
    const occurredAt = fromDateTimeLocal(when);
    try {
      if (editing) {
        await onUpdate(editing.id, {
          type,
          title,
          detail,
          occurredAt: occurredAt ?? editing.occurredAt,
        });
        onCancelEdit();
      } else {
        await onLog(applicationId, {
          type,
          title,
          ...(detail.trim() ? { detail } : {}),
          ...(occurredAt ? { occurredAt } : {}),
        });
      }
      reset();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "The activity could not be saved.",
      );
    }
  };

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-3">
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <Select
          aria-label="Activity type"
          value={type}
          onChange={(event) => setType(event.target.value as ApplicationActivityType)}
        >
          {APPLICATION_ACTIVITY_TYPES.map((activityType) => (
            <option key={activityType} value={activityType}>
              {APPLICATION_ACTIVITY_META[activityType].label}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Activity title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={APPLICATION_ACTIVITY_META[type].placeholder}
        />
      </div>
      <Textarea
        className="min-h-16 text-sm"
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="Details — optional"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="datetime-local"
          aria-label="When"
          className="h-9 w-auto flex-1"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        />
        {editing ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancelEdit}
            disabled={disabled}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={() => void submit()} disabled={disabled}>
          {editing ? <CheckCircle2 /> : <Plus />} {editing ? "Save" : "Log"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Timeline({
  events,
  editingId,
  onEdit,
  onDelete,
}: {
  events: ApplicationEvent[];
  editingId: string | null;
  onEdit: (event: ApplicationEvent) => void;
  onDelete: (event: ApplicationEvent) => void;
}) {
  if (!events.length)
    return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  const now = Date.now();
  return (
    <ol className="grid gap-0">
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.type] ?? StickyNote;
        const editable = isApplicationActivityType(event.type);
        const scheduled = new Date(event.occurredAt).getTime() > now;
        return (
          <li key={event.id} className="group/event grid grid-cols-[1rem_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "mt-0.5 flex size-4 items-center justify-center rounded-full",
                  event.toStatus ? STATUS_DOT_CLASSES[event.toStatus] : "bg-muted",
                )}
              >
                <Icon
                  className={cn(
                    "size-2.5",
                    event.toStatus ? "text-white" : "text-muted-foreground",
                  )}
                />
              </span>
              {index < events.length - 1 ? (
                <span className="mt-1 min-h-8 w-px flex-1 bg-border" />
              ) : null}
            </div>
            <div className="pb-5">
              <div className="flex items-start justify-between gap-2">
                <p className={cn("text-sm font-medium", editingId === event.id && "text-primary")}>
                  {event.title}
                </p>
                {editable ? (
                  <span className="flex shrink-0 gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover/event:opacity-100">
                    <button
                      type="button"
                      aria-label="Edit activity"
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => onEdit(event)}
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete activity"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onDelete(event)}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                ) : null}
              </div>
              {event.detail ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
              ) : null}
              <time
                className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"
                dateTime={event.occurredAt}
              >
                {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
                  new Date(event.occurredAt),
                )}
                {scheduled ? (
                  <span className="rounded-full bg-primary/10 px-1.5 font-medium text-primary">
                    Scheduled
                  </span>
                ) : null}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function ApplicationDetailDialog({
  application,
  jobDescription,
  events,
  saving,
  onOpenChange,
  onSave,
  onDelete,
  onLogActivity,
  onUpdateActivity,
  onDeleteActivity,
  resumeSources,
  attachedSnapshot,
}: {
  application: JobApplication | null;
  jobDescription: string;
  events: ApplicationEvent[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (applicationId: string, update: ApplicationForm) => Promise<unknown>;
  onDelete: (applicationId: string) => Promise<unknown>;
  onLogActivity: (applicationId: string, input: ApplicationActivityInput) => Promise<unknown>;
  onUpdateActivity: (eventId: string, update: ApplicationActivityUpdate) => Promise<unknown>;
  onDeleteActivity: (eventId: string) => Promise<unknown>;
  resumeSources: ResumeSourceOption[];
  attachedSnapshot?: ResumeSnapshot;
}) {
  const [form, setForm] = useState<ApplicationForm>(EMPTY_APPLICATION_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<ApplicationEvent | null>(null);
  const loadedApplicationId = useRef<string | null>(null);
  useEffect(() => {
    if (!application) {
      loadedApplicationId.current = null;
      return;
    }
    // Only reset the form when a different application opens, so logging an activity
    // (which refreshes the pipeline) never clobbers unsaved edits in this form.
    if (loadedApplicationId.current === application.id) return;
    loadedApplicationId.current = application.id;
    setEditingEvent(null);
    setForm({
      company: application.company,
      role: application.role,
      status: application.status,
      sourceUrl: application.sourceUrl,
      source: application.source,
      location: application.location,
      compensation: application.compensation,
      contactName: application.contactName,
      contactEmail: application.contactEmail,
      notes: application.notes,
      nextAction: application.nextAction,
      nextActionAt: application.nextActionAt,
      jobDescription,
      resumeSourceKey:
        resumeSources.find(
          (source) =>
            source.resumeId === application.resumeId &&
            source.checkpointId === application.resumeCheckpointId,
        )?.key ?? "",
    });
    setFormError(null);
  }, [application, jobDescription, resumeSources]);
  const setField = <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!application) return;
    if (!form.company.trim() || !form.role.trim()) {
      setFormError("Company and role are required.");
      return;
    }
    try {
      await onSave(application.id, form);
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The application could not be saved.");
    }
  };
  const remove = async () => {
    if (
      !application ||
      !window.confirm(
        `Delete the ${application.role} application at ${application.company}? This removes its local history and cannot be undone.`,
      )
    )
      return;
    try {
      await onDelete(application.id);
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "The application could not be deleted.",
      );
    }
  };

  return (
    <Dialog open={Boolean(application)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0">
        {application ? (
          <form onSubmit={submit}>
            <DialogHeader className="border-b px-6 py-5 pr-12">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl">{application.role}</DialogTitle>
                <StatusBadge status={application.status} />
              </div>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>{application.company}</span>
                <span>Updated {formatApplicationDate(application.updatedAt)}</span>
                {application.sourceUrl ? (
                  <a
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    href={application.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open posting <ArrowUpRight className="size-3" />
                  </a>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="p-6">
                <ApplicationFields
                  form={form}
                  setField={setField}
                  resumeSources={resumeSources}
                  attachedSnapshot={attachedSnapshot}
                />
              </div>
              <aside className="border-t bg-muted/20 p-6 lg:border-l lg:border-t-0">
                <h3 className="text-sm font-semibold">Activity</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Log interviews, calls, and follow-ups. Each saves on this device on its own.
                </p>
                <div className="mt-4">
                  <ActivityComposer
                    applicationId={application.id}
                    editing={editingEvent}
                    disabled={saving}
                    onLog={onLogActivity}
                    onUpdate={onUpdateActivity}
                    onCancelEdit={() => setEditingEvent(null)}
                  />
                </div>
                <div className="mt-5">
                  <Timeline
                    events={events}
                    editingId={editingEvent?.id ?? null}
                    onEdit={setEditingEvent}
                    onDelete={(event) => {
                      if (
                        window.confirm(
                          `Delete this ${event.title} activity? This cannot be undone.`,
                        )
                      )
                        void onDeleteActivity(event.id);
                    }}
                  />
                </div>
              </aside>
            </div>
            {formError ? <p className="mx-6 mb-3 text-sm text-destructive">{formError}</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={remove}
                disabled={saving}
              >
                <Trash2 /> Delete application
              </Button>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Save changes
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ApplicationCard({
  application,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  application: JobApplication;
  onOpen: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const overdue = isApplicationOverdue(application);
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group rounded-lg border bg-card shadow-xs transition hover:border-primary/35 hover:shadow-md active:cursor-grabbing"
      data-application-card={application.id}
    >
      <button
        type="button"
        className="w-full p-4 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={onOpen}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{application.role}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">{application.company}</p>
            {application.resumeLabel ? (
              <p className="mt-1 truncate text-[11px] text-primary">
                Resume · {application.resumeLabel}
              </p>
            ) : null}
          </div>
          <GripVertical
            className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 transition group-hover:text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        {application.nextAction || application.nextActionAt ? (
          <div
            className={cn(
              "mt-4 rounded-md border px-2.5 py-2",
              overdue ? "border-destructive/30 bg-destructive/5" : "bg-muted/35",
            )}
          >
            <p className="truncate text-xs font-medium">
              {application.nextAction || "Next action"}
            </p>
            {application.nextActionAt ? (
              <p
                className={cn(
                  "mt-0.5 flex items-center gap-1 text-[11px]",
                  overdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <CalendarClock className="size-3" /> {overdue ? "Overdue · " : ""}
                {formatApplicationDate(application.nextActionAt)}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            {application.location ? (
              <>
                <MapPin className="size-3" /> {application.location}
              </>
            ) : (
              <>Updated {formatApplicationDate(application.updatedAt)}</>
            )}
          </span>
          <ChevronRight className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
        </div>
      </button>
    </article>
  );
}

export function EmptyPipeline({ scoped, onCreate }: { scoped: boolean; onCreate: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border bg-card shadow-xs">
        <BriefcaseBusiness className="size-6 text-primary" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">
        {scoped ? "No applications in this view" : "Build your private applications workspace"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {scoped
          ? "Try another filter or add a new opportunity."
          : "Track roles, follow-ups, interviews, and outcomes without sending your job search to a remote database."}
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus /> Add your first application
      </Button>
    </div>
  );
}

function resumeLinkFromSource(source: ResumeSourceOption | undefined) {
  return {
    resumeId: source?.resumeId,
    resumeCheckpointId: source?.checkpointId,
    resumeLabel: source?.label,
    resumeSnapshot: source
      ? {
          resumeId: source.resumeId,
          ...(source.checkpointId ? { checkpointId: source.checkpointId } : {}),
          label: source.label,
          data: source.state,
        }
      : undefined,
  };
}

export function applicationDataFromForm(
  form: ApplicationForm,
  source: ResumeSourceOption | undefined,
): JobApplicationDraft {
  const { resumeSourceKey: _resumeSourceKey, ...fields } = form;
  return { ...fields, ...resumeLinkFromSource(source) };
}

export { resumeLinkFromSource };
