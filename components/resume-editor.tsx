"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FileText,
  GitBranch,
  History,
  Printer,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { importResumePdf } from "@/lib/pdf-import";
import {
  blankEntry,
  buildResumeChecks,
  bulletsFrom,
  clampTextScale,
  emptyState,
  exportChangeSummary,
  hasAnyContent,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  normalizeResume,
  plainTextStats,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
  SECTION_LABELS,
  type ExportChange,
  type ResumeEntry,
  type ResumeState,
  type SectionKey,
} from "@/lib/resume";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "resume-editor-data-v2";
const EXPORT_CHECKPOINT_KEY = "resume-editor-last-export-v1";
const VERSION_HISTORY_KEY = "resume-editor-version-history-v1";
const MAX_VERSION_HISTORY = 5;
const CHANGE_PREVIEW_LIMIT = 4;
const REPEATABLE_SECTIONS = ["experience", "education", "projects"] as const;

const ENTRY_SCHEMA: Record<(typeof REPEATABLE_SECTIONS)[number], { title: string; subtitle: string; meta: string; details: string }> = {
  experience: {
    title: "Job Title",
    subtitle: "Company",
    meta: "Dates (e.g. Jan 2020 - Present)",
    details: "Responsibilities / achievements (one bullet per line)",
  },
  education: {
    title: "Degree",
    subtitle: "School",
    meta: "Dates / Location",
    details: "Details (one bullet per line, optional)",
  },
  projects: {
    title: "Project Name",
    subtitle: "Technologies / Role",
    meta: "Dates / Link",
    details: "Description (one bullet per line)",
  },
};

type ToastState = {
  id: number;
  message: string;
};

type ImportReviewItem = {
  id: string;
  label: string;
  targetId: string;
  detail: string;
};

type ImportReviewState = {
  fileName: string;
  sections: string[];
  items: ImportReviewItem[];
};

type RecoveryPoint = {
  label: string;
  state: ResumeState;
  importReview: ImportReviewState | null;
};

type VersionHistoryItem = {
  id: string;
  savedAt: string;
  label: string;
  note?: string;
  derivedFromId?: string;
  derivedFromLabel?: string;
  fingerprint: string;
  state: ResumeState;
  importReview: ImportReviewState | null;
};

type VersionCompareTarget = {
  baseId: string;
  targetId: "current" | string;
};

type RestoredVersionSummary = {
  id: string;
  label: string;
  savedAt: string;
  fingerprint: string;
  changes: ExportChange[];
};

type ExportCheckpoint = {
  fingerprint: string;
  exportedAt: string;
  pageCount: number;
  issueCount: number;
  snapshot?: ResumeState;
};

function compactDetail(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "No text detected";
  return cleaned.length > 92 ? `${cleaned.slice(0, 89)}...` : cleaned;
}

function parseExportCheckpoint(value: string | null): ExportCheckpoint | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ExportCheckpoint>;
    if (
      typeof parsed.fingerprint === "string" &&
      typeof parsed.exportedAt === "string" &&
      typeof parsed.pageCount === "number" &&
      typeof parsed.issueCount === "number"
    ) {
      return {
        fingerprint: parsed.fingerprint,
        exportedAt: parsed.exportedAt,
        pageCount: parsed.pageCount,
        issueCount: parsed.issueCount,
        snapshot: parsed.snapshot ? normalizeResume(parsed.snapshot) : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function parseVersionHistory(value: string | null): VersionHistoryItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): VersionHistoryItem | null => {
        if (
          !item ||
          typeof item.id !== "string" ||
          typeof item.savedAt !== "string" ||
          typeof item.label !== "string" ||
          typeof item.fingerprint !== "string"
        ) {
          return null;
        }
        return {
          id: item.id,
          savedAt: item.savedAt,
          label: item.label,
          note: typeof item.note === "string" ? item.note : undefined,
          derivedFromId: typeof item.derivedFromId === "string" ? item.derivedFromId : undefined,
          derivedFromLabel: typeof item.derivedFromLabel === "string" ? item.derivedFromLabel : undefined,
          fingerprint: item.fingerprint,
          state: normalizeResume(item.state),
          importReview: item.importReview ?? null,
        };
      })
      .filter((item): item is VersionHistoryItem => Boolean(item))
      .slice(0, MAX_VERSION_HISTORY);
  } catch {
    return [];
  }
}

function formatCheckpointTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function versionLabel(state: ResumeState) {
  return state.name.trim() || state.title.trim() || "Untitled resume";
}

function versionHeadline(state: ResumeState) {
  return [state.name.trim() || "Unnamed resume", state.title.trim()].filter(Boolean).join(" - ");
}

function entryHasContent(entry: ResumeEntry) {
  return Boolean(entry.title || entry.subtitle || entry.meta || entry.details);
}

function versionContentBadges(state: ResumeState) {
  const experienceCount = state.experience.filter(entryHasContent).length;
  const educationCount = state.education.filter(entryHasContent).length;
  const projectCount = state.projects.filter(entryHasContent).length;
  const skillCount = state.skills.split("\n").filter((line) => line.trim()).length;
  const badges: string[] = [];

  if (experienceCount) badges.push(`${experienceCount} ${experienceCount === 1 ? "role" : "roles"}`);
  if (educationCount) badges.push(`${educationCount} education`);
  if (projectCount) badges.push(`${projectCount} ${projectCount === 1 ? "project" : "projects"}`);
  if (skillCount) badges.push(`${skillCount} ${skillCount === 1 ? "skill line" : "skill lines"}`);

  return badges.length ? badges : ["Empty draft"];
}

function versionReplacementCandidate(versions: VersionHistoryItem[], fingerprint: string) {
  if (versions.some((item) => item.fingerprint === fingerprint)) return null;
  if (versions.length < MAX_VERSION_HISTORY) return null;
  return versions[versions.length - 1] ?? null;
}

function entryTargetId(section: (typeof REPEATABLE_SECTIONS)[number], entry: ResumeEntry, index: number) {
  const field = entry.title ? "title" : entry.subtitle ? "subtitle" : entry.meta ? "meta" : "details";
  return `field-${section}-${index}-${field}`;
}

