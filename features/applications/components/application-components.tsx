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
import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactElement,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker, DateTimePicker } from "@/components/ui/date-picker";
import {
  Field as FieldRoot,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
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
  saved: "bg-secondary-foreground",
  preparing: "bg-brand",
  applied: "bg-primary",
  interviewing: "bg-warning",
  offer: "bg-success",
  accepted: "bg-success",
  rejected: "bg-destructive",
  withdrawn: "bg-foreground",
  no_response: "bg-warning",
};

const STATUS_DOT_FOREGROUND_CLASSES: Record<JobApplicationStatus, string> = {
  saved: "text-secondary",
  preparing: "text-brand-foreground",
  applied: "text-primary-foreground",
  interviewing: "text-warning-foreground",
  offer: "text-success-foreground",
  accepted: "text-success-foreground",
  rejected: "text-destructive-foreground",
  withdrawn: "text-background",
  no_response: "text-warning-foreground",
};

const STATUS_BADGE_VARIANTS = {
  saved: "outline",
  preparing: "secondary",
  applied: "default",
  interviewing: "secondary",
  offer: "secondary",
  accepted: "default",
  rejected: "destructive",
  withdrawn: "outline",
  no_response: "secondary",
} as const satisfies Record<
  JobApplicationStatus,
  "default" | "secondary" | "destructive" | "outline"
>;

export function StatusBadge({ status }: { status: JobApplicationStatus }) {
  return (
    <Badge variant={STATUS_BADGE_VARIANTS[status]} className="gap-1.5 whitespace-nowrap">
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
  description,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  description?: string;
  error?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean }>;
  className?: string;
}) {
  const generatedId = useId();
  const controlId = children.props.id ?? generatedId;

  return (
    <FieldRoot className={className} data-invalid={Boolean(error) || undefined}>
      <FieldLabel htmlFor={controlId}>
        {label}
        {hint ? <span className="ml-1 font-normal text-muted-foreground">{hint}</span> : null}
      </FieldLabel>
      {cloneElement(children, { id: controlId, "aria-invalid": Boolean(error) || undefined })}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </FieldRoot>
  );
}

