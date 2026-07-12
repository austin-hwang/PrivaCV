"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importResumePdfWithSource, importResumeTextWithSource } from "@/lib/pdf-import";
import { resumeDocxBlob } from "@/lib/docx-export";
import { buildRoleFocus } from "@/lib/job-match";
import {
  blankEntry,
  buildResumeChecks,
  clampTextScale,
  emptyState,
  exportChangeSummary,
  getSectionEntries,
  hasAnyContent,
  isBuiltinSection,
  normalizeResume,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
  SECTION_LABELS,
  type SectionKey,
  type CustomSection,
  type ResumeEntry,
  type ResumeState,
  type OversizedResumeEntry,
} from "@/lib/resume";
import {
  EXPORT_CHECKPOINT_KEY,
  MAX_VERSION_HISTORY,
  ROLE_FOCUS_KEY,
  ROLE_FOCUS_LABEL_KEY,
  STORAGE_KEY,
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  VERSION_HISTORY_KEY,
  buildImportReview,
  formatCheckpointTime,
  importReviewProgress,
  mergeVersionHistory,
  parseExportCheckpoint,
  parseVersionHistory,
  parseVersionHistoryBackup,
  roleContextFingerprint,
  versionHistoryFingerprint,
  versionLabel,
  versionReplacementCandidate,
  type ExportCheckpoint,
  type ImportReviewState,
  type RecoveryPoint,
  type RestoredVersionSummary,
  type ToastState,
  type VersionCompareTarget,
  type VersionHistoryBackup,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadFile(blob, filename);
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadFile(blob, filename);
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function safeResumeFilename(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "resume";
}

/**
 * Browsers commonly use document.title as the initial Save as PDF filename.
 * Keep that transient title descriptive, but restore the public page title as
 * soon as printing finishes.
 */
function pdfDocumentTitle(name: string) {
  const filename = safeResumeFilename(name);
  return filename === "resume" ? "Resume" : `${filename}_Resume`;
}

type UndoableRemoval =
  | {
      kind: "entry";
      toastId: number;
      section: string;
      index: number;
      entry: ResumeEntry;
    }
  | {
      kind: "custom-section";
      toastId: number;
      section: CustomSection;
      sectionOrderIndex: number;
    }
  | {
      kind: "builtin-section";
      toastId: number;
      section: SectionKey;
      title: string;
      entries: ResumeEntry[];
      skills: string;
      sectionOrderIndex: number;
    };

export function useResumeEditor() {
  const [state, setState] = useState<ResumeState>(() => emptyState());
  const [loaded, setLoaded] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [pageGuides, setPageGuides] = useState<Array<{ page: number; label?: string }>>([]);
  const [oversizedEntry, setOversizedEntry] = useState<OversizedResumeEntry | null>(null);
  const [textReviewOpen, setTextReviewOpen] = useState(false);
  const [textImportOpen, setTextImportOpen] = useState(false);
  const [exportCheckOpen, setExportCheckOpen] = useState(false);
  const [versionSaveOpen, setVersionSaveOpen] = useState(false);
  const [versionDraftLabel, setVersionDraftLabel] = useState("");
  const [versionDraftNote, setVersionDraftNote] = useState("");
  const [versionCompareTarget, setVersionCompareTarget] = useState<VersionCompareTarget | null>(null);
  const [draftSourceVersionId, setDraftSourceVersionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [undoableRemoval, setUndoableRemoval] = useState<UndoableRemoval | null>(null);
  const [importReview, setImportReview] = useState<ImportReviewState | null>(null);
  const [recoveryPoint, setRecoveryPoint] = useState<RecoveryPoint | null>(null);
  const [restoredVersionSummary, setRestoredVersionSummary] = useState<RestoredVersionSummary | null>(null);
  const [deletedVersion, setDeletedVersion] = useState<VersionHistoryItem | null>(null);
  const [historyBackupToImport, setHistoryBackupToImport] = useState<VersionHistoryItem[] | null>(null);
  const [exportCheckpoint, setExportCheckpoint] = useState<ExportCheckpoint | null>(null);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [storageIssue, setStorageIssue] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const historyBackupInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const requestExportRef = useRef<() => void>(() => undefined);

  const hasContent = hasAnyContent(state);
  const checks = useMemo(() => buildResumeChecks(state, pageCount, oversizedEntry), [oversizedEntry, pageCount, state]);
  const failedChecks = checks.filter((check) => !check.ok);
  const passedChecks = checks.filter((check) => check.ok).length;
  const plainText = useMemo(() => resumePlainText(state), [state]);
  const roleFocus = useMemo(() => buildRoleFocus(state, jobDescription), [jobDescription, state]);
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
  const comparedBaseRoleFocus = comparedBaseVersion?.jobDescription ?? "";
  const comparedBaseRoleLabel = comparedBaseVersion?.roleLabel ?? "";
  const comparedTargetRoleFocus = versionCompareUsesCurrent ? jobDescription : comparedTargetVersion?.jobDescription ?? "";
  const comparedTargetRoleLabel = versionCompareUsesCurrent ? roleLabel : comparedTargetVersion?.roleLabel ?? "";
  const versionRoleFocusChanged =
    roleContextFingerprint(comparedBaseRoleFocus, comparedBaseRoleLabel) !==
    roleContextFingerprint(comparedTargetRoleFocus, comparedTargetRoleLabel);
  const currentVersionHistoryFingerprint = useMemo(
    () => `${exportFingerprint}\u0000${roleContextFingerprint(jobDescription, roleLabel)}`,
    [exportFingerprint, jobDescription, roleLabel],
  );
  const versionToReplaceOnSave = useMemo(
    () => versionReplacementCandidate(versionHistory, currentVersionHistoryFingerprint),
    [currentVersionHistoryFingerprint, versionHistory],
  );
  const existingVersionForSave = useMemo(
    () => versionHistory.find((item) => versionHistoryFingerprint(item) === currentVersionHistoryFingerprint) ?? null,
    [currentVersionHistoryFingerprint, versionHistory],
  );
  const mergedHistoryBackup = useMemo(
    () =>
      historyBackupToImport
        ? mergeVersionHistory(versionHistory, historyBackupToImport)
        : { checkpoints: [], overflow: [], incomingUnique: [], matchingCheckpoints: [] },
    [historyBackupToImport, versionHistory],
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
  const importReviewItemsByTarget = useMemo(() => {
    const reviewedItemIds = new Set(importReview?.reviewedItemIds ?? []);
    return new Map(
      (importReview?.items ?? []).map((item) => [item.targetId, {
        ...item,
        confirmed: reviewedItemIds.has(item.id),
      }]),
    );
  }, [importReview]);
  const importReviewStatus = useMemo(
    () => (importReview ? importReviewProgress(importReview) : null),
    [importReview],
  );

  const flash = useCallback((message: string, action?: ToastState["action"]) => {
    const id = Date.now();
    setToast({ id, message, action });
    if (!action) setUndoableRemoval(null);
    return id;
  }, []);

  const reportStorageIssue = useCallback(() => {
    setStorageIssue(true);
  }, []);

  const confirmStorageAvailable = useCallback(() => {
    setStorageIssue(false);
  }, []);

  const saveRecoveryPoint = useCallback(
    (
      label: string,
      previousState = state,
      previousImportReview = importReview,
      previousJobDescription = jobDescription,
      previousRoleLabel = roleLabel,
    ) => {
      if (!hasAnyContent(previousState) && !previousImportReview) {
        setRecoveryPoint(null);
        return;
      }
      setRecoveryPoint({
        label,
        state: previousState,
        importReview: previousImportReview,
        jobDescription: previousJobDescription,
        roleLabel: previousRoleLabel,
      });
    },
    [importReview, jobDescription, roleLabel, state],
  );

  const restoreRecoveryPoint = () => {
    if (!recoveryPoint) return;
    setState(recoveryPoint.state);
    setImportReview(recoveryPoint.importReview);
    setJobDescription(recoveryPoint.jobDescription);
    setRoleLabel(recoveryPoint.roleLabel);
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
    const historyFingerprint = `${fingerprint}\u0000${roleContextFingerprint(jobDescription, roleLabel)}`;
    const label = versionDraftLabel.trim() || versionLabel(state);
    const note = versionDraftNote.trim();
    const replacement = versionReplacementCandidate(versionHistory, historyFingerprint);
    const derivedFrom =
      versionHistory.find((item) => item.id === draftSourceVersionId && versionHistoryFingerprint(item) !== historyFingerprint) ??
      versionHistory.find((item) => versionHistoryFingerprint(item) !== historyFingerprint) ??
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
      jobDescription: jobDescription.trim() || undefined,
      roleLabel: roleLabel.trim() || undefined,
    };
    setVersionHistory((current) => [entry, ...current.filter((item) => versionHistoryFingerprint(item) !== historyFingerprint)].slice(0, MAX_VERSION_HISTORY));
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
    setJobDescription(item.jobDescription ?? "");
    setRoleLabel(item.roleLabel ?? "");
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

  const focusCheckTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "smooth" });
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
      setJobDescription(localStorage.getItem(ROLE_FOCUS_KEY) ?? "");
      setRoleLabel(localStorage.getItem(ROLE_FOCUS_LABEL_KEY) ?? "");
    } catch {
      reportStorageIssue();
    } finally {
      setLoaded(true);
    }
  }, [reportStorageIssue]);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        confirmStorageAvailable();
      } catch {
        reportStorageIssue();
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [confirmStorageAvailable, loaded, reportStorageIssue, state]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(versionHistory));
    } catch {
      reportStorageIssue();
    }
  }, [loaded, reportStorageIssue, versionHistory]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (jobDescription.trim()) localStorage.setItem(ROLE_FOCUS_KEY, jobDescription);
      else localStorage.removeItem(ROLE_FOCUS_KEY);
    } catch {
      reportStorageIssue();
    }
  }, [jobDescription, loaded, reportStorageIssue]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (roleLabel.trim()) localStorage.setItem(ROLE_FOCUS_LABEL_KEY, roleLabel);
      else localStorage.removeItem(ROLE_FOCUS_LABEL_KEY);
    } catch {
      reportStorageIssue();
    }
  }, [loaded, reportStorageIssue, roleLabel]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
      if (toast.action === "undo") {
        setUndoableRemoval((current) => current?.toastId === toast.id ? null : current);
      }
    }, toast.action === "undo" ? 5000 : 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const measure = () => {
      const sheet = resumeRef.current;
      if (!sheet) return;
      const pageHeightPx = 11 * 96;
      const roundingTolerancePx = 2;
      const nextPageCount = Math.max(1, Math.ceil((sheet.scrollHeight - roundingTolerancePx) / pageHeightPx));
      setPageCount(nextPageCount);

      // A page boundary is most useful when it tells a person what will be
      // encountered next. Use the live preview geometry so this remains true
      // as text, font, density, or section order changes; the guides remain
      // screen-only and do not affect the exported document.
      const guideTargets = Array.from(sheet.querySelectorAll<HTMLElement>("[data-resume-guide-label]"));
      const nextPageGuides = Array.from({ length: Math.max(0, nextPageCount - 1) }, (_, index) => {
        const page = index + 2;
        const boundary = (page - 1) * pageHeightPx;
        const nextTarget = guideTargets.find((target) => target.offsetTop + target.offsetHeight > boundary + roundingTolerancePx);
        return { page, label: nextTarget?.dataset.resumeGuideLabel };
      });
      setPageGuides((current) =>
        current.length === nextPageGuides.length && current.every((guide, index) =>
          guide.page === nextPageGuides[index].page && guide.label === nextPageGuides[index].label,
        )
          ? current
          : nextPageGuides,
      );

      // Entries normally stay together in print. If an entry is taller than a
      // printable content area, though, every browser must split it. Surface
      // that specific role before export instead of leaving its continuation
      // to appear without a heading on a later page.
      const sheetStyle = window.getComputedStyle(sheet);
      const printableContentHeight = pageHeightPx -
        Number.parseFloat(sheetStyle.paddingTop) -
        Number.parseFloat(sheetStyle.paddingBottom);
      const nextOversizedEntry = Array.from(sheet.querySelectorAll<HTMLElement>("[data-resume-entry-section]")).find((entry) =>
        entry.offsetHeight > printableContentHeight + roundingTolerancePx,
      );
      const next = nextOversizedEntry
        ? {
            section: nextOversizedEntry.dataset.resumeEntrySection ?? "experience",
            index: Number(nextOversizedEntry.dataset.resumeEntryIndex ?? 0),
          }
        : null;
      setOversizedEntry((current) =>
        current?.section === next?.section && current?.index === next?.index ? current : next,
      );
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
    section: string,
    index: number,
    key: keyof ResumeEntry,
    value: string,
  ) => {
    setState((current) => {
      if (isBuiltinSection(section) && section !== "skills") {
        return {
          ...current,
          [section]: current[section].map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [key]: value } : entry,
          ),
        };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section
            ? { ...custom, entries: custom.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) }
            : custom,
        ),
      };
    });
  };

  const swapExperienceTitleAndCompany = (index: number) => {
    setState((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) =>
        entryIndex === index
          ? { ...entry, title: entry.subtitle, subtitle: entry.title }
          : entry,
      ),
    }));
  };

  const addEntry = (section: string) => {
    setState((current) => {
      if (isBuiltinSection(section) && section !== "skills") {
        return { ...current, [section]: [...current[section], blankEntry()] };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section ? { ...custom, entries: [...custom.entries, blankEntry()] } : custom,
        ),
      };
    });
  };

  const removeEntry = (section: string, index: number) => {
    const entry = getSectionEntries(state, section)[index];
    if (!entry) return;
    const sectionTitle = isBuiltinSection(section)
      ? state.sectionTitles[section]
      : state.customSections.find((custom) => custom.id === section)?.title ?? "Custom section";
    setState((current) => {
      if (isBuiltinSection(section) && section !== "skills") {
        return { ...current, [section]: current[section].filter((_, entryIndex) => entryIndex !== index) };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section ? { ...custom, entries: custom.entries.filter((_, entryIndex) => entryIndex !== index) } : custom,
        ),
      };
    });
    const toastId = flash(`Removed ${sectionTitle || "custom"} entry`, "undo");
    setUndoableRemoval({ kind: "entry", toastId, section, index, entry });
  };

  const reorderEntry = (section: string, index: number, target: number) => {
    setState((current) => {
      const next = [...getSectionEntries(current, section)];
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      if (isBuiltinSection(section) && section !== "skills") return { ...current, [section]: next };
      return {
        ...current,
        customSections: current.customSections.map((custom) => custom.id === section ? { ...custom, entries: next } : custom),
      };
    });
  };

  const moveEntry = (section: string, index: number, direction: -1 | 1) => reorderEntry(section, index, index + direction);

  const reorderSection = (section: string, target: number) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...current, sectionOrder: next };
    });
  };

  const moveSection = (section: string, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sectionOrder: next };
    });
  };

  const updateSectionTitle = (section: string, title: string) => {
    setState((current) => {
      if (isBuiltinSection(section)) {
        return { ...current, sectionTitles: { ...current.sectionTitles, [section]: title } };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) => custom.id === section ? { ...custom, title } : custom),
      };
    });
  };

  const addCustomSection = (title = "New Section") => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setState((current) => ({
      ...current,
      customSections: [...current.customSections, { id, title, entries: [blankEntry()] }],
      sectionOrder: [...current.sectionOrder, id],
    }));
    return id;
  };

  const addBuiltinSection = (section: SectionKey) => {
    setState((current) => {
      if (current.sectionOrder.includes(section)) return current;
      const next = {
        ...current,
        sectionOrder: [...current.sectionOrder, section],
        sectionTitles: { ...current.sectionTitles, [section]: SECTION_LABELS[section] },
      };
      if (section === "skills") return { ...next, skills: "" };
      return { ...next, [section]: [blankEntry()] };
    });
    flash(`Added ${SECTION_LABELS[section]} section`);
  };

  const removeCustomSection = (section: string) => {
    const removedSection = state.customSections.find((custom) => custom.id === section);
    if (!removedSection) return;
    const sectionOrderIndex = state.sectionOrder.indexOf(section);
    setState((current) => ({
      ...current,
      customSections: current.customSections.filter((custom) => custom.id !== section),
      sectionOrder: current.sectionOrder.filter((id) => id !== section),
    }));
    const toastId = flash(`Removed ${removedSection.title || "custom"} section`, "undo");
    setUndoableRemoval({ kind: "custom-section", toastId, section: removedSection, sectionOrderIndex });
  };

  const removeBuiltinSection = (section: SectionKey) => {
    if (!state.sectionOrder.includes(section)) return;
    const sectionOrderIndex = state.sectionOrder.indexOf(section);
    const title = state.sectionTitles[section];
    const entries = section === "skills" ? [] : state[section];
    const skills = section === "skills" ? state.skills : "";
    setState((current) => {
      if (!current.sectionOrder.includes(section)) return current;
      const next = {
        ...current,
        sectionOrder: current.sectionOrder.filter((id) => id !== section),
        sectionTitles: { ...current.sectionTitles, [section]: SECTION_LABELS[section] },
      };
      if (section === "skills") return { ...next, skills: "" };
      return { ...next, [section]: [] };
    });
    const toastId = flash(`Removed ${title || SECTION_LABELS[section]} section`, "undo");
    setUndoableRemoval({ kind: "builtin-section", toastId, section, title, entries, skills, sectionOrderIndex });
  };

  const undoRemoval = () => {
    if (!undoableRemoval) return;
    setState((current) => {
      if (undoableRemoval.kind === "entry") {
        const { section, index, entry } = undoableRemoval;
        if (isBuiltinSection(section) && section !== "skills") {
          const entries = [...current[section]];
          entries.splice(Math.min(index, entries.length), 0, entry);
          return { ...current, [section]: entries };
        }
        const customSection = current.customSections.find((item) => item.id === section);
        if (!customSection) return current;
        const entries = [...customSection.entries];
        entries.splice(Math.min(index, entries.length), 0, entry);
        return {
          ...current,
          customSections: current.customSections.map((item) =>
            item.id === section ? { ...item, entries } : item,
          ),
        };
      }

      if (undoableRemoval.kind === "custom-section") {
        if (current.customSections.some((item) => item.id === undoableRemoval.section.id)) return current;
        const sectionOrder = [...current.sectionOrder];
        sectionOrder.splice(Math.min(undoableRemoval.sectionOrderIndex, sectionOrder.length), 0, undoableRemoval.section.id);
        return {
          ...current,
          customSections: [...current.customSections, undoableRemoval.section],
          sectionOrder,
        };
      }

      if (current.sectionOrder.includes(undoableRemoval.section)) return current;
      const sectionOrder = [...current.sectionOrder];
      sectionOrder.splice(Math.min(undoableRemoval.sectionOrderIndex, sectionOrder.length), 0, undoableRemoval.section);
      const next = {
        ...current,
        sectionOrder,
        sectionTitles: { ...current.sectionTitles, [undoableRemoval.section]: undoableRemoval.title },
      };
      if (undoableRemoval.section === "skills") return { ...next, skills: undoableRemoval.skills };
      return { ...next, [undoableRemoval.section]: undoableRemoval.entries };
    });
    setUndoableRemoval(null);
    flash(undoableRemoval.kind === "entry" ? "Restored entry" : "Restored section");
  };

  const loadSample = () => {
    saveRecoveryPoint("Before loading the sample");
    // Loading a sample should replace the resume content, not quietly undo the
    // design a person just chose to evaluate it in. Keep every visual setting
    // (including scale) aligned with the active preview and PDF.
    setState((current) => ({
      ...sampleState(),
      template: current.template,
      theme: current.theme,
      textScale: current.textScale,
    }));
    setImportReview(null);
    setRestoredVersionSummary(null);
    setDraftSourceVersionId(null);
    flash("Sample loaded");
  };

  const clearResume = () => {
    saveRecoveryPoint("Before clearing the resume");
    setState(emptyState());
    setImportReview(null);
    setRestoredVersionSummary(null);
    setDraftSourceVersionId(null);
    flash("Cleared");
  };

  const dismissRecoveryPoint = () => {
    setRecoveryPoint(null);
  };

  const dismissRestoredVersionSummary = () => {
    setRestoredVersionSummary(null);
  };

  const toggleImportReviewItem = (itemId: string) => {
    setImportReview((current) => {
      if (!current || !current.items.some((item) => item.id === itemId)) return current;
      const reviewedItemIds = new Set(current.reviewedItemIds ?? []);
      if (reviewedItemIds.has(itemId)) {
        reviewedItemIds.delete(itemId);
      } else {
        reviewedItemIds.add(itemId);
      }
      return { ...current, reviewedItemIds: [...reviewedItemIds] };
    });
  };

  // A person can inspect the source-backed checklist as a whole and make one
  // deliberate acknowledgement when it is accurate. Keep the per-field path
  // intact for corrections, but do not turn a trustworthy import into a row
  // of repetitive confirmation clicks.
  const confirmAllImportReviewItems = () => {
    setImportReview((current) => {
      if (!current) return current;
      return { ...current, reviewedItemIds: current.items.map((item) => item.id) };
    });
  };

  const completeImportReview = () => {
    if (!importReview || !importReviewProgress(importReview).isComplete) return;
    setImportReview(null);
    flash("Import review complete");
  };

  const saveJson = () => {
    downloadJsonFile(state, `${safeResumeFilename(state.name || "resume")}.json`);
    flash("Saved JSON to downloads");
  };

  const saveVersionHistoryBackup = () => {
    if (!versionHistory.length) {
      flash("Save a checkpoint first");
      return;
    }
    const backup: VersionHistoryBackup = {
      format: VERSION_HISTORY_BACKUP_FORMAT,
      version: VERSION_HISTORY_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      checkpoints: versionHistory,
    };
    downloadJsonFile(backup, `${safeResumeFilename(state.name || "resume")}-checkpoints.json`);
    flash("Saved checkpoint backup to downloads");
  };

  const openVersionHistoryBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const checkpoints = parseVersionHistoryBackup(JSON.parse(await file.text()));
      if (!checkpoints?.length) {
        flash("That backup has no saved checkpoints");
        return;
      }
      setHistoryBackupToImport(checkpoints);
    } catch {
      flash("That file is not a checkpoint backup");
    }
  };

  const importVersionHistoryBackup = () => {
    if (!historyBackupToImport) return;
    const importedCount = mergedHistoryBackup.checkpoints.filter((checkpoint) =>
      mergedHistoryBackup.incomingUnique.some(
        (incoming) => versionHistoryFingerprint(incoming) === versionHistoryFingerprint(checkpoint),
      ),
    ).length;
    const matchingCount = mergedHistoryBackup.matchingCheckpoints.length;
    setVersionHistory(mergedHistoryBackup.checkpoints);
    setHistoryBackupToImport(null);
    setDeletedVersion(null);
    setVersionCompareTarget(null);
    setDraftSourceVersionId(null);
    flash(
      importedCount
        ? `Added ${importedCount} ${importedCount === 1 ? "checkpoint" : "checkpoints"}${
            matchingCount ? ` · ${matchingCount} already saved` : ""
          }`
        : "All backup checkpoints are already saved",
    );
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
      const imported = await importResumePdfWithSource(file);
      saveRecoveryPoint(`Before importing ${file.name}`, previousState, previousImportReview);
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, file.name, imported.sourceText));
      setRestoredVersionSummary(null);
      setDraftSourceVersionId(null);
      flash("Imported PDF - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this PDF");
    } finally {
      setIsImporting(false);
    }
  };

  const openTextImport = (text: string) => {
    try {
      const imported = importResumeTextWithSource(text);
      saveRecoveryPoint("Before importing pasted resume text");
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, "pasted resume text", imported.sourceText));
      setRestoredVersionSummary(null);
      setDraftSourceVersionId(null);
      setTextImportOpen(false);
      flash("Imported pasted text - please review");
      return true;
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import pasted text");
      return false;
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

  const downloadPlainText = () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    downloadTextFile(plainText, `${safeResumeFilename(state.name || "resume")}.txt`);
    flash("Saved plain text to downloads");
  };

  const downloadDocx = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    downloadFile(resumeDocxBlob(state), `${safeResumeFilename(state.name || "resume")}.docx`);
    flash("Saved Word document to downloads");
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
      reportStorageIssue();
    }

    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
    };
    document.title = pdfDocumentTitle(state.name);
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  };

  const requestExport = () => {
    if (failedChecks.length || importReview) {
      setExportCheckOpen(true);
      return;
    }
    startPrintExport();
  };

  // People naturally reach for the browser print shortcut when a PDF is the
  // goal. Keep that familiar route, but do not let it skip the same local
  // review checkpoint used by the visible Export PDF control.
  requestExportRef.current = requestExport;

  useEffect(() => {
    const handlePrintShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLowerCase() !== "p"
      ) {
        return;
      }

      event.preventDefault();
      requestExportRef.current();
    };

    window.addEventListener("keydown", handlePrintShortcut);
    return () => window.removeEventListener("keydown", handlePrintShortcut);
  }, []);

  const exportAnyway = () => {
    setExportCheckOpen(false);
    window.setTimeout(startPrintExport, 120);
  };

  const focusFromExportCheck = (targetId: string) => {
    setExportCheckOpen(false);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  };

  return {
    addCustomSection,
    addBuiltinSection,
    addEntry,
    checks,
    clearResume,
    comparedBaseRoleFocus,
    comparedBaseRoleLabel,
    comparedBaseVersion,
    comparedTargetRoleFocus,
    comparedTargetRoleLabel,
    comparedTargetState,
    comparedTargetVersion,
    copyPlainText,
    deleteVersion,
    downloadDocx,
    downloadPlainText,
    deletedVersion,
    dismissRecoveryPoint,
    dismissRestoredVersionSummary,
    existingVersionForSave,
    exportAnyway,
    exportChanges,
    exportCheckOpen,
    exportCheckpoint,
    exportFingerprint,
    exportIsCurrent,
    failedChecks,
    focusCheckTarget,
    focusFromExportCheck,
    focusFromVersionCompare,
    hasContent,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importReviewItemsByTarget,
    importReviewStatus,
    importReviewTargets,
    importVersionHistoryBackup,
    isImporting,
    jobDescription,
    jsonInputRef,
    loadSample,
    mergedHistoryBackup,
    moveEntry,
    moveSection,
    openJson,
    openPdf,
    openTextImport,
    openVersionHistoryBackup,
    openVersionSave,
    pageCount,
    pageGuides,
    passedChecks,
    pdfInputRef,
    plainText,
    recoveryPoint,
    removeEntry,
    removeCustomSection,
    removeBuiltinSection,
    reorderEntry,
    reorderSection,
    requestExport,
    restoreRecoveryPoint,
    restoreVersion,
    restoredVersionSummary,
    resumeRef,
    roleFocus,
    roleLabel,
    saveJson,
    saveVersion,
    saveVersionHistoryBackup,
    setDeletedVersion,
    setExportCheckOpen,
    setHistoryBackupToImport,
    setImportReview,
    setJobDescription,
    setRoleLabel,
    setTextReviewOpen,
    setTextImportOpen,
    setVersionCompareTarget,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    state,
    storageIssue,
    swapExperienceTitleAndCompany,
    textReviewOpen,
    textImportOpen,
    toast,
    toggleImportReviewItem,
    confirmAllImportReviewItems,
    completeImportReview,
    undoDeleteVersion,
    undoRemoval,
    updateEntry,
    updateField,
    updateSectionTitle,
    versionChanges,
    versionCompareAfterLabel,
    versionCompareBeforeLabel,
    versionCompareDescription,
    versionCompareOpen,
    versionCompareUsesCurrent,
    versionDraftLabel,
    versionDraftNote,
    versionHistory,
    versionRoleFocusChanged,
    versionSaveOpen,
    versionToReplaceOnSave,
    visibleRestoredVersionSummary,
  };
}