function buildImportReview(state: ResumeState, fileName: string): ImportReviewState {
  const items: ImportReviewItem[] = [];
  const sections = new Set<string>();
  const addItem = (item: ImportReviewItem, section: string) => {
    items.push(item);
    sections.add(section);
  };

  addItem(
    {
      id: "contact",
      label: "Contact details",
      targetId: state.name ? "field-name" : "field-email",
      detail: compactDetail([state.name, state.email, state.phone, state.location, state.website].filter(Boolean).join(" | ")),
    },
    "Header",
  );

  if (state.summary) {
    addItem(
      {
        id: "summary",
        label: "Summary",
        targetId: "field-summary",
        detail: compactDetail(state.summary),
      },
      "Summary",
    );
  }

  (["experience", "education", "projects"] as const).forEach((section) => {
    const index = state[section].findIndex(entryHasContent);
    if (index < 0) return;
    const entry = state[section][index];
    addItem(
      {
        id: section,
        label: `First ${SECTION_LABELS[section].toLowerCase()} entry`,
        targetId: entryTargetId(section, entry, index),
        detail: compactDetail([entry.title, entry.subtitle, entry.meta, entry.details.split("\n")[0]].filter(Boolean).join(" | ")),
      },
      SECTION_LABELS[section],
    );
  });

  if (state.skills) {
    addItem(
      {
        id: "skills",
        label: "Skills",
        targetId: "field-skills",
        detail: compactDetail(state.skills.split("\n")[0] ?? state.skills),
      },
      "Skills",
    );
  }

  return {
    fileName,
    sections: [...sections],
    items,
  };
}

