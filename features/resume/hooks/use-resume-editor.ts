"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadJsonFile } from "@/lib/browser-files";
import { clearResumeWorkspace } from "@/lib/resume-db";
import {
  buildResumeChecks,
  emptyState,
  hasAnyContent,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
  type ResumeState,
} from "@/lib/resume";
import {
  ACTIVE_RESUME_KEY,
  CHECKPOINT_HISTORY_KEY,
  IMPORT_REVIEW_KEY,
  RESUME_LIBRARY_KEY,
  STORAGE_KEY,
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  VERSION_HISTORY_KEY,
  importReviewProgress,
  mergeVersionHistory,
  parseVersionHistoryBackup,
  versionHistoryFingerprint,
  type ImportReviewState,
  type RecoveryPoint,
  type ResumeLibraryItem,
  type ToastState,
  type VersionHistoryBackup,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";
import { useResumeExport } from "@/features/resume/hooks/use-resume-export";
import {
  useResumeContentActions,
  type UndoableResumeChange,
} from "@/features/resume/hooks/use-resume-content-actions";
import { useResumeHistory } from "@/features/resume/hooks/use-resume-history";
import { useResumeImport } from "@/features/resume/hooks/use-resume-import";
import { useResumeLibrary } from "@/features/resume/hooks/use-resume-library";
import { useResumePagination } from "@/features/resume/hooks/use-resume-pagination";
import {
  AUTOSAVE_TIME_KEY,
  useResumePersistence,
} from "@/features/resume/hooks/use-resume-persistence";
import { safeResumeFilename } from "@/features/resume/lib/resume-file-name";

export function useResumeEditor() {
  const [state, setState] = useState<ResumeState>(() => emptyState());
  const { pageCount, pageGuides, printBreaks, resumeRef } = useResumePagination(state);
  const [loaded, setLoaded] = useState(false);
  const [textReviewOpen, setTextReviewOpen] = useState(false);
  const [applicationCopyOpen, setApplicationCopyOpen] = useState(false);
  const [textImportOpen, setTextImportOpen] = useState(false);
  const [versionSaveOpen, setVersionSaveOpen] = useState(false);
  const [versionDraftLabel, setVersionDraftLabel] = useState("");
  const [versionDraftNote, setVersionDraftNote] = useState("");
  const [draftSourceVersionId, setDraftSourceVersionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [undoableRemoval, setUndoableRemoval] = useState<UndoableResumeChange | null>(null);
  const [importReview, setImportReview] = useState<ImportReviewState | null>(null);
  const [recoveryPoint, setRecoveryPoint] = useState<RecoveryPoint | null>(null);
  const [deletedVersion, setDeletedVersion] = useState<VersionHistoryItem | null>(null);
  const [historyBackupToImport, setHistoryBackupToImport] = useState<VersionHistoryItem[] | null>(
    null,
  );
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [resumeLibrary, setResumeLibrary] = useState<ResumeLibraryItem[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [checkpointHistoryByResume, setCheckpointHistoryByResume] = useState<
    Record<string, VersionHistoryItem[]>
  >({});
  const [storageIssue, setStorageIssue] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"saving" | "saved" | "conflict">("saved");
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  // Unlike the live editor state, this is the exact draft most recently
  // written to browser storage. It makes the autosave entry a real restore
  // point while a newer edit is waiting for its debounce to finish.
  const [autosavedState, setAutosavedState] = useState<ResumeState | null>(null);
  const [externalDraft, setExternalDraft] = useState<ResumeState | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const historyBackupInputRef = useRef<HTMLInputElement>(null);
  const resumeLibraryRef = useRef<ResumeLibraryItem[]>([]);
  // A deliberate privacy reset should not immediately recreate an empty draft
  // in browser storage. The next actual edit resumes normal autosave.
  const skipNextAutosaveRef = useRef(false);
  const lastAutomaticCheckpointAtRef = useRef(Date.now());
  const automaticCheckpointRef = useRef<
    (options: {
      idPrefix: "auto-checkpoint" | "autosave-slot";
      label: string;
      note: string;
      snapshot?: ResumeState;
      snapshotImportReview?: ImportReviewState | null;
    }) => boolean
  >(() => false);
  resumeLibraryRef.current = resumeLibrary;

  const hasContent = hasAnyContent(state);
  const checks = useMemo(() => buildResumeChecks(state, pageCount), [pageCount, state]);
  const failedChecks = checks.filter((check) => !check.ok);
  const passedChecks = checks.filter((check) => check.ok).length;
  const plainText = useMemo(() => resumePlainText(state), [state]);
  const exportFingerprint = useMemo(() => resumeExportFingerprint(state), [state]);
  const currentVersionHistoryFingerprint = exportFingerprint;
  const existingVersionForSave = useMemo(
    () =>
      versionHistory.find(
        (item) => versionHistoryFingerprint(item) === currentVersionHistoryFingerprint,
      ) ?? null,
    [currentVersionHistoryFingerprint, versionHistory],
  );
  const mergedHistoryBackup = useMemo(
    () =>
      historyBackupToImport
        ? mergeVersionHistory(versionHistory, historyBackupToImport)
        : { checkpoints: [], incomingUnique: [], matchingCheckpoints: [] },
    [historyBackupToImport, versionHistory],
  );
  const importReviewTargets = useMemo(
    () => new Set(importReview?.items.map((item) => item.targetId) ?? []),
    [importReview],
  );
  const importReviewItemsByTarget = useMemo(() => {
    const reviewedItemIds = new Set(importReview?.reviewedItemIds ?? []);
    return new Map(
      (importReview?.items ?? []).map((item) => [
        item.targetId,
        {
          ...item,
          confirmed: reviewedItemIds.has(item.id),
        },
      ]),
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

  const mirrorLegacyActiveHistory = useCallback((history: VersionHistoryItem[]) => {
    if (history.length) localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(history));
    else localStorage.removeItem(VERSION_HISTORY_KEY);
  }, []);

  const {
    checkpointBeforeDestructiveEdit,
    clearVersionHistory,
    deleteVersion,
    forkAutosaveBeforeLoading,
    openVersionSave,
    persistVersionHistory,
    restoreRecoveryPoint,
    restoreVersion,
    saveRecoveryPoint,
    saveVersion,
    undoDeleteVersion,
  } = useResumeHistory({
    state,
    setState,
    importReview,
    setImportReview,
    activeResumeId,
    checkpointHistoryByResume,
    setCheckpointHistoryByResume,
    versionHistory,
    setVersionHistory,
    draftSourceVersionId,
    setDraftSourceVersionId,
    versionDraftLabel,
    setVersionDraftLabel,
    versionDraftNote,
    setVersionDraftNote,
    setVersionSaveOpen,
    recoveryPoint,
    setRecoveryPoint,
    deletedVersion,
    setDeletedVersion,
    lastAutomaticCheckpointAtRef,
    automaticCheckpointRef,
    mirrorLegacyActiveHistory,
    confirmStorageAvailable,
    reportStorageIssue,
    flash,
  });

  const { createResume, deleteResume, duplicateResume, renameResume, switchResume } =
    useResumeLibrary({
      state,
      setState,
      importReview,
      setImportReview,
      resumeLibrary,
      setResumeLibrary,
      activeResumeId,
      setActiveResumeId,
      checkpointHistoryByResume,
      setCheckpointHistoryByResume,
      setVersionHistory,
      setAutosavedState,
      setAutosavedAt,
      setExternalDraft,
      setDraftSourceVersionId,
      forkAutosaveBeforeLoading,
      mirrorLegacyActiveHistory,
      confirmStorageAvailable,
      reportStorageIssue,
      flash,
    });

  const focusCheckTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const {
    applyAIImportFix,
    completeImportReview,
    isImporting,
    openJson,
    openResumeFile,
    openTextImport,
    toggleImportReviewItem,
  } = useResumeImport({
    state,
    importReview,
    setState,
    setImportReview,
    setDraftSourceVersionId,
    setTextImportOpen,
    flash,
    forkAutosaveBeforeLoading,
    saveRecoveryPoint,
  });

  const {
    copyApplicationField,
    copyPlainText,
    downloadPlainText,
    exportAnyway,
    exportCheckOpen,
    exportingPdf,
    focusFromExportCheck,
    pendingExportFormat,
    requestDocxExport,
    requestExport,
    saveJson,
    saveMarkdown,
    setExportCheckOpen,
  } = useResumeExport({
    state,
    printBreaks,
    plainText,
    failedChecks,
    importReview,
    flash,
    focusCheckTarget,
  });

  const { keepCurrentDraft, useExternalDraft } = useResumePersistence({
    state,
    setState,
    loaded,
    setLoaded,
    importReview,
    setImportReview,
    setResumeLibrary,
    resumeLibraryRef,
    activeResumeId,
    setActiveResumeId,
    setCheckpointHistoryByResume,
    setVersionHistory,
    externalDraft,
    setExternalDraft,
    setAutosavedState,
    setAutosavedAt,
    setAutosaveStatus,
    skipNextAutosaveRef,
    lastAutomaticCheckpointAtRef,
    automaticCheckpointRef,
    mirrorLegacyActiveHistory,
    forkAutosaveBeforeLoading,
    saveRecoveryPoint,
    confirmStorageAvailable,
    reportStorageIssue,
    flash,
  });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(
      () => {
        setToast((current) => (current?.id === toast.id ? null : current));
        if (toast.action === "undo") {
          setUndoableRemoval((current) => (current?.toastId === toast.id ? null : current));
        }
      },
      toast.action === "undo" ? 5000 : 1600,
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  const {
    addBuiltinSection,
    addCustomSection,
    addEntry,
    moveEntry,
    moveSection,
    removeBuiltinSection,
    removeCustomSection,
    removeEntry,
    reorderEntry,
    reorderSection,
    swapExperienceTitleAndCompany,
    tightenLayout,
    toggleSectionHidden,
    undoRemoval,
    updateEntry,
    updateField,
    updateSectionFormat,
    updateSectionTagGroups,
    updateSectionText,
    updateSectionTitle,
  } = useResumeContentActions({
    state,
    setState,
    undoableRemoval,
    setUndoableRemoval,
    checkpointBeforeDestructiveEdit,
    flash,
  });
  const loadSample = () => {
    const nextState: ResumeState = {
      ...sampleState(),
      template: state.template,
      theme: state.theme,
      textScale: state.textScale,
    };
    forkAutosaveBeforeLoading(nextState, "the sample resume");
    saveRecoveryPoint("Before loading the sample");
    // Loading a sample should replace the resume content, not quietly undo the
    // design a person just chose to evaluate it in. Keep every visual setting
    // (including scale) aligned with the active preview and PDF.
    setState(nextState);
    setImportReview(null);
    setDraftSourceVersionId(null);
    flash("Sample loaded");
  };

  const clearResume = () => {
    const nextState = emptyState();
    forkAutosaveBeforeLoading(nextState, "a blank resume");
    saveRecoveryPoint("Before clearing the resume");
    setState(nextState);
    setImportReview(null);
    setDraftSourceVersionId(null);
    flash("Cleared");
  };

  /**
   * Remove resume content and the related browser-only records together. This
   * is intentionally separate from Clear, whose recovery point is useful when
   * someone merely wants to start over while keeping their local work safe.
   */
  const clearSavedBrowserData = async () => {
    try {
      await clearResumeWorkspace();
      confirmStorageAvailable();
    } catch {
      reportStorageIssue();
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("resume-editor-data-v1");
      localStorage.removeItem(IMPORT_REVIEW_KEY);
      localStorage.removeItem(RESUME_LIBRARY_KEY);
      localStorage.removeItem(ACTIVE_RESUME_KEY);
      localStorage.removeItem(CHECKPOINT_HISTORY_KEY);
      localStorage.removeItem("resume-editor-last-export-v1");
      localStorage.removeItem(VERSION_HISTORY_KEY);
      localStorage.removeItem(AUTOSAVE_TIME_KEY);
      localStorage.removeItem("resume-editor-role-focus-v1");
      localStorage.removeItem("resume-editor-role-focus-label-v1");
    } catch {
      // The authoritative IndexedDB workspace was already cleared.
    }
    skipNextAutosaveRef.current = true;
    setState(emptyState());
    setImportReview(null);
    setVersionHistory([]);
    setResumeLibrary([]);
    setActiveResumeId(null);
    setCheckpointHistoryByResume({});
    setAutosavedAt(null);
    setAutosavedState(null);
    setRecoveryPoint(null);
    setDeletedVersion(null);
    setHistoryBackupToImport(null);
    setUndoableRemoval(null);
    setExternalDraft(null);
    setDraftSourceVersionId(null);
    flash("Deleted all data");
  };

  const dismissRecoveryPoint = () => {
    setRecoveryPoint(null);
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

  const importVersionHistoryBackup = async () => {
    if (!historyBackupToImport) return;
    const importedCount = mergedHistoryBackup.checkpoints.filter((checkpoint) =>
      mergedHistoryBackup.incomingUnique.some(
        (incoming) => versionHistoryFingerprint(incoming) === versionHistoryFingerprint(checkpoint),
      ),
    ).length;
    const matchingCount = mergedHistoryBackup.matchingCheckpoints.length;
    const saved = await persistVersionHistory(mergedHistoryBackup.checkpoints);
    setVersionHistory(mergedHistoryBackup.checkpoints);
    setHistoryBackupToImport(null);
    setDeletedVersion(null);
    setDraftSourceVersionId(null);
    const message = importedCount
      ? `Added ${importedCount} ${importedCount === 1 ? "checkpoint" : "checkpoints"}${
          matchingCount ? ` · ${matchingCount} already saved` : ""
        }`
      : "All backup checkpoints are already saved";
    flash(saved ? message : `${message} · not saved to this browser`);
  };

  return {
    activeResumeId,
    addCustomSection,
    addBuiltinSection,
    addEntry,
    applicationCopyOpen,
    applyAIImportFix,
    autosaveStatus,
    autosavedAt,
    autosavedState,
    checks,
    clearVersionHistory,
    clearSavedBrowserData,
    clearResume,
    createResume,
    copyApplicationField,
    copyPlainText,
    importFileInputRef,
    deleteVersion,
    deleteResume,
    requestDocxExport,
    downloadPlainText,
    duplicateResume,
    externalDraft,
    deletedVersion,
    dismissRecoveryPoint,
    existingVersionForSave,
    exportAnyway,
    exportCheckOpen,
    exportingPdf,
    pendingExportFormat,
    exportFingerprint,
    failedChecks,
    focusCheckTarget,
    focusFromExportCheck,
    hasContent,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importReviewItemsByTarget,
    importReviewStatus,
    importReviewTargets,
    importVersionHistoryBackup,
    isImporting,
    jsonInputRef,
    keepCurrentDraft,
    loaded,
    loadSample,
    mergedHistoryBackup,
    moveEntry,
    moveSection,
    openJson,
    openResumeFile,
    openTextImport,
    openVersionHistoryBackup,
    openVersionSave,
    pageCount,
    pageGuides,
    printBreaks,
    passedChecks,
    plainText,
    recoveryPoint,
    renameResume,
    removeEntry,
    removeCustomSection,
    removeBuiltinSection,
    reorderEntry,
    reorderSection,
    toggleSectionHidden,
    requestExport,
    resumeLibrary,
    restoreRecoveryPoint,
    restoreVersion,
    resumeRef,
    saveJson,
    saveMarkdown,
    saveVersion,
    saveVersionHistoryBackup,
    setDeletedVersion,
    setExportCheckOpen,
    setApplicationCopyOpen,
    setHistoryBackupToImport,
    setImportReview,
    setTextReviewOpen,
    setTextImportOpen,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    state,
    storageIssue,
    swapExperienceTitleAndCompany,
    textReviewOpen,
    textImportOpen,
    tightenLayout,
    toast,
    toggleImportReviewItem,
    completeImportReview,
    undoDeleteVersion,
    undoRemoval,
    updateEntry,
    updateField,
    updateSectionFormat,
    updateSectionTagGroups,
    updateSectionText,
    updateSectionTitle,
    useExternalDraft,
    switchResume,
    versionDraftLabel,
    versionDraftNote,
    versionHistory,
    versionSaveOpen,
  };
}
