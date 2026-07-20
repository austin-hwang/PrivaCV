"use client";

import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDot,
  Download,
  GitBranch,
  KanbanSquare,
  LayoutList,
  Loader2,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Sun,
  Upload,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ApplicationHeader } from "@/features/shared/components/application-header";
import {
  ApplicationCard,
  ApplicationDetailDialog,
  CreateApplicationDialog,
  EmptyPipeline,
  STATUS_DOT_CLASSES,
  StatusBadge,
  applicationDataFromForm,
  resumeLinkFromSource,
  type ApplicationForm,
} from "@/features/applications/components/application-components";
import { JobPipelineSankey } from "@/features/applications/components/job-pipeline-sankey";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
import { toggleTheme } from "@/components/theme-toggle";
import { useJobPipeline } from "@/features/applications/hooks/use-job-pipeline";
import { useResumeSources } from "@/features/applications/hooks/use-resume-sources";
import { createJobPipelineBackup, parseJobPipelineBackup } from "@/lib/job-application-db";
import { buildJobSankeyData } from "@/lib/job-application-sankey";
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
  type JobApplicationStatus,
} from "@/lib/job-applications";
import { cn } from "@/lib/utils";

type PipelineView = "board" | "list" | "sankey";
type PipelineScope = "active" | "closed" | "all";

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
  const resumeSources = useResumeSources();
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
  const selectedResumeSnapshot = selectedApplication?.resumeSnapshotId
    ? pipeline.data.resumeSnapshots.find((snapshot) => snapshot.id === selectedApplication.resumeSnapshotId)
    : undefined;
  const stats = useMemo(() => jobPipelineStats(pipeline.data.applications), [pipeline.data.applications]);
  const visibleApplications = useMemo(() => sortJobApplications(pipeline.data.applications.filter((application) => {
    if (scope === "active" && isClosedJobApplicationStatus(application.status)) return false;
    if (scope === "closed" && !isClosedJobApplicationStatus(application.status)) return false;
    return jobApplicationMatches(application, query);
  })), [pipeline.data.applications, query, scope]);
  const sankeyData = useMemo(() => buildJobSankeyData(visibleApplications, pipeline.data.events), [pipeline.data.events, visibleApplications]);
  const visibleStatuses: readonly JobApplicationStatus[] = scope === "active"
    ? ACTIVE_JOB_APPLICATION_STATUSES
    : scope === "closed" ? CLOSED_JOB_APPLICATION_STATUSES : JOB_APPLICATION_STATUSES;

  const saveApplication = async (applicationId: string, form: ApplicationForm) => {
    await pipeline.updateApplication(applicationId, applicationDataFromForm(form, resumeSources.byKey.get(form.resumeSourceKey)));
    setActionMessage({ type: "success", text: "Application saved" });
  };
  const moveApplication = async (applicationId: string, status: JobApplicationStatus) => {
    const application = pipeline.data.applications.find((item) => item.id === applicationId);
    if (!application || application.status === status) return;
    try {
      const source = resumeSources.sources.find((candidate) => candidate.resumeId === application.resumeId && candidate.checkpointId === application.resumeCheckpointId);
      await pipeline.updateApplication(applicationId, { status, ...(source ? resumeLinkFromSource(source) : {}) });
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
    downloadFile(JSON.stringify(createJobPipelineBackup(pipeline.data), null, 2), `privacv-applications-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
    setActionMessage({ type: "success", text: "Applications backup downloaded" });
  };
  const exportCsv = () => {
    downloadFile(jobApplicationsCsv(pipeline.data.applications), `privacv-applications-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv;charset=utf-8");
    setActionMessage({ type: "success", text: "Applications CSV downloaded" });
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
      setActionMessage({ type: "success", text: "All application data deleted from this device" });
    } catch {
      setActionMessage({ type: "error", text: "The application data could not be deleted." });
    }
  };

  return (
    <div className="min-h-dvh bg-stage">
      <ApplicationHeader
        active="applications"
        saveState={pipeline.storageError ? "conflict" : pipeline.loading ? "loading" : pipeline.saving ? "saving" : "saved"}
        actions={
          <Menu>
            <MenuTrigger><Button type="button" variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></MenuTrigger>
            <MenuContent><MenuLabel>Appearance</MenuLabel><MenuItem onSelect={() => setIsDarkTheme(toggleTheme())}>{isDarkTheme ? <Sun /> : <Moon />} {isDarkTheme ? "Use light mode" : "Use dark mode"}</MenuItem></MenuContent>
          </Menu>
        }
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6 lg:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Applications</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">A private view of every opportunity, next step, interview, and outcome. Everything here stays in this browser.</p></div>
          <div className="flex flex-wrap gap-2">
            <input ref={importInputRef} type="file" accept="application/json,.json" className="sr-only" onChange={importBackup} />
            <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}><Upload /> Import backup</Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={!pipeline.data.applications.length}><Download /> CSV</Button>
            <Button type="button" variant="outline" onClick={exportJson} disabled={!pipeline.data.applications.length}><Archive /> Backup</Button>
            <Button type="button" onClick={() => setCreateOpen(true)}><Plus /> Add application</Button>
          </div>
        </div>

        <section className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-3 xl:grid-cols-6" aria-label="Applications summary">
          {[
            { label: "Active", value: stats.active, icon: CircleDot },
            { label: "Interviewing", value: stats.interviewing, icon: UserRound },
            { label: "Offers", value: stats.offers, icon: CheckCircle2 },
            { label: "Overdue", value: stats.overdue, icon: AlertTriangle },
            { label: "Closed", value: stats.closed, icon: Archive },
            { label: "Total", value: stats.total, icon: BriefcaseBusiness },
          ].map((item) => <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 bg-card px-4 py-3"><div className="flex min-w-0 items-center gap-2 text-muted-foreground"><item.icon className="size-3.5 shrink-0" /><span className="truncate text-xs font-medium">{item.label}</span></div><p className="text-lg font-semibold tabular-nums">{item.value}</p></div>)}
        </section>

        {pipeline.storageError ? <Alert variant="destructive" className="mt-5 bg-card"><AlertTriangle /><AlertTitle>Browser storage is unavailable</AlertTitle><AlertDescription>{pipeline.storageError} Check browser privacy settings before adding applications.</AlertDescription></Alert> : null}
        {actionMessage ? <div className={cn("mt-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm", actionMessage.type === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5")} role="status"><span>{actionMessage.text}</span><button type="button" className="text-xs font-medium opacity-70 hover:opacity-100" onClick={() => setActionMessage(null)}>Dismiss</button></div> : null}

        <section className="mt-7 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1" aria-label="Application scope">
              {(["active", "closed", "all"] as const).map((item) => <Button key={item} type="button" size="sm" variant={scope === item ? "secondary" : "ghost"} aria-pressed={scope === item} onClick={() => setScope(item)} className="capitalize">{item}</Button>)}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-0 sm:w-72"><span className="sr-only">Search applications</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search roles, companies, notes..." /></label>
              <div className="flex rounded-lg border bg-background p-1" aria-label="Application view">
                <Button type="button" size="sm" variant={view === "board" ? "secondary" : "ghost"} aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")}><KanbanSquare /> Board</Button>
                <Button type="button" size="sm" variant={view === "list" ? "secondary" : "ghost"} aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList /> List</Button>
                <Button type="button" size="sm" variant={view === "sankey" ? "secondary" : "ghost"} aria-label="Sankey view" aria-pressed={view === "sankey"} onClick={() => { setScope("all"); setView("sankey"); }}><GitBranch /> Sankey</Button>
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
                    <section key={status} className={cn("min-h-[28rem] rounded-lg border bg-muted/20 p-3 transition-colors", dropStatus === status && "border-primary/50 bg-primary/5")} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropStatus(status); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropStatus(null); }} onDrop={(event) => dropApplication(event, status)} aria-label={`${JOB_APPLICATION_STATUS_META[status].label} applications`}>
                      <div className="flex items-start justify-between gap-3 px-1 pb-3"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><span className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])} />{JOB_APPLICATION_STATUS_META[status].label}</h2><p className="mt-1 text-[11px] text-muted-foreground">{JOB_APPLICATION_STATUS_META[status].description}</p></div><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{applications.length}</span></div>
                      <div className="grid gap-2.5">
                        {applications.map((application) => <ApplicationCard key={application.id} application={application} onOpen={() => setSelectedId(application.id)} onDragStart={(event) => { setDraggedId(application.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", application.id); }} onDragEnd={() => { setDraggedId(null); setDropStatus(null); }} />)}
                        {!applications.length ? <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed px-4 text-center text-xs text-muted-foreground">Drop an application here</div> : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : view === "sankey" ? (
            <JobPipelineSankey data={sankeyData} onExport={(result) => setActionMessage({ type: result.ok ? "success" : "error", text: result.message })} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b bg-muted/25 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Company</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Next action</th><th className="px-4 py-3 font-medium">Due</th><th className="px-4 py-3 font-medium">Updated</th></tr></thead>
                <tbody className="divide-y">
                  {visibleApplications.map((application) => <tr key={application.id} className="transition hover:bg-muted/25"><td className="px-4 py-3"><button type="button" className="font-medium hover:text-primary hover:underline" onClick={() => setSelectedId(application.id)}>{application.role}</button></td><td className="px-4 py-3 text-muted-foreground">{application.company}</td><td className="px-4 py-3"><StatusBadge status={application.status} /></td><td className="max-w-64 truncate px-4 py-3 text-muted-foreground">{application.nextAction || "—"}</td><td className={cn("whitespace-nowrap px-4 py-3", isApplicationOverdue(application) ? "text-destructive" : "text-muted-foreground")}>{formatApplicationDate(application.nextActionAt, "—")}</td><td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatApplicationDate(application.updatedAt)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>{visibleApplications.length} {visibleApplications.length === 1 ? "application" : "applications"} in this view</p>
          <div className="flex flex-wrap items-center gap-3"><p className="flex items-center gap-1.5"><Archive className="size-3.5" /> Back up this device regularly—there is no cloud account.</p>{pipeline.data.applications.length ? <button type="button" className="font-medium text-destructive hover:underline" onClick={clearPipeline}>Delete all pipeline data</button> : null}</div>
        </div>
      </main>

      <CreateApplicationDialog open={createOpen} onOpenChange={setCreateOpen} saving={pipeline.saving} resumeSources={resumeSources.sources} defaultResumeSourceKey={resumeSources.defaultSourceKey} onCreate={async (form) => { const application = await pipeline.createApplication(applicationDataFromForm(form, resumeSources.byKey.get(form.resumeSourceKey))); setActionMessage({ type: "success", text: `${application.role} added to ${JOB_APPLICATION_STATUS_META[application.status].label}` }); return application; }} />
      <ApplicationDetailDialog application={selectedApplication} jobDescription={selectedJobDescription} events={selectedEvents} saving={pipeline.saving} onOpenChange={(open) => { if (!open) setSelectedId(null); }} onSave={saveApplication} onDelete={pipeline.deleteApplication} resumeSources={resumeSources.sources} attachedSnapshot={selectedResumeSnapshot} />
    </div>
  );
}