export function ResumeEditor() {
  const [state, setState] = useState<ResumeState>(() => emptyState());
  const [loaded, setLoaded] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [textReviewOpen, setTextReviewOpen] = useState(false);
  const [exportCheckOpen, setExportCheckOpen] = useState(false);
  const [versionSaveOpen, setVersionSaveOpen] = useState(false);
  const [versionDraftLabel, setVersionDraftLabel] = useState("");
  const [versionDraftNote, setVersionDraftNote] = useState("");
  const [versionCompareTarget, setVersionCompareTarget] = useState<VersionCompareTarget | null>(null);
  const [draftSourceVersionId, setDraftSourceVersionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [importReview, setImportReview] = useState<ImportReviewState | null>(null);
  const [recoveryPoint, setRecoveryPoint] = useState<RecoveryPoint | null>(null);
  const [restoredVersionSummary, setRestoredVersionSummary] = useState<RestoredVersionSummary | null>(null);
  const [deletedVersion, setDeletedVersion] = useState<VersionHistoryItem | null>(null);
  const [exportCheckpoint, setExportCheckpoint] = useState<ExportCheckpoint | null>(null);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  const hasContent = hasAnyContent(state);
  const checks = useMemo(() => buildResumeChecks(state, pageCount), [state, pageCount]);
  const failedChecks = checks.filter((check) => !check.ok);
  const passedChecks = checks.filter((check) => check.ok).length;
  const plainText = useMemo(() => resumePlainText(state), [state]);
  const exportFingerprint = useMemo(() => resumeExportFingerprint(state), [state]);
  const visibleRestoredVersionSummary =
    restoredVersionSummary?.fingerprint === exportFingerprint ? restoredVersionSummary : null;
  const exportIsCurrent = Boolean(exportCheckpoint && exportCheckpoint.fingerprint === exportFingerprint);
  const exportChanges = useMemo(
    () =>
      exportCheckpoint?.snapshot && !exportIsCurrent
        ? exportChangeSummary(exportCheckpoint.snapshot, state)
        : [],
    [exportCheckpoint, exportIsCurrent, state],
  );
  const comparedBaseVersion = useMemo(
    () => versionHistory.find((item) => item.id === versionCompareTarget?.baseId) ?? null,
    [versionCompareTarget?.baseId, versionHistory],
  );
  const comparedTargetVersion = useMemo(
    () =>
      versionCompareTarget?.targetId && versionCompareTarget.targetId !== "current"
        ? versionHistory.find((item) => item.id === versionCompareTarget.targetId) ?? null
        : null,
    [versionCompareTarget?.targetId, versionHistory],
  );
  const comparedTargetState = versionCompareTarget?.targetId === "current" ? state : comparedTargetVersion?.state;
  const versionCompareUsesCurrent = versionCompareTarget?.targetId === "current";
  const versionToReplaceOnSave = useMemo(
    () => versionReplacementCandidate(versionHistory, exportFingerprint),
    [exportFingerprint, versionHistory],
  );
  const existingVersionForSave = useMemo(
    () => versionHistory.find((item) => item.fingerprint === exportFingerprint) ?? null,
    [exportFingerprint, versionHistory],
  );
  const versionChanges = useMemo(
    () =>
      comparedBaseVersion && comparedTargetState
        ? exportChangeSummary(comparedBaseVersion.state, comparedTargetState)
        : [],
    [comparedBaseVersion, comparedTargetState],
  );
  const versionCompareDescription = useMemo(() => {
    if (!comparedBaseVersion) return "Compare a saved checkpoint with the current resume or another saved checkpoint.";
    const base = `${comparedBaseVersion.label} saved ${formatCheckpointTime(comparedBaseVersion.savedAt)}`;
    if (versionCompareUsesCurrent) return `${base} compared with the current resume.`;
    if (!comparedTargetVersion) return base;
    return `${base} compared with ${comparedTargetVersion.label} saved ${formatCheckpointTime(comparedTargetVersion.savedAt)}.`;
  }, [comparedBaseVersion, comparedTargetVersion, versionCompareUsesCurrent]);
  const versionCompareBeforeLabel = versionCompareUsesCurrent ? "Saved" : "Base";
  const versionCompareAfterLabel = versionCompareUsesCurrent ? "Current" : "Compared";
  const versionCompareOpen = Boolean(
    comparedBaseVersion && (versionCompareUsesCurrent || comparedTargetVersion),
  );
  const importReviewTargets = useMemo(
    () => new Set(importReview?.items.map((item) => item.targetId) ?? []),
    [importReview],
  );

  const flash = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  const saveRecoveryPoint = useCallback(
    (label: string, previousState = state, previousImportReview = importReview) => {
      if (!hasAnyContent(previousState) && !previousImportReview) {
        setRecoveryPoint(null);
        return;
      }
      setRecoveryPoint({
        label,
        state: previousState,
        importReview: previousImportReview,
      });
    },
    [importReview, state],
  );

  const restoreRecoveryPoint = () => {
    if (!recoveryPoint) return;
    setState(recoveryPoint.state);
    setImportReview(recoveryPoint.importReview);
    setRecoveryPoint(null);
    setRestoredVersionSummary(null);
    setDraftSourceVersionId(null);
    flash("Restored previous resume");
  };

  const openVersionSave = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    setVersionDraftLabel(versionLabel(state));
    setVersionDraftNote("");
    setVersionSaveOpen(true);
  };

  const saveVersion = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    const fingerprint = resumeExportFingerprint(state);
    const label = versionDraftLabel.trim() || versionLabel(state);
    const note = versionDraftNote.trim();
    const replacement = versionReplacementCandidate(versionHistory, fingerprint);
    const derivedFrom =
      versionHistory.find((item) => item.id === draftSourceVersionId && item.fingerprint !== fingerprint) ??
      versionHistory.find((item) => item.fingerprint !== fingerprint) ??
      null;
    const entry: VersionHistoryItem = {
      id: `${Date.now()}`,
      savedAt: new Date().toISOString(),
      label,
      note: note || undefined,
      derivedFromId: derivedFrom?.id,
      derivedFromLabel: derivedFrom?.label,
      fingerprint,
      state: normalizeResume(state),
      importReview,
    };
    setVersionHistory((current) => [entry, ...current.filter((item) => item.fingerprint !== fingerprint)].slice(0, MAX_VERSION_HISTORY));
    setDraftSourceVersionId(entry.id);
    setVersionSaveOpen(false);
    flash(replacement ? `Saved locally and replaced ${replacement.label}` : "Version saved locally");
  };

  const restoreVersion = (item: VersionHistoryItem) => {
    saveRecoveryPoint(`Before restoring ${item.label}`);
    setRestoredVersionSummary({
      id: item.id,
      label: item.label,
      savedAt: item.savedAt,
      fingerprint: item.fingerprint,
      changes: exportChangeSummary(state, item.state),
    });
    setState(item.state);
    setImportReview(item.importReview);
    setDraftSourceVersionId(item.id);
    flash("Restored saved version");
  };

  const deleteVersion = (id: string) => {
    const deleted = versionHistory.find((item) => item.id === id) ?? null;
    setVersionHistory((current) => current.filter((item) => item.id !== id));
    setDeletedVersion(deleted);
    if (versionCompareTarget?.baseId === id || versionCompareTarget?.targetId === id) setVersionCompareTarget(null);
    if (restoredVersionSummary?.id === id) setRestoredVersionSummary(null);
    if (draftSourceVersionId === id) setDraftSourceVersionId(null);
    flash("Deleted saved version");
  };

  const undoDeleteVersion = () => {
    if (!deletedVersion) return;
    setVersionHistory((current) =>
      [deletedVersion, ...current.filter((item) => item.id !== deletedVersion.id)]
        .sort((first, second) => new Date(second.savedAt).getTime() - new Date(first.savedAt).getTime())
        .slice(0, MAX_VERSION_HISTORY),
    );
    setDeletedVersion(null);
    flash("Restored deleted checkpoint");
  };

  const focusFromVersionCompare = (targetId: string) => {
    setVersionCompareTarget(null);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  };

  useEffect(() => {
    try {
      const legacy = localStorage.getItem("resume-editor-data-v1");
      const saved = localStorage.getItem(STORAGE_KEY) ?? legacy;
      if (saved) setState(normalizeResume(JSON.parse(saved)));
      setExportCheckpoint(parseExportCheckpoint(localStorage.getItem(EXPORT_CHECKPOINT_KEY)));
      setVersionHistory(parseVersionHistory(localStorage.getItem(VERSION_HISTORY_KEY)));
    } catch {
      // localStorage may be unavailable.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore storage failures; the user can still export JSON.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [loaded, state]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(versionHistory));
    } catch {
      // Manual JSON export still works if history storage is unavailable.
    }
  }, [loaded, versionHistory]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const measure = () => {
      const sheet = resumeRef.current;
      if (!sheet) return;
      const pageHeightPx = 11 * 96 - 16;
      setPageCount(Math.max(1, Math.ceil(sheet.scrollHeight / pageHeightPx)));
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [state]);

  const updateField = <K extends keyof ResumeState>(key: K, value: ResumeState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const updateEntry = (
    section: (typeof REPEATABLE_SECTIONS)[number],
    index: number,
    key: keyof ResumeEntry,
    value: string,
  ) => {
    setState((current) => ({
      ...current,
      [section]: current[section].map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [key]: value } : entry,
      ),
    }));
  };

  const addEntry = (section: (typeof REPEATABLE_SECTIONS)[number]) => {
    setState((current) => ({ ...current, [section]: [...current[section], blankEntry()] }));
  };

  const removeEntry = (section: (typeof REPEATABLE_SECTIONS)[number], index: number) => {
    setState((current) => ({
      ...current,
      [section]: current[section].filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const moveEntry = (section: (typeof REPEATABLE_SECTIONS)[number], index: number, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current[section]];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, [section]: next };
    });
  };

  const moveSection = (section: SectionKey, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sectionOrder: next };
    });
  };

  const saveJson = () => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safeName = (state.name || "resume").trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "");
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName || "resume"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    flash("Saved JSON to downloads");
  };

  const openJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const nextState = normalizeResume(JSON.parse(text));
      saveRecoveryPoint(`Before opening ${file.name}`);
      setState(nextState);
      setImportReview(null);
      setRestoredVersionSummary(null);
      setDraftSourceVersionId(null);
      flash("Loaded JSON");
    } catch {
      flash("That file is not valid resume JSON");
    }
  };

  const openPdf = async (file: File | undefined) => {
    if (!file) return;
    const previousState = state;
    const previousImportReview = importReview;
    setIsImporting(true);
    try {
      const imported = await importResumePdf(file);
      saveRecoveryPoint(`Before importing ${file.name}`, previousState, previousImportReview);
      setState(imported);
      setImportReview(buildImportReview(imported, file.name));
      setRestoredVersionSummary(null);
      setDraftSourceVersionId(null);
      flash("Imported PDF - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this PDF");
    } finally {
      setIsImporting(false);
    }
  };

  const copyPlainText = async () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    try {
      await navigator.clipboard.writeText(plainText);
      flash("Copied plain text");
    } catch {
      flash("Could not copy text");
    }
  };

  const focusCheckTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 220);
  };

  const startPrintExport = () => {
    const checkpoint: ExportCheckpoint = {
      fingerprint: exportFingerprint,
      exportedAt: new Date().toISOString(),
      pageCount,
      issueCount: failedChecks.length + (importReview ? 1 : 0),
      snapshot: normalizeResume(state),
    };
    setExportCheckpoint(checkpoint);
    try {
      localStorage.setItem(EXPORT_CHECKPOINT_KEY, JSON.stringify(checkpoint));
    } catch {
      // The status card is still useful for this session.
    }
    window.print();
  };

  const requestExport = () => {
    if (failedChecks.length || importReview) {
      setExportCheckOpen(true);
      return;
    }
    startPrintExport();
  };

  const exportAnyway = () => {
    setExportCheckOpen(false);
    window.setTimeout(startPrintExport, 120);
  };

  const focusFromExportCheck = (targetId: string) => {
    setExportCheckOpen(false);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  };

  return (
    <>
      <header className="app-chrome sticky top-0 z-40 border-b bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Private workspace</p>
            <h1 className="text-lg font-semibold tracking-normal">Resume Editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground lg:flex-none">
              <span className="whitespace-nowrap">Text size</span>
              <input
                id="resume-text-scale"
                className="min-w-24 flex-1 accent-foreground"
                type="range"
                min={MIN_TEXT_SCALE}
                max={MAX_TEXT_SCALE}
                step="0.02"
                value={state.textScale}
                onChange={(event) => updateField("textScale", clampTextScale(Number(event.target.value)))}
                aria-label="Resume text size"
              />
              <output className="w-10 text-right tabular-nums">{Math.round(state.textScale * 100)}%</output>
            </label>
            <Button type="button" onClick={requestExport}>
              <Printer /> Export PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => setTextReviewOpen(true)}>
              <ClipboardCopy /> Review Text
            </Button>
            <Button type="button" variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={isImporting}>
              <Upload /> {isImporting ? "Importing" : "Import PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={saveJson}>
              <Download /> Save JSON
            </Button>
            <Button type="button" variant="outline" onClick={() => jsonInputRef.current?.click()}>
              <FileJson /> Open JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                saveRecoveryPoint("Before loading the sample");
                setState(sampleState());
                setImportReview(null);
                setRestoredVersionSummary(null);
                setDraftSourceVersionId(null);
                flash("Sample loaded");
              }}
            >
              <FileText /> Sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Clear all fields? You can restore this version from the recovery card.")) {
                  saveRecoveryPoint("Before clearing the resume");
                  setState(emptyState());
                  setImportReview(null);
                  setRestoredVersionSummary(null);
                  setDraftSourceVersionId(null);
                  flash("Cleared");
                }
              }}
            >
              <RotateCcw /> Clear
            </Button>
          </div>
        </div>
      </header>

      <main className="app-shell grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[minmax(390px,1fr)_minmax(440px,1fr)]">
        <section className="editor-pane overflow-y-auto border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:p-6">
          {!hasContent ? (
            <Card className="mb-6">
              <CardHeader>
                <CardDescription className="font-semibold uppercase tracking-[0.16em]">Private resume workspace</CardDescription>
                <CardTitle className="text-2xl">Start from the resume you already have.</CardTitle>
                <CardDescription>
                  Import a PDF, open a saved JSON file, or load a polished sample to see the final structure instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isImporting}>
                    <Upload /> Import PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      saveRecoveryPoint("Before loading the sample");
                      setState(sampleState());
                      setImportReview(null);
                      setRestoredVersionSummary(null);
                      setDraftSourceVersionId(null);
                      flash("Sample loaded");
                    }}
                  >
                    <FileText /> Use Sample
                  </Button>
                  <Button type="button" variant="outline" onClick={() => jsonInputRef.current?.click()}>
                    <FileJson /> Open JSON
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["No account", "Local autosave", "Free PDF export"].map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {recoveryPoint ? (
            <Card className="mb-6 border-sky-300 bg-sky-50/70">
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.16em] text-sky-900">
                    Restore point saved
                  </CardDescription>
                  <CardTitle className="text-base">You can go back to the previous resume.</CardTitle>
                  <CardDescription>
                    {recoveryPoint.label}. This recovery point stays in this browser tab until you dismiss or restore it.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={restoreRecoveryPoint}>
                    <Undo2 /> Restore previous
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setRecoveryPoint(null)}>
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : null}

          {importReview ? (
            <Card className="mb-6 border-amber-300 bg-amber-50/70">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardDescription className="font-semibold uppercase tracking-[0.16em] text-amber-900">
                      PDF import review
                    </CardDescription>
                    <CardTitle className="text-base">Check the fields PDF parsing usually guesses.</CardTitle>
                    <CardDescription>
                      Imported from {importReview.fileName}. Formatting in PDFs is approximate, so confirm these fields
                      before exporting.
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setImportReview(null)}>
                    <Check /> Done
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {importReview.sections.map((section) => (
                    <Badge key={section} variant="secondary">
                      {section}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {importReview.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group flex min-h-16 gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => focusCheckTarget(item.targetId)}
                  >
                    <Eye className="mt-0.5 size-4 shrink-0 text-amber-800" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <VersionHistoryCard
            hasContent={hasContent}
            versions={versionHistory}
            currentState={state}
            currentFingerprint={exportFingerprint}
            deletedVersion={deletedVersion}
            onSave={openVersionSave}
            onCompareCurrent={(item) => setVersionCompareTarget({ baseId: item.id, targetId: "current" })}
            onCompareSaved={(base, target) => setVersionCompareTarget({ baseId: base.id, targetId: target.id })}
            onRestore={restoreVersion}
            onDelete={deleteVersion}
            onUndoDelete={undoDeleteVersion}
            onDismissDeleted={() => setDeletedVersion(null)}
          />

          {visibleRestoredVersionSummary ? (
            <RestoredVersionCard
              summary={visibleRestoredVersionSummary}
              onDismiss={() => setRestoredVersionSummary(null)}
              onFocus={focusCheckTarget}
            />
          ) : null}

          {hasContent ? (
            <Card className="mb-6">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.16em]">Resume Check</CardDescription>
                  <CardTitle>{passedChecks === checks.length ? "Ready to export" : "Needs attention"}</CardTitle>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {passedChecks}/{checks.length}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {checks.map((check) => (
                  <div key={check.id} className="flex min-h-14 gap-2 rounded-md border bg-muted/30 p-2.5">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                        check.ok ? "bg-emerald-700" : "bg-amber-700",
                      )}
                    >
                      {check.ok ? <Check className="size-3" /> : "!"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{check.label}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                      {!check.ok ? (
                        <>
                          <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 px-2"
                            onClick={() => focusCheckTarget(check.targetId)}
                          >
                            <ArrowRight /> {check.actionLabel}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {hasContent && exportCheckpoint ? (
            <Card className={cn("mb-6", exportIsCurrent ? "border-emerald-300 bg-emerald-50/70" : "border-indigo-300 bg-indigo-50/70")}>
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-background",
                      exportIsCurrent ? "border-emerald-300 text-emerald-800" : "border-indigo-300 text-indigo-800",
                    )}
                  >
                    {exportIsCurrent ? <FileCheck2 className="size-4" /> : <History className="size-4" />}
                  </span>
                  <div>
                    <CardDescription
                      className={cn(
                        "font-semibold uppercase tracking-[0.16em]",
                        exportIsCurrent ? "text-emerald-900" : "text-indigo-900",
                      )}
                    >
                      Last export
                    </CardDescription>
                    <CardTitle className="text-base">
                      {exportIsCurrent ? "Current resume matches your last PDF export." : "This resume changed since your last PDF export."}
                    </CardTitle>
                    <CardDescription>
                      Last opened print on {formatCheckpointTime(exportCheckpoint.exportedAt)} with {exportCheckpoint.pageCount}{" "}
                      {exportCheckpoint.pageCount === 1 ? "page" : "pages"} and{" "}
                      {exportCheckpoint.issueCount === 0
                        ? "no unresolved checks"
                        : `${exportCheckpoint.issueCount} unresolved ${exportCheckpoint.issueCount === 1 ? "item" : "items"}`}
                      .
                    </CardDescription>
                  </div>
                </div>
                {!exportIsCurrent ? (
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={requestExport}>
                    <Printer /> Export updated PDF
                  </Button>
                ) : null}
              </CardHeader>
              {!exportIsCurrent && exportChanges.length ? (
                <CardContent className="pt-0">
                  <ChangeSummaryGrid
                    changes={exportChanges}
                    beforeLabel="Before"
                    afterLabel="Now"
                    onSelect={(change) => focusCheckTarget(change.targetId)}
                  />
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          <div className="space-y-6">
            <FieldGroup title="Header">
              <TextField
                id="field-name"
                label="Full Name"
                value={state.name}
                placeholder="Jane Doe"
                reviewTarget={importReviewTargets.has("field-name")}
                onChange={(value) => updateField("name", value)}
              />
              <TextField
                id="field-title"
                label="Title / Role"
                value={state.title}
                placeholder="Senior Software Engineer"
                reviewTarget={importReviewTargets.has("field-title")}
                onChange={(value) => updateField("title", value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="field-email"
                  label="Email"
                  value={state.email}
                  placeholder="jane@example.com"
                  reviewTarget={importReviewTargets.has("field-email")}
                  onChange={(value) => updateField("email", value)}
                />
                <TextField
                  id="field-phone"
                  label="Phone"
                  value={state.phone}
                  placeholder="(555) 123-4567"
                  reviewTarget={importReviewTargets.has("field-phone")}
                  onChange={(value) => updateField("phone", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="field-location"
                  label="Location"
                  value={state.location}
                  placeholder="San Francisco, CA"
                  reviewTarget={importReviewTargets.has("field-location")}
                  onChange={(value) => updateField("location", value)}
                />
                <TextField
                  id="field-website"
                  label="Website / LinkedIn"
                  value={state.website}
                  placeholder="linkedin.com/in/janedoe"
                  reviewTarget={importReviewTargets.has("field-website")}
                  onChange={(value) => updateField("website", value)}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Summary">
              <TextAreaField
                id="field-summary"
                label="Professional Summary"
                value={state.summary}
                placeholder="Brief overview of your experience and strengths."
                reviewTarget={importReviewTargets.has("field-summary")}
                onChange={(value) => updateField("summary", value)}
              />
            </FieldGroup>

            {state.sectionOrder.map((section, sectionIndex) => (
              <FieldGroup
                key={section}
                title={SECTION_LABELS[section]}
                actions={
                  <div
                    id={sectionIndex === 0 ? "section-order-controls" : undefined}
                    className="flex items-center gap-1 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    tabIndex={sectionIndex === 0 ? -1 : undefined}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${SECTION_LABELS[section]} up`}
                      disabled={sectionIndex === 0}
                      onClick={() => moveSection(section, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${SECTION_LABELS[section]} down`}
                      disabled={sectionIndex === state.sectionOrder.length - 1}
                      onClick={() => moveSection(section, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    {section !== "skills" ? (
                      <Button id={`add-${section}-entry`} type="button" variant="outline" size="sm" onClick={() => addEntry(section)}>
                        Add
                      </Button>
                    ) : null}
                  </div>
                }
              >
                {section === "skills" ? (
                  <TextAreaField
                    id="field-skills"
                    label={'Skills (one group per line, e.g. "Languages: Python, Go")'}
                    value={state.skills}
                    placeholder={"Languages: Python, JavaScript, Go\nTools: Docker, Kubernetes, AWS"}
                    reviewTarget={importReviewTargets.has("field-skills")}
                    onChange={(value) => updateField("skills", value)}
                  />
                ) : (
                  <EntryList
                    section={section}
                    entries={state[section]}
                    reviewTargets={importReviewTargets}
                    onUpdate={updateEntry}
                    onMove={moveEntry}
                    onRemove={removeEntry}
                  />
                )}
              </FieldGroup>
            ))}
          </div>
        </section>

        <section className="preview-pane overflow-y-auto bg-muted/70 p-4 lg:max-h-[calc(100vh-73px)] lg:p-7" aria-label="Resume preview">
          <div className="mx-auto flex flex-col items-center gap-3">
            <ResumePreview state={state} ref={resumeRef} />
            <p className="app-chrome text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"} in preview
            </p>
          </div>
        </section>
      </main>

      <Dialog open={textReviewOpen} onOpenChange={setTextReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Plain-text export</DialogDescription>
            <DialogTitle>Review before copying</DialogTitle>
            <DialogDescription>
              This is the exact ATS-friendly text that will be copied for job applications and recruiter portals.
            </DialogDescription>
          </DialogHeader>
          {plainText ? (
            <Textarea value={plainText} readOnly className="min-h-[360px] resize-y whitespace-pre font-mono text-xs leading-relaxed" />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Add resume details first</AlertTitle>
              <AlertDescription>The plain-text review will appear once your resume has content.</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{plainText ? plainTextStats(plainText) : "0 words"}</span>
            <div className="flex justify-end gap-2">
              <Button type="button" onClick={copyPlainText} disabled={!plainText}>
                <ClipboardCopy /> Copy Text
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionSaveOpen} onOpenChange={setVersionSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Version history</DialogDescription>
            <DialogTitle>Name this checkpoint</DialogTitle>
            <DialogDescription>
              Add context before tailoring this resume so the right draft is easy to restore later.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveVersion();
            }}
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Checkpoint name</span>
              <Input
                value={versionDraftLabel}
                placeholder="Frontend manager draft"
                onChange={(event) => setVersionDraftLabel(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Note (optional)</span>
              <Textarea
                value={versionDraftNote}
                placeholder="Before tailoring bullets for the Stripe application."
                className="min-h-24"
                onChange={(event) => setVersionDraftNote(event.target.value)}
              />
            </label>
            {versionToReplaceOnSave ? (
              <Alert className="border-amber-300 bg-amber-50/70">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>History is full</AlertTitle>
                <AlertDescription>
                  Saving a new checkpoint will replace {versionToReplaceOnSave.label}, saved{" "}
                  {formatCheckpointTime(versionToReplaceOnSave.savedAt)}. Export JSON first if you want a backup outside
                  this browser.
                </AlertDescription>
              </Alert>
            ) : existingVersionForSave ? (
              <Alert>
                <History className="h-4 w-4" />
                <AlertTitle>Matching checkpoint found</AlertTitle>
                <AlertDescription>
                  Saving will refresh {existingVersionForSave.label} instead of using another local history slot.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <History className="h-4 w-4" />
                <AlertTitle>{MAX_VERSION_HISTORY - versionHistory.length} local slots available</AlertTitle>
                <AlertDescription>
                  Resume Editor keeps the newest {MAX_VERSION_HISTORY} checkpoints in this browser.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">Saved only in this browser.</span>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setVersionSaveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save /> Save Checkpoint
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={versionCompareOpen} onOpenChange={(open) => !open && setVersionCompareTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Version history</DialogDescription>
            <DialogTitle>{versionCompareUsesCurrent ? "Compare saved checkpoint" : "Compare saved versions"}</DialogTitle>
            <DialogDescription>{versionCompareDescription}</DialogDescription>
          </DialogHeader>

          {comparedBaseVersion && comparedTargetState ? (
            versionChanges.length ? (
              <div className="grid max-h-[56vh] gap-2 overflow-y-auto pr-1">
                {versionChanges.map((change) => (
                  <VersionChangeRow
                    key={change.id}
                    change={change}
                    beforeLabel={versionCompareBeforeLabel}
                    afterLabel={versionCompareAfterLabel}
                    onSelect={versionCompareUsesCurrent ? () => focusFromVersionCompare(change.targetId) : undefined}
                  />
                ))}
              </div>
            ) : (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>No differences found</AlertTitle>
                <AlertDescription>
                  {versionCompareUsesCurrent
                    ? "The current resume matches this saved checkpoint."
                    : "These saved checkpoints contain the same resume content."}
                </AlertDescription>
              </Alert>
            )
          ) : null}

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {versionChanges.length
                ? `${versionChanges.length} changed ${versionChanges.length === 1 ? "area" : "areas"}`
                : "Saved only in this browser"}
            </span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setVersionCompareTarget(null)}>
                Close
              </Button>
              {comparedTargetVersion ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    restoreVersion(comparedTargetVersion);
                    setVersionCompareTarget(null);
                  }}
                >
                  <Undo2 /> Restore Compared
                </Button>
              ) : null}
              {comparedBaseVersion ? (
                <Button
                  type="button"
                  onClick={() => {
                    restoreVersion(comparedBaseVersion);
                    setVersionCompareTarget(null);
                  }}
                >
                  <Undo2 /> {versionCompareUsesCurrent ? "Restore Saved" : "Restore Base"}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportCheckOpen} onOpenChange={setExportCheckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">PDF export check</DialogDescription>
            <DialogTitle>Review before exporting</DialogTitle>
            <DialogDescription>
              Fix the highest-impact items now, or continue if you have already reviewed the resume yourself.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {importReview ? (
              <div className="rounded-md border border-amber-300 bg-amber-50/70 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">PDF import still needs review</p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      Confirm the parser guessed fields correctly before exporting {importReview.fileName}.
                    </p>
                  </div>
                  <Badge variant="secondary">{importReview.items.length} fields</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {importReview.items.slice(0, 3).map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => focusFromExportCheck(item.targetId)}
                    >
                      <Eye /> {item.label}
                    </Button>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImportReview(null)}>
                    <Check /> Mark reviewed
                  </Button>
                </div>
              </div>
            ) : null}

            {failedChecks.length ? (
              <div className="grid gap-2">
                {failedChecks.map((check) => (
                  <div key={check.id} className="flex gap-2 rounded-md border bg-muted/30 p-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white">
                      !
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{check.label}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => focusFromExportCheck(check.targetId)}
                    >
                      <ArrowRight /> {check.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Resume checks passed</AlertTitle>
                <AlertDescription>The remaining checkpoint is the imported PDF review.</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {failedChecks.length ? `${failedChecks.length} resume ${failedChecks.length === 1 ? "issue" : "issues"}` : "Checks clear"}
            </span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExportCheckOpen(false)}>
                Keep Editing
              </Button>
              <Button type="button" onClick={exportAnyway}>
                <Printer /> Export Anyway
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          void openPdf(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          void openJson(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {toast ? (
        <div
          key={toast.id}
          className="app-chrome fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </>
  );
}

function VersionChangeRow({
  change,
  beforeLabel,
  afterLabel,
  onSelect,
}: {
  change: ExportChange;
  beforeLabel: string;
  afterLabel: string;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <History className="mt-0.5 size-4 shrink-0 text-indigo-800" />
      <div className="min-w-0">
        <span className="block font-semibold text-foreground">{change.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{change.detail}</span>
        <ChangeFieldLabels labels={change.fieldLabels} />
        {change.before || change.after ? (
          <span className="mt-2 grid gap-1 text-xs leading-snug text-muted-foreground">
            <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
              <span className="font-medium text-foreground">{beforeLabel}</span>
              <span className="truncate">{change.before ?? "Empty"}</span>
            </span>
            <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
              <span className="font-medium text-foreground">{afterLabel}</span>
              <span className="truncate">{change.after ?? "Empty"}</span>
            </span>
          </span>
        ) : null}
      </div>
      {onSelect ? (
        <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </>
  );

  const className =
    "group flex min-h-24 gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (onSelect) {
    return (
      <button type="button" className={cn(className, "hover:border-indigo-500")} onClick={onSelect}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function ChangeSummaryGrid({
  changes,
  beforeLabel,
  afterLabel,
  onSelect,
}: {
  changes: ExportChange[];
  beforeLabel: string;
  afterLabel: string;
  onSelect?: (change: ExportChange) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleChanges = showAll ? changes : changes.slice(0, CHANGE_PREVIEW_LIMIT);
  const hiddenCount = changes.length - visibleChanges.length;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visibleChanges.map((change) => (
        <VersionChangeRow
          key={change.id}
          change={change}
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
          onSelect={onSelect ? () => onSelect(change) : undefined}
        />
      ))}
      {changes.length > CHANGE_PREVIEW_LIMIT ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed bg-background p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {showAll
                ? `Showing all ${changes.length} changed areas`
                : `${hiddenCount} more changed ${hiddenCount === 1 ? "area" : "areas"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {showAll ? "Collapse the audit trail when you are done reviewing." : "Expand the full audit trail before exporting or restoring."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowAll((current) => !current)}>
            {showAll ? <ChevronUp /> : <ChevronDown />}
            {showAll ? "Show fewer changes" : "Show all changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RestoredVersionCard({
  summary,
  onDismiss,
  onFocus,
}: {
  summary: RestoredVersionSummary;
  onDismiss: () => void;
  onFocus: (targetId: string) => void;
}) {
  return (
    <Card className="mb-6 border-violet-300 bg-violet-50/70">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-violet-300 bg-background text-violet-800">
            <Undo2 className="size-4" />
          </span>
          <div>
            <CardDescription className="font-semibold uppercase tracking-[0.16em] text-violet-900">
              Checkpoint restored
            </CardDescription>
            <CardTitle className="text-base">{summary.label}</CardTitle>
            <CardDescription>
              Restored from the version saved {formatCheckpointTime(summary.savedAt)}. Review what changed from the draft
              you were editing.
            </CardDescription>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {summary.changes.length ? (
          <ChangeSummaryGrid
            changes={summary.changes}
            beforeLabel="Before"
            afterLabel="Restored"
            onSelect={(change) => onFocus(change.targetId)}
          />
        ) : (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>No differences found</AlertTitle>
            <AlertDescription>This checkpoint already matched the resume you were editing.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeFieldLabels({ labels }: { labels?: string[] }) {
  if (!labels?.length) return null;
  const visibleLabels = labels.slice(0, 4);
  const hiddenCount = labels.length - visibleLabels.length;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visibleLabels.map((label) => (
        <Badge key={label} variant="secondary" className="h-5 max-w-full truncate px-1.5 text-[10px] font-medium normal-case tracking-normal">
          {label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium normal-case tracking-normal">
          +{hiddenCount} more
        </Badge>
      ) : null}
    </div>
  );
}

function FieldGroup({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b pb-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function VersionHistoryCard({
  hasContent,
  versions,
  currentState,
  currentFingerprint,
  deletedVersion,
  onSave,
  onCompareCurrent,
  onCompareSaved,
  onRestore,
  onDelete,
  onUndoDelete,
  onDismissDeleted,
}: {
  hasContent: boolean;
  versions: VersionHistoryItem[];
  currentState: ResumeState;
  currentFingerprint: string;
  deletedVersion: VersionHistoryItem | null;
  onSave: () => void;
  onCompareCurrent: (item: VersionHistoryItem) => void;
  onCompareSaved: (base: VersionHistoryItem, target: VersionHistoryItem) => void;
  onRestore: (item: VersionHistoryItem) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onDismissDeleted: () => void;
}) {
  const [savedCompareBaseId, setSavedCompareBaseId] = useState("");
  const [savedCompareTargetId, setSavedCompareTargetId] = useState("");
  const versionInsights = useMemo(
    () =>
      versions.map((item) => {
        const text = resumePlainText(item.state);
        const isCurrent = item.fingerprint === currentFingerprint;
        const changesFromCurrent = isCurrent ? [] : exportChangeSummary(item.state, currentState);
        return { item, text, isCurrent, changesFromCurrent };
      }),
    [currentFingerprint, currentState, versions],
  );
  const suggestedComparison = useMemo(
    () =>
      versionInsights.reduce<(typeof versionInsights)[number] | null>((best, insight) => {
        if (insight.isCurrent || insight.changesFromCurrent.length === 0) return best;
        if (!best || insight.changesFromCurrent.length < best.changesFromCurrent.length) return insight;
        return best;
      }, null),
    [versionInsights],
  );
  const baseVersion = versions.find((item) => item.id === savedCompareBaseId) ?? versions[0] ?? null;
  const targetVersion =
    versions.find((item) => item.id === savedCompareTargetId && item.id !== baseVersion?.id) ??
    versions.find((item) => item.id !== baseVersion?.id) ??
    null;
  const oldestVersion = versions[versions.length - 1] ?? null;
  const remainingSlots = Math.max(0, MAX_VERSION_HISTORY - versions.length);

  if (!hasContent && !versions.length && !deletedVersion) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardDescription className="font-semibold uppercase tracking-[0.16em]">Version history</CardDescription>
          <CardTitle className="text-base">Save a local checkpoint before tailoring.</CardTitle>
          <CardDescription>
            Keep up to {MAX_VERSION_HISTORY} browser-only versions so you can experiment without losing a strong draft.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onSave} disabled={!hasContent}>
          <Save /> Save version
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {versions.length ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
              remainingSlots === 0 ? "border-amber-300 bg-amber-50/70" : "bg-background",
            )}
          >
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant={remainingSlots === 0 ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">
                  {versions.length}/{MAX_VERSION_HISTORY} saved
                </Badge>
                {remainingSlots === 0 ? (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    Full
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm font-semibold">
                {remainingSlots === 0 ? "New checkpoints replace the oldest saved draft." : "Local checkpoint space available."}
              </p>
              <p className="text-xs text-muted-foreground">
                {remainingSlots === 0 && oldestVersion
                  ? `${oldestVersion.label} is the oldest checkpoint and will be replaced first by a new unique save.`
                  : `${remainingSlots} ${remainingSlots === 1 ? "slot" : "slots"} left before Resume Editor starts replacing the oldest checkpoint.`}
              </p>
            </div>
            {remainingSlots === 0 ? (
              <Button type="button" variant="outline" size="sm" className="shrink-0 bg-background" onClick={onSave} disabled={!hasContent}>
                <Save /> Save with review
              </Button>
            ) : null}
          </div>
        ) : null}
        {deletedVersion ? (
          <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Deleted checkpoint
                </Badge>
                <span className="text-xs text-muted-foreground">Saved {formatCheckpointTime(deletedVersion.savedAt)}</span>
              </div>
              <p className="truncate text-sm font-semibold">{deletedVersion.label}</p>
              <p className="text-xs text-muted-foreground">Restore it to version history before closing this page.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onUndoDelete}>
                <Undo2 /> Undo delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDismissDeleted}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
        {suggestedComparison ? (
          <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Suggested checkpoint
                </Badge>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {suggestedComparison.changesFromCurrent.length} changed{" "}
                  {suggestedComparison.changesFromCurrent.length === 1 ? "area" : "areas"}
                </Badge>
              </div>
              <p className="truncate text-sm font-semibold">{suggestedComparison.item.label}</p>
              <p className="text-xs text-muted-foreground">
                Closest saved draft to the current resume. Review it first before restoring older checkpoints.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 bg-background"
              onClick={() => onCompareCurrent(suggestedComparison.item)}
            >
              <Eye /> Review differences
            </Button>
          </div>
        ) : null}
        {versions.length >= 2 && baseVersion && targetVersion ? (
          <div className="grid gap-3 rounded-md border bg-background p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Compare two saved checkpoints</p>
                <p className="text-xs text-muted-foreground">Audit tailoring changes without changing the current resume.</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onCompareSaved(baseVersion, targetVersion)}>
                <Eye /> Compare saved versions
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                <span>Base checkpoint</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={baseVersion.id}
                  onChange={(event) => setSavedCompareBaseId(event.target.value)}
                >
                  {versions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} - {formatCheckpointTime(item.savedAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                <span>Compared checkpoint</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={targetVersion.id}
                  onChange={(event) => setSavedCompareTargetId(event.target.value)}
                >
                  {versions
                    .filter((item) => item.id !== baseVersion.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} - {formatCheckpointTime(item.savedAt)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
        {versions.length ? (
          versionInsights.map(({ item, text, isCurrent, changesFromCurrent }) => {
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                    <History className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Saved {formatCheckpointTime(item.savedAt)}
                      </p>
                      {isCurrent ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          Current
                        </Badge>
                      ) : changesFromCurrent.length ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {changesFromCurrent.length} changed {changesFromCurrent.length === 1 ? "area" : "areas"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          No visible differences
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{versionHeadline(item.state)}</p>
                    {item.derivedFromLabel ? (
                      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="size-3 shrink-0" />
                        <span className="truncate">Derived from {item.derivedFromLabel}</span>
                      </p>
                    ) : null}
                    {item.note ? <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{item.note}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {versionContentBadges(item.state).map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="h-5 max-w-full truncate px-1.5 text-[10px] font-medium normal-case tracking-normal"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{text ? plainTextStats(text) : "Empty resume"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onCompareCurrent(item)}>
                    <Eye /> Compare
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onRestore(item)}>
                    <Undo2 /> Restore
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete saved version ${item.label}`} onClick={() => onDelete(item.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            No saved versions yet. Save one before adapting this resume for a specific job.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EntryList({
  section,
  entries,
  reviewTargets,
  onUpdate,
  onMove,
  onRemove,
}: {
  section: (typeof REPEATABLE_SECTIONS)[number];
  entries: ResumeEntry[];
  reviewTargets: Set<string>;
  onUpdate: (section: (typeof REPEATABLE_SECTIONS)[number], index: number, key: keyof ResumeEntry, value: string) => void;
  onMove: (section: (typeof REPEATABLE_SECTIONS)[number], index: number, direction: -1 | 1) => void;
  onRemove: (section: (typeof REPEATABLE_SECTIONS)[number], index: number) => void;
}) {
  const schema = ENTRY_SCHEMA[section];

  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No {SECTION_LABELS[section].toLowerCase()} entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <Card key={index} className="bg-muted/20 shadow-none">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Move entry up"
                  disabled={index === 0}
                  onClick={() => onMove(section, index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Move entry down"
                  disabled={index === entries.length - 1}
                  onClick={() => onMove(section, index, 1)}
                >
                  <ArrowDown />
                </Button>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(section, index)}>
                <Trash2 /> Remove
              </Button>
            </div>
            <TextField
              id={`field-${section}-${index}-title`}
              label={schema.title}
              value={entry.title}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-title`)}
              onChange={(value) => onUpdate(section, index, "title", value)}
            />
            <TextField
              id={`field-${section}-${index}-subtitle`}
              label={schema.subtitle}
              value={entry.subtitle}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-subtitle`)}
              onChange={(value) => onUpdate(section, index, "subtitle", value)}
            />
            <TextField
              id={`field-${section}-${index}-meta`}
              label={schema.meta}
              value={entry.meta}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-meta`)}
              onChange={(value) => onUpdate(section, index, "meta", value)}
            />
            <TextAreaField
              id={`field-${section}-${index}-details`}
              label={schema.details}
              value={entry.details}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-details`)}
              onChange={(value) => onUpdate(section, index, "details", value)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const ResumePreview = forwardRef<HTMLDivElement, { state: ResumeState }>(function ResumePreview({ state }, ref) {
  const hasContent = hasAnyContent(state);

  return (
    <div
      ref={ref}
      className={cn("resume-sheet", !hasContent && "resume-empty")}
      style={{ "--resume-scale": state.textScale } as CSSProperties}
    >
      {!hasContent ? <EmptyResumePreview /> : <FilledResumePreview state={state} />}
    </div>
  );
});

function EmptyResumePreview() {
  return (
    <div aria-label="Empty resume preview">
      <p className="mb-2 font-sans text-[0.78em] font-bold uppercase tracking-[1px] text-[#666]">Clean one-page structure</p>
      <h1 className="resume-name">Your Name</h1>
      <div className="resume-contact">
        <span>email@example.com</span>
        <span>(555) 123-4567</span>
        <span>City, ST</span>
        <span>linkedin.com/in/you</span>
      </div>
      <div className="resume-empty-line resume-empty-line-wide" />
      <div className="resume-empty-line" />
      <section className="resume-section">
        <h2 className="resume-section-title">Experience</h2>
        <div className="resume-empty-role" />
        <ul className="resume-bullets">
          <li>Lead with measurable impact, scope, and outcomes.</li>
          <li>Keep each bullet concise enough to scan quickly.</li>
        </ul>
      </section>
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
        <div className="resume-empty-line resume-empty-line-short" />
      </section>
    </div>
  );
}

function FilledResumePreview({ state }: { state: ResumeState }) {
  const contactParts = [state.email, state.phone, state.location, state.website].filter(Boolean);

  return (
    <>
      <h1 className="resume-name">{state.name || "Your Name"}</h1>
      {state.title ? <div className="resume-title">{state.title}</div> : null}
      {contactParts.length ? (
        <div className="resume-contact">
          {contactParts.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      ) : null}
      {state.summary ? <p className="resume-lead">{state.summary}</p> : null}
      {state.sectionOrder.map((section) => (
        <ResumeSection key={section} state={state} section={section} />
      ))}
    </>
  );
}

function ResumeSection({ state, section }: { state: ResumeState; section: SectionKey }) {
  if (section === "skills") {
    const lines = state.skills
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    return (
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
        <div>
          {lines.map((line) => {
            const index = line.indexOf(":");
            return (
              <div className="resume-skill-line" key={line}>
                {index > -1 ? (
                  <>
                    <span className="resume-skill-cat">{line.slice(0, index).trim()}:</span> {line.slice(index + 1).trim()}
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const entries = state[section].filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details);
  if (!entries.length) return null;

  return (
    <section className="resume-section">
      <h2 className="resume-section-title">{SECTION_LABELS[section]}</h2>
      {entries.map((entry, index) => (
        <div className="resume-entry" key={`${entry.title}-${entry.subtitle}-${index}`}>
          <div className="resume-entry-head">
            <div>{entry.title ? <span className="resume-entry-role">{entry.title}</span> : null}</div>
            {entry.meta ? <div className="resume-entry-meta">{entry.meta}</div> : null}
          </div>
          {entry.subtitle ? <div className="resume-entry-sub">{entry.subtitle}</div> : null}
          {bulletsFrom(entry.details).length ? (
            <ul className="resume-bullets">
              {bulletsFrom(entry.details).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}