function ApplicationFields({
  form,
  setField,
  includeDetails = true,
  statusOptions = JOB_APPLICATION_STATUSES,
  resumeSources,
  attachedSnapshot,
  requiredErrors,
}: {
  form: ApplicationForm;
  setField: <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) => void;
  includeDetails?: boolean;
  statusOptions?: readonly JobApplicationStatus[];
  resumeSources: ResumeSourceOption[];
  attachedSnapshot?: ResumeSnapshot;
  requiredErrors?: Partial<Record<"company" | "role", string>>;
}) {
  return (
    <FieldGroup>
      <FieldGroup className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" error={requiredErrors?.company}>
          <Input
            required
            autoComplete="organization"
            value={form.company}
            onChange={(event) => setField("company", event.target.value)}
            placeholder="Acme"
          />
        </Field>
        <Field label="Role" error={requiredErrors?.role}>
          <Input
            required
            value={form.role}
            onChange={(event) => setField("role", event.target.value)}
            placeholder="Product designer"
          />
        </Field>
        <Field label="Status">
          <Select
            aria-label="Status"
            selectedKey={form.status}
            onSelectionChange={(key) => setField("status", String(key) as JobApplicationStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusOptions.map((status) => (
                  <SelectItem key={status} id={status}>
                    {JOB_APPLICATION_STATUS_META[status].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Location" hint="— optional">
          <Input
            value={form.location}
            onChange={(event) => setField("location", event.target.value)}
            placeholder="Remote or Seattle, WA"
          />
        </Field>
        <Field
          label="Resume for this application"
          hint="— optional"
          className="sm:col-span-2"
          description={
            attachedSnapshot
              ? `Submitted snapshot captured ${formatApplicationDate(attachedSnapshot.capturedAt)} · ${attachedSnapshot.label}`
              : "PrivaCV captures an immutable copy when this application reaches Applied."
          }
        >
          <Select
            aria-label="Resume for this application"
            selectedKey={form.resumeSourceKey}
            onSelectionChange={(key) => setField("resumeSourceKey", String(key))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem id="">No resume attached</SelectItem>
                {resumeSources.map((source) => (
                  <SelectItem key={source.key} id={source.key}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

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
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
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
          </FieldGroup>
          <FieldGroup className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Next action" hint="— optional">
              <Input
                value={form.nextAction}
                onChange={(event) => setField("nextAction", event.target.value)}
                placeholder="Follow up with recruiter"
              />
            </Field>
            <Field label="Due date" hint="— optional">
              <DatePicker
                aria-label="Due date"
                value={form.nextActionAt}
                onChange={(value) => setField("nextActionAt", value)}
                placeholder="Pick a due date"
              />
            </Field>
          </FieldGroup>
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
          className="min-h-40 max-h-80 overflow-y-auto"
          value={form.jobDescription}
          onChange={(event) => setField("jobDescription", event.target.value)}
          placeholder="Paste the job description before the posting disappears..."
        />
      </Field>
    </FieldGroup>
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
  const requiredErrors = formError
    ? {
        ...(!form.company.trim() ? { company: "Company is required." } : {}),
        ...(!form.role.trim() ? { role: "Role is required." } : {}),
      }
    : undefined;
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
    <Dialog isOpen={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <form onSubmit={submit} className="grid gap-5">
        <DialogHeader>
          <DialogTitle>Add an application</DialogTitle>
          <DialogDescription>
            Capture the role now. You can add contacts, notes, and follow-ups from its detail view.
          </DialogDescription>
        </DialogHeader>
        <ApplicationFields
          form={form}
          setField={setField}
          includeDetails={false}
          statusOptions={["saved", "preparing", "applied"]}
          resumeSources={resumeSources}
          requiredErrors={requiredErrors}
        />
        {formError && !requiredErrors?.company && !requiredErrors?.role ? (
          <FieldError>{formError}</FieldError>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" isDisabled={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />} Add
            application
          </Button>
        </DialogFooter>
      </form>
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
    <FieldRoot
      className="grid gap-2 rounded-lg border bg-card p-3"
      data-invalid={Boolean(error) || undefined}
    >
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <FieldRoot>
          <FieldLabel className="sr-only">Activity type</FieldLabel>
          <Select
            aria-label="Activity type"
            selectedKey={type}
            onSelectionChange={(key) => setType(String(key) as ApplicationActivityType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {APPLICATION_ACTIVITY_TYPES.map((activityType) => (
                  <SelectItem key={activityType} id={activityType}>
                    {APPLICATION_ACTIVITY_META[activityType].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldRoot>
        <FieldRoot data-invalid={Boolean(error && !title.trim()) || undefined}>
          <FieldLabel className="sr-only" htmlFor="activity-title">
            Activity title
          </FieldLabel>
          <Input
            id="activity-title"
            aria-invalid={Boolean(error && !title.trim()) || undefined}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={APPLICATION_ACTIVITY_META[type].placeholder}
          />
        </FieldRoot>
      </div>
      <FieldRoot>
        <FieldLabel className="sr-only" htmlFor="activity-details">
          Activity details
        </FieldLabel>
        <Textarea
          id="activity-details"
          className="min-h-16 text-sm"
          value={detail}
          onChange={(event) => setDetail(event.target.value)}
          placeholder="Details — optional"
        />
      </FieldRoot>
      <div className="flex flex-wrap items-center gap-2">
        <FieldRoot className="w-auto flex-1">
          <FieldLabel className="sr-only" htmlFor="activity-when">
            When
          </FieldLabel>
          <DateTimePicker
            id="activity-when"
            aria-label="When"
            value={when}
            onChange={setWhen}
            placeholder="Pick a date & time"
          />
        </FieldRoot>
        {editing ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancelEdit}
            isDisabled={disabled}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={() => void submit()} isDisabled={disabled}>
          {editing ? <CheckCircle2 data-icon="inline-start" /> : <Plus data-icon="inline-start" />}{" "}
          {editing ? "Save" : "Log"}
        </Button>
      </div>
      <FieldError className="text-xs">{error}</FieldError>
    </FieldRoot>
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
  if (!events.length) {
    return (
      <Empty className="min-h-32">
        <EmptyHeader>
          <EmptyTitle>No activity recorded yet</EmptyTitle>
          <EmptyDescription>
            Notes, interviews, calls, and follow-ups will appear here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
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
                    event.toStatus
                      ? STATUS_DOT_FOREGROUND_CLASSES[event.toStatus]
                      : "text-muted-foreground",
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
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Edit activity"
                      onPress={() => onEdit(event)}
                    >
                      <Pencil data-icon="inline-start" />
                    </Button>
                    <AlertDialogTrigger>
                      <Button variant="destructive" size="icon-xs" aria-label="Delete activity">
                        <Trash2 data-icon="inline-start" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this activity?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{event.title}” will be permanently removed from this application’s
                            timeline.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction variant="destructive" onPress={() => onDelete(event)}>
                            Delete activity
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialog>
                    </AlertDialogTrigger>
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
                {scheduled ? <Badge variant="secondary">Scheduled</Badge> : null}
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
  const requiredErrors = formError
    ? {
        ...(!form.company.trim() ? { company: "Company is required." } : {}),
        ...(!form.role.trim() ? { role: "Role is required." } : {}),
      }
    : undefined;
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
    if (!application) return;
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
    <Dialog
      isOpen={Boolean(application)}
      onOpenChange={onOpenChange}
      className="max-w-5xl p-0 max-sm:top-0 max-sm:left-0 max-sm:flex max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:flex-col max-sm:gap-0 max-sm:rounded-none max-sm:ring-0"
    >
      {application ? (
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 sm:px-6 sm:py-5">
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
          <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="p-4 sm:p-6">
              <ApplicationFields
                form={form}
                setField={setField}
                resumeSources={resumeSources}
                attachedSnapshot={attachedSnapshot}
                requiredErrors={requiredErrors}
              />
            </div>
            <aside className="border-t bg-muted/20 p-4 sm:p-6 lg:border-l lg:border-t-0">
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
                  onDelete={(event) => void onDeleteActivity(event.id)}
                />
              </div>
            </aside>
          </div>
          {formError && !requiredErrors?.company && !requiredErrors?.role ? (
            <FieldError className="mx-6 mb-3">{formError}</FieldError>
          ) : null}
          <div className="flex shrink-0 flex-col-reverse gap-3 border-t bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <AlertDialogTrigger>
              <Button type="button" variant="destructive" isDisabled={saving}>
                <Trash2 data-icon="inline-start" /> Delete application
              </Button>
              <AlertDialog>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this application?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The {application.role} application at {application.company} and its local
                    history will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onPress={() => void remove()}>
                    Delete application
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialog>
            </AlertDialogTrigger>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" isDisabled={saving}>
                {saving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <CheckCircle2 data-icon="inline-start" />
                )}{" "}
                Save changes
              </Button>
            </div>
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

export function ApplicationCard({
  application,
  onOpen,
  onDragStart,
  onDragEnd,
  showStatus = false,
  onMove,
}: {
  application: JobApplication;
  onOpen: () => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  showStatus?: boolean;
  onMove?: () => void;
}) {
  const overdue = isApplicationOverdue(application);
  return (
    <Card
      role="article"
      size="sm"
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative transition hover:ring-primary/35 hover:shadow-md",
        onDragStart && "active:cursor-grabbing",
      )}
      data-application-card={application.id}
    >
      <CardHeader>
        <CardTitle className="truncate">{application.role}</CardTitle>
        <CardDescription className="min-w-0">
          <p className="truncate">{application.company}</p>
          {application.resumeLabel ? (
            <p className="mt-1 truncate text-xs text-primary">Resume · {application.resumeLabel}</p>
          ) : null}
        </CardDescription>
        <CardAction>
          {showStatus ? (
            <StatusBadge status={application.status} />
          ) : (
            <GripVertical
              className="size-4 text-muted-foreground/40 transition group-hover:text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </CardAction>
      </CardHeader>
      {application.nextAction || application.nextActionAt ? (
        <CardContent>
          <div
            className={cn(
              "rounded-md border px-2.5 py-2",
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
        </CardContent>
      ) : null}
      <CardFooter className="justify-between gap-2 bg-transparent text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1 truncate">
          {application.location ? (
            <>
              <MapPin className="size-3" /> {application.location}
            </>
          ) : (
            <>Updated {formatApplicationDate(application.updatedAt)}</>
          )}
        </span>
        {onMove ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="relative z-20 shrink-0"
            onPress={onMove}
          >
            Move
          </Button>
        ) : (
          <ChevronRight className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
        )}
      </CardFooter>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Open ${application.role} at ${application.company}`}
        className="absolute inset-0 z-10 h-full w-full rounded-xl p-0 hover:bg-transparent focus-visible:ring-inset"
        onPress={onOpen}
      />
    </Card>
  );
}

export function EmptyPipeline({
  scoped,
  onCreate,
  onLoadSample,
}: {
  scoped: boolean;
  onCreate: () => void;
  onLoadSample: () => void;
}) {
  return (
    <Empty className="mx-auto my-10 max-w-lg">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <BriefcaseBusiness />
        </EmptyMedia>
        <EmptyTitle>
          {scoped ? "No applications in this view" : "Build your private applications workspace"}
        </EmptyTitle>
        <EmptyDescription>
          {scoped
            ? "Try another filter or add a new opportunity."
            : "Track roles, follow-ups, interviews, and outcomes without sending your job search to a remote database."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onCreate}>
            <Plus data-icon="inline-start" /> Add your first application
          </Button>
          {!scoped ? (
            <Button variant="outline" onClick={onLoadSample}>
              <FileText data-icon="inline-start" /> Load sample
            </Button>
          ) : null}
        </div>
      </EmptyContent>
    </Empty>
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
