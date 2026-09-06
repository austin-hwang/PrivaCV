"use client";

import {
  AlarmClock,
  AlertTriangle,
  Archive,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDot,
  Download,
  FileText,
  GitBranch,
  KanbanSquare,
  LayoutList,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Smartphone,
  Sun,
  Upload,
  UserRound,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
  applicationUpdateFromForm,
  resumeLinkFromSource,
  type ApplicationForm,
  type ApplicationFormBaseline,
} from "@/features/applications/components/application-components";
import { JobPipelineSankey } from "@/features/applications/components/job-pipeline-sankey";
import { RemindersView } from "@/features/applications/components/reminders-view";
import { InsightsView } from "@/features/applications/components/insights-view";
import {
  ApplicationMobileNavigation,
  type MobileApplicationView,
} from "@/features/applications/components/application-mobile-navigation";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleTheme } from "@/components/theme-toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useJobPipeline } from "@/features/applications/hooks/use-job-pipeline";
import { useResumeSources } from "@/features/applications/hooks/use-resume-sources";
import { WebRTCHandoffDialog } from "@/features/resume";
import { createJobPipelineBackup, parseJobPipelineBackup } from "@/lib/job-application-db";
import { buildJobSankeyData } from "@/lib/job-application-sankey";
import { remindersToIcs, type ReminderItem } from "@/lib/job-reminders";
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

