"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Download,
  FileText,
  GripVertical,
  KanbanSquare,
  LayoutList,
  Loader2,
  MapPin,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
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
import { Textarea } from "@/components/ui/textarea";
import { toggleTheme } from "@/components/theme-toggle";
import { useJobPipeline } from "@/hooks/use-job-pipeline";
import {
  createJobPipelineBackup,
  parseJobPipelineBackup,
} from "@/lib/job-application-db";
import {
  ACTIVE_JOB_APPLICATION_STATUSES,
  CLOSED_JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUSES,
  JOB_APPLICATION_STATUS_META,
  formatApplicationDate,
  isApplicationOverdue,
  isClosedJobApplicationStatus,
  jobApplicationMatches,
  jobApplicationsCsv,
  jobPipelineStats,
  sortJobApplications,
  type ApplicationEvent,
  type JobApplication,
  type JobApplicationDraft,
  type JobApplicationStatus,
} from "@/lib/job-applications";
import { cn } from "@/lib/utils";

type PipelineView = "board" | "list";
type PipelineScope = "active" | "closed" | "all";

type ApplicationForm = {
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
};

const STATUS_DOT_CLASSES: Record<JobApplicationStatus, string> = {
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

function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
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

function StatusBadge({ status }: { status: JobApplicationStatus }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 whitespace-nowrap font-medium", STATUS_BADGE_CLASSES[status])}>
      <span className={cn("size-1.5 rounded-full", STATUS_DOT_CLASSES[status])} aria-hidden="true" />
      {JOB_APPLICATION_STATUS_META[status].label}
    </Badge>
  );
}

function ApplicationFields({
  form,
  setField,
  includeDetails = true,
  statusOptions = JOB_APPLICATION_STATUSES,
}: {
  form: ApplicationForm;
  setField: <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) => void;
  includeDetails?: boolean;
  statusOptions?: readonly JobApplicationStatus[];
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company">
          <Input required autoComplete="organization" value={form.company} onChange={(event) => setField("company", event.target.value)} placeholder="Acme" />
        </Field>
        <Field label="Role">
          <Input required value={form.role} onChange={(event) => setField("role", event.target.value)} placeholder="Product designer" />
        </Field>
        <Field label="Status">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.status}
            onChange={(event) => setField("status", event.target.value as JobApplicationStatus)}
          >
            {statusOptions.map((status) => <option key={status} value={status}>{JOB_APPLICATION_STATUS_META[status].label}</option>)}
          </select>
        </Field>
        <Field label="Location" hint="— optional">
          <Input value={form.location} onChange={(event) => setField("location", event.target.value)} placeholder="Remote or Seattle, WA" />
        </Field>
      </div>

      <Field label="Job posting URL" hint="— optional">
        <Input type="url" inputMode="url" value={form.sourceUrl} onChange={(event) => setField("sourceUrl", event.target.value)} placeholder="https://company.com/jobs/..." />
      </Field>

      {includeDetails ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source" hint="— optional">
              <Input value={form.source} onChange={(event) => setField("source", event.target.value)} placeholder="LinkedIn, referral, company site" />
            </Field>
            <Field label="Compensation" hint="— optional">
              <Input value={form.compensation} onChange={(event) => setField("compensation", event.target.value)} placeholder="$120k–$150k" />
            </Field>
            <Field label="Contact name" hint="— optional">
              <Input value={form.contactName} onChange={(event) => setField("contactName", event.target.value)} placeholder="Recruiter or hiring manager" />
            </Field>
            <Field label="Contact email" hint="— optional">
              <Input type="email" value={form.contactEmail} onChange={(event) => setField("contactEmail", event.target.value)} placeholder="name@company.com" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Next action" hint="— optional">
              <Input value={form.nextAction} onChange={(event) => setField("nextAction", event.target.value)} placeholder="Follow up with recruiter" />
            </Field>
            <Field label="Due date" hint="— optional">
              <Input type="date" value={form.nextActionAt} onChange={(event) => setField("nextActionAt", event.target.value)} />
            </Field>
          </div>

          <Field label="Notes" hint="— optional">
            <Textarea className="min-h-28" value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Interview context, people, questions, or decisions" />
          </Field>
        </>
      ) : null}

      <Field label="Job description snapshot" hint="— saved on this device">
        <Textarea className="min-h-40" value={form.jobDescription} onChange={(event) => setField("jobDescription", event.target.value)} placeholder="Paste the job description before the posting disappears..." />
      </Field>
    </div>
  );
}

