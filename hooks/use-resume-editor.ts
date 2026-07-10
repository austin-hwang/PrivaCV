"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importResumePdfWithSource, importResumeTextWithSource } from "@/lib/pdf-import";
import { buildRoleFocus } from "@/lib/job-match";
import {
  blankEntry,
  buildResumeChecks,
  clampTextScale,
  emptyState,
  exportChangeSummary,
  hasAnyContent,
  normalizeResume,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
  type ResumeEntry,
  type ResumeState,
  type SectionKey,
} from "@/lib/resume";
import {
  EXPORT_CHECKPOINT_KEY,
  MAX_VERSION_HISTORY,
  REPEATABLE_SECTIONS,
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

export function useResumeEditor() {
  const [state, setState] = useState<ResumeState>(() => emptyState());
  const [loaded, setLoaded] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [textReviewOpen, setTextReviewOpen] = useState(false);
  const [textImportOpen, setTextImportOpen] = useState(false);
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
  const [historyBackupToImport, setHistoryBackupToImport] = useState<VersionHistoryItem[] | null>(null);
  const [exportCheckpoint, setExportCheckpoint] = useState<ExportCheckpoint | null>(null);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const historyBackupInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);

  const hasContent = hasAnyContent(state);
  const checks = useMemo(() => buildResumeChecks(state, pageCount), [state, pageCount]);
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

  const flash = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
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
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 220);
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
    if (!loaded) return;
    try {
      if (jobDescription.trim()) localStorage.setItem(ROLE_FOCUS_KEY, jobDescription);
      else localStorage.removeItem(ROLE_FOCUS_KEY);
    } catch {
      // The role description remains available for this session if storage fails.
    }
  }, [jobDescription, loaded]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (roleLabel.trim()) localStorage.setItem(ROLE_FOCUS_LABEL_KEY, roleLabel);
      else localStorage.removeItem(ROLE_FOCUS_LABEL_KEY);
    } catch {
      // The role label remains available for this session if storage fails.
    }
  }, [loaded, roleLabel]);

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

  const loadSample = () => {
    saveRecoveryPoint("Before loading the sample");
    setState(sampleState());
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

  return {
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
    passedChecks,
    pdfInputRef,
    plainText,
    recoveryPoint,
    removeEntry,
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
    textReviewOpen,
    textImportOpen,
    toast,
    toggleImportReviewItem,
    completeImportReview,
    undoDeleteVersion,
    updateEntry,
    updateField,
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