type PipelineView = "board" | "list" | "reminders" | "insights" | "sankey";
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
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<JobApplicationStatus | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [pendingBackup, setPendingBackup] = useState<ReturnType<
    typeof parseJobPipelineBackup
  > | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setIsDarkTheme(document.documentElement.classList.contains("dark")), []);

  const selectedApplication =
    pipeline.data.applications.find((application) => application.id === selectedId) ?? null;
  const movingApplication =
    pipeline.data.applications.find((application) => application.id === movingId) ?? null;
  const selectedJobDescription = selectedId
    ? (pipeline.jobSnapshotsByApplication.get(selectedId)?.description ?? "")
    : "";
  const selectedEvents = selectedId ? (pipeline.eventsByApplication.get(selectedId) ?? []) : [];
  const selectedResumeSnapshot = selectedApplication?.resumeSnapshotId
    ? pipeline.data.resumeSnapshots.find(
        (snapshot) => snapshot.id === selectedApplication.resumeSnapshotId,
      )
    : undefined;
  const stats = useMemo(
    () => jobPipelineStats(pipeline.data.applications),
    [pipeline.data.applications],
  );
  const visibleApplications = useMemo(
    () =>
      sortJobApplications(
        pipeline.data.applications.filter((application) => {
          if (scope === "active" && isClosedJobApplicationStatus(application.status)) return false;
          if (scope === "closed" && !isClosedJobApplicationStatus(application.status)) return false;
          return jobApplicationMatches(application, query);
        }),
      ),
    [pipeline.data.applications, query, scope],
  );
  const sankeyData = useMemo(
    () => buildJobSankeyData(visibleApplications, pipeline.data.events),
    [pipeline.data.events, visibleApplications],
  );
  const visibleStatuses: readonly JobApplicationStatus[] =
    scope === "active"
      ? ACTIVE_JOB_APPLICATION_STATUSES
      : scope === "closed"
        ? CLOSED_JOB_APPLICATION_STATUSES
        : JOB_APPLICATION_STATUSES;
  const showListControls = view === "board" || view === "list";

  const saveApplication = async (
    applicationId: string,
    form: ApplicationForm,
    baseline: ApplicationFormBaseline,
  ) => {
    await pipeline.updateApplication(
      applicationId,
      applicationUpdateFromForm(form, baseline, resumeSources.byKey.get(form.resumeSourceKey)),
    );
    toast.success("Application saved");
  };
  const moveApplication = async (applicationId: string, status: JobApplicationStatus) => {
    const application = pipeline.data.applications.find((item) => item.id === applicationId);
    if (!application || application.status === status) return;
    try {
      const source = resumeSources.sources.find(
        (candidate) =>
          candidate.resumeId === application.resumeId &&
          candidate.checkpointId === application.resumeCheckpointId,
      );
      await pipeline.updateApplication(applicationId, {
        status,
        ...(source ? resumeLinkFromSource(source) : {}),
      });
      toast.success(`Moved ${application.role} to ${JOB_APPLICATION_STATUS_META[status].label}`);
    } catch {
      toast.error("The application could not be moved.");
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
    downloadFile(
      JSON.stringify(createJobPipelineBackup(pipeline.data), null, 2),
      `privacv-applications-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json",
    );
    toast.success("Applications backup downloaded");
  };
  const exportCsv = () => {
    downloadFile(
      jobApplicationsCsv(pipeline.data.applications),
      `privacv-applications-${new Date().toISOString().slice(0, 10)}.csv`,
      "text/csv;charset=utf-8",
    );
    toast.success("Applications CSV downloaded");
  };
  const exportReminders = (items: ReminderItem[]) => {
    if (!items.length) return;
    downloadFile(
      remindersToIcs(items),
      `privacv-reminders-${new Date().toISOString().slice(0, 10)}.ics`,
      "text/calendar;charset=utf-8",
    );
    toast.success(
      `Exported ${items.length} ${items.length === 1 ? "reminder" : "reminders"} to calendar`,
    );
  };
  const restoreBackup = async (backup: ReturnType<typeof parseJobPipelineBackup>) => {
    try {
      await pipeline.restoreBackup(backup);
      toast.success(`Imported ${backup.applications.length} applications`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The backup could not be imported.");
    } finally {
      setPendingBackup(null);
    }
  };
  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = parseJobPipelineBackup(await file.text());
      if (pipeline.data.applications.length) {
        setPendingBackup(backup);
        return;
      }
      await restoreBackup(backup);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The backup could not be imported.");
    }
  };
  const clearPipeline = async () => {
    try {
      await pipeline.clearPipeline();
      setSelectedId(null);
      toast.success("All application data deleted from this device");
    } catch {
      toast.error("The application data could not be deleted.");
    }
  };
  const loadSample = async () => {
    try {
      await pipeline.loadSample();
      setScope("all");
      toast.success("Loaded 13 sample applications");
    } catch {
      toast.error("The sample applications could not be loaded.");
    }
  };

  return (
    <div className="min-h-dvh bg-stage">
      <ApplicationHeader
        active="applications"
        saveState={
          pipeline.storageError
            ? "conflict"
            : pipeline.loading
              ? "loading"
              : pipeline.saving
                ? "saving"
                : "saved"
        }
        actions={
          <DropdownMenuTrigger>
            <Button type="button" variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal data-icon="inline-start" />
            </Button>
            <DropdownMenu>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Data</DropdownMenuLabel>
                <DropdownMenuItem onAction={() => void loadSample()}>
                  <FileText /> Load sample applications
                </DropdownMenuItem>
                <DropdownMenuItem onAction={() => setHandoffOpen(true)}>
                  <Smartphone /> Continue on another device
                </DropdownMenuItem>
                <DropdownMenuItem onAction={() => importInputRef.current?.click()}>
                  <Upload /> Import backup
                </DropdownMenuItem>
                <DropdownMenuItem
                  onAction={exportCsv}
                  isDisabled={!pipeline.data.applications.length}
                >
                  <Download /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onAction={exportJson}
                  isDisabled={!pipeline.data.applications.length}
                >
                  <Archive /> Export backup
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuItem onAction={() => setIsDarkTheme(toggleTheme())}>
                  {isDarkTheme ? <Sun /> : <Moon />}{" "}
                  {isDarkTheme ? "Use light mode" : "Use dark mode"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenu>
          </DropdownMenuTrigger>
        }
      />

      <main className="mx-auto max-w-[1600px] px-4 py-5 pb-28 md:pb-6 lg:px-6 lg:py-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Applications</h1>
            <p className="mt-2 hidden max-w-2xl text-sm leading-relaxed text-muted-foreground sm:block">
              A private view of every opportunity, next step, interview, and outcome. Everything
              here stays in this browser.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={importBackup}
            />
            <Button
              type="button"
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload data-icon="inline-start" /> Import backup
            </Button>
            <Button
              type="button"
              variant="outline"
              className="hidden md:inline-flex"
              onClick={exportCsv}
              isDisabled={!pipeline.data.applications.length}
            >
              <Download data-icon="inline-start" /> CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="hidden md:inline-flex"
              onClick={exportJson}
              isDisabled={!pipeline.data.applications.length}
            >
              <Archive data-icon="inline-start" /> Backup
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 md:h-8 md:flex-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus data-icon="inline-start" /> Add application
            </Button>
          </div>
        </div>

        <section
          className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:mt-7 md:grid-cols-3 xl:grid-cols-6"
          aria-label="Applications summary"
        >
          {[
            { label: "Active", value: stats.active, icon: CircleDot },
            { label: "Interviewing", value: stats.interviewing, icon: UserRound },
            { label: "Offers", value: stats.offers, icon: CheckCircle2 },
            { label: "Overdue", value: stats.overdue, icon: AlertTriangle },
            { label: "Closed", value: stats.closed, icon: Archive },
            { label: "Total", value: stats.total, icon: BriefcaseBusiness },
          ].map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 items-center justify-between gap-2 bg-card px-3 py-3 md:px-4"
            >
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <item.icon className="size-3.5 shrink-0" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">{item.value}</p>
            </div>
          ))}
        </section>

        {pipeline.storageError ? (
          <Alert variant="destructive" className="mt-5">
            <AlertTriangle />
            <AlertTitle>Browser storage is unavailable</AlertTitle>
            <AlertDescription>
              {pipeline.storageError} Check browser privacy settings before adding applications.
            </AlertDescription>
          </Alert>
        ) : null}
        <section className="mt-7 overflow-hidden rounded-xl border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between">
            {showListControls ? (
              <ToggleGroup
                aria-label="Application scope"
                variant="outline"
                spacing={0}
                selectionMode="single"
                selectedKeys={[scope]}
                onSelectionChange={(keys) => {
                  const selected = [...keys][0];
                  if (selected) setScope(String(selected) as PipelineScope);
                }}
              >
                {(
                  [
                    { id: "active", label: "Active" },
                    { id: "closed", label: "Closed" },
                    { id: "all", label: "All" },
                  ] as const
                ).map((item) => (
                  <ToggleGroupItem
                    key={item.id}
                    id={item.id}
                    size="sm"
                    className="h-11 px-4 md:h-8"
                  >
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            ) : (
              <p className="px-1 text-sm font-medium text-muted-foreground">
                {view === "reminders"
                  ? "Due dates and scheduled activities"
                  : view === "insights"
                    ? "Funnel and pace across your search"
                    : "How applications flow across stages"}
              </p>
            )}
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              {showListControls ? (
                <Field className="min-w-0 sm:w-72">
                  <FieldLabel htmlFor="application-search" className="sr-only">
                    Search applications
                  </FieldLabel>
                  <InputGroup className="h-11 md:h-8">
                    <InputGroupAddon>
                      <Search aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="application-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search roles, companies, notes..."
                    />
                  </InputGroup>
                </Field>
              ) : null}
              <ScrollArea
                className="hidden w-full min-w-0 md:block md:flex-1 lg:w-auto lg:flex-none"
                role="region"
                aria-label="Application view options"
                tabIndex={0}
              >
                <ToggleGroup
                  className="min-w-max"
                  aria-label="Application view"
                  variant="outline"
                  spacing={0}
                  selectionMode="single"
                  selectedKeys={[view]}
                  onSelectionChange={(keys) => {
                    const selected = [...keys][0];
                    if (!selected) return;
                    const next = String(selected) as PipelineView;
                    if (next === "sankey") setScope("all");
                    setView(next);
                  }}
                >
                  <ToggleGroupItem id="board" size="sm" aria-label="Board view">
                    <KanbanSquare data-icon="inline-start" /> Board
                  </ToggleGroupItem>
                  <ToggleGroupItem id="list" size="sm" aria-label="List view">
                    <LayoutList data-icon="inline-start" /> List
                  </ToggleGroupItem>
                  <ToggleGroupItem id="reminders" size="sm" aria-label="Reminders view">
                    <AlarmClock data-icon="inline-start" /> Reminders
                  </ToggleGroupItem>
                  <ToggleGroupItem id="insights" size="sm" aria-label="Insights view">
                    <BarChart3 data-icon="inline-start" /> Insights
                  </ToggleGroupItem>
                  <ToggleGroupItem id="sankey" size="sm" aria-label="Sankey view">
                    <GitBranch data-icon="inline-start" /> Sankey
                  </ToggleGroupItem>
                </ToggleGroup>
              </ScrollArea>
            </div>
          </div>

          {pipeline.loading ? (
            <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Loading your pipeline
            </div>
          ) : view === "reminders" ? (
            <RemindersView
              applications={pipeline.data.applications}
              events={pipeline.data.events}
              onOpen={setSelectedId}
              onExport={exportReminders}
            />
          ) : view === "insights" ? (
            <InsightsView applications={pipeline.data.applications} events={pipeline.data.events} />
          ) : visibleApplications.length === 0 ? (
            <EmptyPipeline
              scoped={Boolean(pipeline.data.applications.length)}
              onCreate={() => setCreateOpen(true)}
              onLoadSample={() => void loadSample()}
            />
          ) : view === "board" ? (
            <>
              <div className="flex flex-col gap-5 bg-muted/15 p-3 lg:hidden">
                {visibleStatuses.map((status) => {
                  const applications = visibleApplications.filter(
                    (application) => application.status === status,
                  );
                  if (!applications.length) return null;
                  return (
                    <section
                      key={status}
                      className="flex flex-col gap-2.5"
                      aria-label={`${JOB_APPLICATION_STATUS_META[status].label} applications`}
                    >
                      <div className="flex items-center justify-between gap-3 px-1">
                        <h2 className="flex items-center gap-2 text-sm font-semibold">
                          <span className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])} />
                          {JOB_APPLICATION_STATUS_META[status].label}
                        </h2>
                        <Badge variant="secondary" className="tabular-nums">
                          {applications.length}
                        </Badge>
                      </div>
                      <div className="grid gap-2.5">
                        {applications.map((application) => (
                          <ApplicationCard
                            key={application.id}
                            application={application}
                            showStatus
                            onOpen={() => setSelectedId(application.id)}
                            onMove={() => setMovingId(application.id)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto bg-muted/15 p-4 lg:block">
                <div className="grid min-w-max grid-flow-col auto-cols-[minmax(260px,280px)] gap-3 xl:auto-cols-[minmax(250px,1fr)]">
                  {visibleStatuses.map((status) => {
                    const applications = visibleApplications.filter(
                      (application) => application.status === status,
                    );
                    return (
                      <section
                        key={status}
                        className={cn(
                          "min-h-112 rounded-lg border bg-muted/20 p-3 transition-colors",
                          dropStatus === status && "border-primary/50 bg-primary/5",
                        )}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDropStatus(status);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node))
                            setDropStatus(null);
                        }}
                        onDrop={(event) => dropApplication(event, status)}
                        aria-label={`${JOB_APPLICATION_STATUS_META[status].label} applications`}
                      >
                        <div className="flex items-start justify-between gap-3 px-1 pb-3">
                          <div>
                            <h2 className="flex items-center gap-2 text-sm font-semibold">
                              <span
                                className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])}
                              />
                              {JOB_APPLICATION_STATUS_META[status].label}
                            </h2>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {JOB_APPLICATION_STATUS_META[status].description}
                            </p>
                          </div>
                          <Badge variant="secondary" className="tabular-nums">
                            {applications.length}
                          </Badge>
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
            </>
          ) : view === "sankey" ? (
            <JobPipelineSankey
              data={sankeyData}
              onExport={(result) => (result.ok ? toast.success : toast.error)(result.message)}
            />
          ) : (
            <Table aria-label="Job applications" className="min-w-[880px]">
              <TableHeader className="bg-muted/25 text-xs text-muted-foreground">
                <TableHead isRowHeader>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Updated</TableHead>
              </TableHeader>
              <TableBody>
                {visibleApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onPress={() => setSelectedId(application.id)}
                      >
                        {application.role}
                      </Button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{application.company}</TableCell>
                    <TableCell>
                      <StatusBadge status={application.status} />
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {application.nextAction || "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        isApplicationOverdue(application)
                          ? "text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatApplicationDate(application.nextActionAt, "—")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatApplicationDate(application.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>
            {visibleApplications.length}{" "}
            {visibleApplications.length === 1 ? "application" : "applications"} in this view
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-1.5">
              <Archive className="size-3.5" /> Back up this device regularly—there is no cloud
              account.
            </p>
            {pipeline.data.applications.length ? (
              <AlertDialogTrigger>
                <Button variant="destructive" size="xs">
                  Delete all pipeline data
                </Button>
                <AlertDialog>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all pipeline data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Every job application, job description, and timeline event on this device will
                      be permanently removed. Download a backup first if you may need them.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onPress={() => void clearPipeline()}>
                      Delete all data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialog>
              </AlertDialogTrigger>
            ) : null}
          </div>
        </div>
      </main>

      <ApplicationMobileNavigation
        view={(view === "list" ? "board" : view) as MobileApplicationView}
        onViewChange={(nextView) => {
          if (nextView === "sankey") setScope("all");
          setView(nextView);
        }}
      />

      <Drawer
        open={movingApplication !== null}
        onOpenChange={(open) => {
          if (!open) setMovingId(null);
        }}
        showSwipeHandle
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Move application</DrawerTitle>
            <DrawerDescription>
              {movingApplication
                ? `Choose the next stage for ${movingApplication.role} at ${movingApplication.company}.`
                : "Choose the next application stage."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ToggleGroup
              aria-label="Application status"
              variant="outline"
              selectionMode="single"
              selectedKeys={movingApplication ? [movingApplication.status] : []}
              onSelectionChange={(keys) => {
                const selected = [...keys][0];
                if (!selected || !movingApplication) return;
                void moveApplication(
                  movingApplication.id,
                  String(selected) as JobApplicationStatus,
                );
                setMovingId(null);
              }}
              className="grid w-full grid-cols-2 gap-2"
            >
              {JOB_APPLICATION_STATUSES.map((status) => (
                <ToggleGroupItem key={status} id={status} className="h-11 justify-start gap-2 px-3">
                  <span className={cn("size-2 rounded-full", STATUS_DOT_CLASSES[status])} />
                  {JOB_APPLICATION_STATUS_META[status].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </DrawerContent>
      </Drawer>

      <AlertDialog
        isOpen={pendingBackup !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBackup(null);
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Merge this applications backup?</AlertDialogTitle>
          <AlertDialogDescription>
            The imported records will be merged with applications already on this device. Matching
            records will be updated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onPress={() => {
              if (pendingBackup) void restoreBackup(pendingBackup);
            }}
          >
            Merge backup
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>

      <CreateApplicationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        saving={pipeline.saving}
        resumeSources={resumeSources.sources}
        defaultResumeSourceKey={resumeSources.defaultSourceKey}
        onCreate={async (form) => {
          const application = await pipeline.createApplication(
            applicationDataFromForm(form, resumeSources.byKey.get(form.resumeSourceKey)),
          );
          toast.success(
            `${application.role} added to ${JOB_APPLICATION_STATUS_META[application.status].label}`,
          );
          return application;
        }}
      />
      <ApplicationDetailDialog
        application={selectedApplication}
        jobDescription={selectedJobDescription}
        events={selectedEvents}
        saving={pipeline.saving}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        onSave={saveApplication}
        onDelete={pipeline.deleteApplication}
        onLogActivity={pipeline.logActivity}
        onUpdateActivity={pipeline.updateActivity}
        onDeleteActivity={pipeline.deleteActivity}
        resumeSources={resumeSources.sources}
        attachedSnapshot={selectedResumeSnapshot}
      />
      <WebRTCHandoffDialog
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
        invitation={null}
        onInvitationConsumed={() => undefined}
        state={resumeSources.byKey.get(resumeSources.defaultSourceKey)?.state ?? null}
        onDataReceived={() => void pipeline.refresh()}
      />
    </div>
  );
}