function CreateApplicationDialog({
  open,
  onOpenChange,
  saving,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onCreate: (draft: JobApplicationDraft) => Promise<unknown>;
}) {
  const [form, setForm] = useState<ApplicationForm>(EMPTY_APPLICATION_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_APPLICATION_FORM);
      setFormError(null);
    }
  }, [open]);

  const setField = <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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
      setFormError(error instanceof Error ? error.message : "The application could not be created.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add an application</DialogTitle>
            <DialogDescription>Capture the role now. You can add contacts, notes, and follow-ups from its detail view.</DialogDescription>
          </DialogHeader>
          <ApplicationFields
            form={form}
            setField={setField}
            includeDetails={false}
            statusOptions={["saved", "preparing", "applied"]}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Plus />}
              Add application
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Timeline({ events }: { events: ApplicationEvent[] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>;
  return (
    <ol className="grid gap-0">
      {events.map((event, index) => (
        <li key={event.id} className="grid grid-cols-[1rem_1fr] gap-3">
          <div className="flex flex-col items-center">
            <span className={cn("mt-1.5 size-2 rounded-full", event.toStatus ? STATUS_DOT_CLASSES[event.toStatus] : "bg-muted-foreground")} />
            {index < events.length - 1 ? <span className="mt-1 min-h-8 w-px flex-1 bg-border" /> : null}
          </div>
          <div className="pb-5">
            <p className="text-sm font-medium">{event.title}</p>
            {event.detail ? <p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p> : null}
            <time className="mt-1 block text-[11px] text-muted-foreground" dateTime={event.occurredAt}>
              {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.occurredAt))}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ApplicationDetailDialog({
  application,
  jobDescription,
  events,
  saving,
  onOpenChange,
  onSave,
  onDelete,
}: {
  application: JobApplication | null;
  jobDescription: string;
  events: ApplicationEvent[];
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (applicationId: string, update: ApplicationForm) => Promise<unknown>;
  onDelete: (applicationId: string) => Promise<unknown>;
}) {
  const [form, setForm] = useState<ApplicationForm>(EMPTY_APPLICATION_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!application) return;
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
    });
    setFormError(null);
  }, [application, jobDescription]);

  const setField = <Key extends keyof ApplicationForm>(key: Key, value: ApplicationForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

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
    if (!application || !window.confirm(`Delete the ${application.role} application at ${application.company}? This removes its local history and cannot be undone.`)) return;
    try {
      await onDelete(application.id);
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The application could not be deleted.");
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
                  <a className="inline-flex items-center gap-1 text-primary hover:underline" href={application.sourceUrl} target="_blank" rel="noreferrer">
                    Open posting <ArrowUpRight className="size-3" />
                  </a>
                ) : null}
              </DialogDescription>
            </DialogHeader>

            <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="p-6">
                <ApplicationFields form={form} setField={setField} />
              </div>
              <aside className="border-t bg-muted/20 p-6 lg:border-l lg:border-t-0">
                <h3 className="text-sm font-semibold">Activity</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Lifecycle changes are saved automatically on this device.</p>
                <div className="mt-5">
                  <Timeline events={events} />
                </div>
              </aside>
            </div>

            {formError ? <p className="mx-6 mb-3 text-sm text-destructive">{formError}</p> : null}
            <div className="flex flex-col-reverse gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={remove} disabled={saving}>
                <Trash2 /> Delete application
              </Button>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Save changes
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ApplicationCard({
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
      className="group rounded-lg border bg-card shadow-sm transition hover:border-primary/35 hover:shadow-md active:cursor-grabbing"
      data-application-card={application.id}
    >
      <button type="button" className="w-full p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{application.role}</h3>
            <p className="mt-1 truncate text-sm text-muted-foreground">{application.company}</p>
          </div>
          <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 transition group-hover:text-muted-foreground" aria-hidden="true" />
        </div>
        {application.nextAction || application.nextActionAt ? (
          <div className={cn("mt-4 rounded-md border px-2.5 py-2", overdue ? "border-destructive/30 bg-destructive/5" : "bg-muted/35")}>
            <p className="truncate text-xs font-medium">{application.nextAction || "Next action"}</p>
            {application.nextActionAt ? (
              <p className={cn("mt-0.5 flex items-center gap-1 text-[11px]", overdue ? "text-destructive" : "text-muted-foreground")}>
                <CalendarClock className="size-3" /> {overdue ? "Overdue · " : ""}{formatApplicationDate(application.nextActionAt)}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            {application.location ? <><MapPin className="size-3" /> {application.location}</> : <>Updated {formatApplicationDate(application.updatedAt)}</>}
          </span>
          <ChevronRight className="size-3.5 shrink-0 opacity-0 transition group-hover:opacity-100" />
        </div>
      </button>
    </article>
  );
}

function EmptyPipeline({ scoped, onCreate }: { scoped: boolean; onCreate: () => void }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border bg-card shadow-sm">
        <BriefcaseBusiness className="size-6 text-primary" />
      </span>
      <h2 className="mt-5 text-xl font-semibold">{scoped ? "No applications in this view" : "Build your private job pipeline"}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {scoped
          ? "Try another filter or add a new opportunity."
          : "Track roles, follow-ups, interviews, and outcomes without sending your job search to a remote database."}
      </p>
      <Button className="mt-6" onClick={onCreate}><Plus /> Add your first application</Button>
    </div>
  );
}

function downloadFile(contents: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function JobPipeline() {
  const pipeline = useJobPipeline();
  const [view, setView] = useState<PipelineView>("board");
  const [scope, setScope] = useState<PipelineScope>("active");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<JobApplicationStatus | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setIsDarkTheme(document.documentElement.classList.contains("dark")), []);
  useEffect(() => {
    if (!actionMessage) return;
    const timeout = window.setTimeout(() => setActionMessage(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [actionMessage]);

  const selectedApplication = pipeline.data.applications.find((application) => application.id === selectedId) ?? null;
  const selectedJobDescription = selectedId ? pipeline.jobSnapshotsByApplication.get(selectedId)?.description ?? "" : "";
  const selectedEvents = selectedId ? pipeline.eventsByApplication.get(selectedId) ?? [] : [];
  const stats = useMemo(() => jobPipelineStats(pipeline.data.applications), [pipeline.data.applications]);

  const visibleApplications = useMemo(() => sortJobApplications(pipeline.data.applications.filter((application) => {
    if (scope === "active" && isClosedJobApplicationStatus(application.status)) return false;
    if (scope === "closed" && !isClosedJobApplicationStatus(application.status)) return false;
    return jobApplicationMatches(application, query);
  })), [pipeline.data.applications, query, scope]);

  const visibleStatuses: readonly JobApplicationStatus[] = scope === "active"
    ? ACTIVE_JOB_APPLICATION_STATUSES
    : scope === "closed"
      ? CLOSED_JOB_APPLICATION_STATUSES
      : JOB_APPLICATION_STATUSES;

  const saveApplication = async (applicationId: string, form: ApplicationForm) => {
    await pipeline.updateApplication(applicationId, form);
    setActionMessage({ type: "success", text: "Application saved" });
  };

  const moveApplication = async (applicationId: string, status: JobApplicationStatus) => {
    const application = pipeline.data.applications.find((item) => item.id === applicationId);
    if (!application || application.status === status) return;
    try {
      await pipeline.moveApplication(applicationId, status);
      setActionMessage({ type: "success", text: `Moved ${application.role} to ${JOB_APPLICATION_STATUS_META[status].label}` });
    } catch {
      setActionMessage({ type: "error", text: "The application could not be moved." });
    }
  };

  const dropApplication = (event: DragEvent<HTMLElement>, status: JobApplicationStatus) => {
    event.preventDefault();
    const applicationId = draggedId || event.dataTransfer.getData("text/plain");
    setDropStatus(null);
    setDraggedId(null);
    if (applicationId) void moveApplication(applicationId, status);
  };

  const exportJson = () => {
    const backup = createJobPipelineBackup(pipeline.data);
    downloadFile(JSON.stringify(backup, null, 2), `privacv-job-pipeline-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setActionMessage({ type: "success", text: "Job pipeline backup downloaded" });
  };

  const exportCsv = () => {
    downloadFile(jobApplicationsCsv(pipeline.data.applications), `privacv-job-pipeline-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    setActionMessage({ type: "success", text: "Job pipeline CSV downloaded" });
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = parseJobPipelineBackup(await file.text());
      if (pipeline.data.applications.length && !window.confirm("Merge this backup into the applications already on this device? Matching records will be updated.")) return;
      await pipeline.restoreBackup(backup);
      setActionMessage({ type: "success", text: `Imported ${backup.applications.length} applications` });
    } catch (error) {
      setActionMessage({ type: "error", text: error instanceof Error ? error.message : "The backup could not be imported." });
    }
  };

  const clearPipeline = async () => {
    if (!window.confirm("Delete every job application, job description, and timeline event from this device? Download a backup first if you may need them later.")) return;
    try {
      await pipeline.clearPipeline();
      setSelectedId(null);
      setActionMessage({ type: "success", text: "All job pipeline data deleted from this device" });
    } catch {
      setActionMessage({ type: "error", text: "The job pipeline data could not be deleted." });
    }
  };

  return (
    <div className="min-h-dvh bg-stage">
      <header className="sticky top-0 z-50 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <Link href="/" prefetch={false} className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <BrandMark className="size-8" />
            <span className="truncate text-base font-semibold tracking-tight lg:text-lg">PrivaCV</span>
          </Link>
          <div className="flex items-center gap-2">
            {pipeline.saving ? <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Loader2 className="size-3.5 animate-spin" /> Saving locally</span> : null}
            <Button asChild variant="outline">
              <Link href="/" prefetch={false}><FileText /> <span className="hidden sm:inline">Resume editor</span></Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={isDarkTheme ? "Use light theme" : "Use dark theme"}
              onClick={() => setIsDarkTheme(toggleTheme())}
            >
              {isDarkTheme ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Job pipeline</h1>
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">Local only</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">A private view of every opportunity, next step, interview, and outcome. Everything here stays in this browser.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={importBackup} />
            <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}><Upload /> Import backup</Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={!pipeline.data.applications.length}><Download /> CSV</Button>
            <Button type="button" variant="outline" onClick={exportJson} disabled={!pipeline.data.applications.length}><Archive /> Backup</Button>
            <Button type="button" onClick={() => setCreateOpen(true)}><Plus /> Add application</Button>
          </div>
        </div>

        <section className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Pipeline summary">
          {[
            { label: "Active", value: stats.active, icon: CircleDot },
            { label: "Interviewing", value: stats.interviewing, icon: UserRound },
            { label: "Offers", value: stats.offers, icon: CheckCircle2 },
            { label: "Overdue", value: stats.overdue, icon: AlertTriangle },
            { label: "Closed", value: stats.closed, icon: Archive },
            { label: "Total", value: stats.total, icon: BriefcaseBusiness },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="text-xs font-medium">{item.label}</span>
                <item.icon className="size-4" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </section>

        {pipeline.storageError ? (
          <Alert variant="destructive" className="mt-5 bg-card">
            <AlertTriangle />
            <AlertTitle>Browser storage is unavailable</AlertTitle>
            <AlertDescription>{pipeline.storageError} Check browser privacy settings before adding applications.</AlertDescription>
          </Alert>
        ) : null}

        {actionMessage ? (
          <div className={cn("mt-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm", actionMessage.type === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5")} role="status">
            <span>{actionMessage.text}</span>
            <button type="button" className="text-xs font-medium opacity-70 hover:opacity-100" onClick={() => setActionMessage(null)}>Dismiss</button>
          </div>
        ) : null}

        <section className="mt-7 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1" aria-label="Application scope">
              {(["active", "closed", "all"] as const).map((item) => (
                <Button key={item} type="button" size="sm" variant={scope === item ? "secondary" : "ghost"} aria-pressed={scope === item} onClick={() => setScope(item)} className="capitalize">
                  {item}
                </Button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-0 sm:w-72">
                <span className="sr-only">Search applications</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, companies, notes..." />
              </label>
              <div className="flex rounded-lg border bg-background p-1" aria-label="Pipeline layout">
                <Button type="button" size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")}><KanbanSquare /> Board</Button>
                <Button type="button" size="sm" variant={view === "list" ? "secondary" : "ghost"} aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList /> List</Button>
              </div>
            </div>
          </div>

          {pipeline.loading ? (
            <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" /> Loading your pipeline</div>
          ) : visibleApplications.length === 0 ? (
            <EmptyPipeline scoped={Boolean(pipeline.data.applications.length)} onCreate={() => setCreateOpen(true)} />
          ) : view === "board" ? (
            <div className="overflow-x-auto bg-muted/15 p-4">
              <div className="grid min-w-max grid-flow-col auto-cols-[minmax(260px,280px)] gap-3 xl:auto-cols-[minmax(250px,1fr)]">
                {visibleStatuses.map((status) => {
                  const applications = visibleApplications.filter((application) => application.status === status);
                  return (
                    <section
                      key={status}
                      className={cn("min-h-[28rem] rounded-lg border bg-muted/20 p-3 transition-colors", dropStatus === status && "border-primary/50 bg-primary/5")}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropStatus(status);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropStatus(null);
                      }}
                      onDrop={(event) => dropApplication(event, status)}
                      aria-label={`${JOB_APPLICATION_STATUS_META[status].label} applications`}
                    >
                      <div className="flex items-start justify-between gap-3 px-1 pb-3">
                        <div>
                          <h2 className="flex items-center gap-2 text-sm font-semibold">
                            <span className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])} />
                            {JOB_APPLICATION_STATUS_META[status].label}
                          </h2>
                          <p className="mt-1 text-[11px] text-muted-foreground">{JOB_APPLICATION_STATUS_META[status].description}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{applications.length}</span>
                      </div>
                      <div className="grid gap-2.5">
                        {applications.map((application) => (
                          <ApplicationCard
                            key={application.id}
                            application={application}
                            onOpen={() => setSelectedId(application.id)}
                            onDragStart={(event) => {
                              setDraggedId(application.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", application.id);
                            }}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setDropStatus(null);
                            }}
                          />
                        ))}
                        {!applications.length ? (
                          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed px-4 text-center text-xs text-muted-foreground">
                            Drop an application here
                          </div>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b bg-muted/25 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Company</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Next action</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleApplications.map((application) => (
                    <tr key={application.id} className="transition hover:bg-muted/25">
                      <td className="px-4 py-3">
                        <button type="button" className="font-medium hover:text-primary hover:underline" onClick={() => setSelectedId(application.id)}>{application.role}</button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{application.company}</td>
                      <td className="px-4 py-3"><StatusBadge status={application.status} /></td>
                      <td className="max-w-64 truncate px-4 py-3 text-muted-foreground">{application.nextAction || "—"}</td>
                      <td className={cn("whitespace-nowrap px-4 py-3", isApplicationOverdue(application) ? "text-destructive" : "text-muted-foreground")}>{formatApplicationDate(application.nextActionAt, "—")}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatApplicationDate(application.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>{visibleApplications.length} {visibleApplications.length === 1 ? "application" : "applications"} in this view</p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5"><Archive className="size-3.5" /> Back up this device regularly—there is no cloud account.</p>
            {pipeline.data.applications.length ? (
              <button type="button" className="font-medium text-destructive hover:underline" onClick={clearPipeline}>Delete all pipeline data</button>
            ) : null}
          </div>
        </div>
      </main>

      <CreateApplicationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        saving={pipeline.saving}
        onCreate={async (draft) => {
          const application = await pipeline.createApplication(draft);
          setActionMessage({ type: "success", text: `${application.role} added to ${JOB_APPLICATION_STATUS_META[application.status].label}` });
          return application;
        }}
      />
      <ApplicationDetailDialog
        application={selectedApplication}
        jobDescription={selectedJobDescription}
        events={selectedEvents}
        saving={pipeline.saving}
        onOpenChange={(open) => { if (!open) setSelectedId(null); }}
        onSave={saveApplication}
        onDelete={pipeline.deleteApplication}
      />
    </div>
  );
}
