"use client";

import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  buildLegacyResumeWorkspace,
  loadOrMigrateResumeWorkspace,
  saveResumeLibrary,
} from "@/lib/resume-db";
import {
  hasAnyContent,
  normalizeResume,
  resumeExportFingerprint,
  type ResumeState,
} from "@/lib/resume";
import {
  ACTIVE_RESUME_KEY,
  CHECKPOINT_HISTORY_KEY,
  IMPORT_REVIEW_KEY,
  RESUME_LIBRARY_KEY,
  STORAGE_KEY,
  VERSION_HISTORY_KEY,
  importReviewDraftFingerprint,
  parseStoredImportReview,
  storedImportReview,
  versionLabel,
  type ImportReviewState,
  type ResumeLibraryItem,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

export const AUTOSAVE_TIME_KEY = "resume-editor-autosave-time-v1";
export const PERIODIC_CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;

type AutomaticCheckpoint = (options: {
  idPrefix: "auto-checkpoint" | "autosave-slot";
  label: string;
  note: string;
  snapshot?: ResumeState;
  snapshotImportReview?: ImportReviewState | null;
}) => boolean;

type Options = {
  state: ResumeState;
  setState: Dispatch<SetStateAction<ResumeState>>;
  loaded: boolean;
  setLoaded: Dispatch<SetStateAction<boolean>>;
  importReview: ImportReviewState | null;
  setImportReview: Dispatch<SetStateAction<ImportReviewState | null>>;
  setResumeLibrary: Dispatch<SetStateAction<ResumeLibraryItem[]>>;
  resumeLibraryRef: MutableRefObject<ResumeLibraryItem[]>;
  activeResumeId: string | null;
  setActiveResumeId: Dispatch<SetStateAction<string | null>>;
  setCheckpointHistoryByResume: Dispatch<SetStateAction<Record<string, VersionHistoryItem[]>>>;
  setVersionHistory: Dispatch<SetStateAction<VersionHistoryItem[]>>;
  externalDraft: ResumeState | null;
  setExternalDraft: Dispatch<SetStateAction<ResumeState | null>>;
  setAutosavedState: Dispatch<SetStateAction<ResumeState | null>>;
  setAutosavedAt: Dispatch<SetStateAction<string | null>>;
  setAutosaveStatus: Dispatch<SetStateAction<"saving" | "saved" | "conflict">>;
  skipNextAutosaveRef: MutableRefObject<boolean>;
  lastAutomaticCheckpointAtRef: MutableRefObject<number>;
  automaticCheckpointRef: MutableRefObject<AutomaticCheckpoint>;
  mirrorLegacyActiveHistory: (history: VersionHistoryItem[]) => void;
  forkAutosaveBeforeLoading: (nextState: ResumeState, destinationLabel: string) => void;
  saveRecoveryPoint: (label: string) => void;
  confirmStorageAvailable: () => void;
  reportStorageIssue: () => void;
  flash: (message: string) => unknown;
};

export function useResumePersistence({
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
}: Options) {
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const legacy = {
        savedDraft: localStorage.getItem(STORAGE_KEY),
        legacyDraft: localStorage.getItem("resume-editor-data-v1"),
        importReview: localStorage.getItem(IMPORT_REVIEW_KEY),
        resumeLibrary: localStorage.getItem(RESUME_LIBRARY_KEY),
        activeResumeId: localStorage.getItem(ACTIVE_RESUME_KEY),
        checkpointHistory: localStorage.getItem(CHECKPOINT_HISTORY_KEY),
        legacyVersionHistory: localStorage.getItem(VERSION_HISTORY_KEY),
        autosaveTime: localStorage.getItem(AUTOSAVE_TIME_KEY),
      };
      try {
        const { workspace, migrated } = await loadOrMigrateResumeWorkspace(legacy);
        if (cancelled) return;
        const activeHistory = workspace.activeResumeId
          ? workspace.checkpointHistoryByResume[workspace.activeResumeId] ?? []
          : [];
        setResumeLibrary(workspace.resumeLibrary);
        setActiveResumeId(workspace.activeResumeId);
        setCheckpointHistoryByResume(workspace.checkpointHistoryByResume);
        setVersionHistory(activeHistory);
        setState(workspace.activeState);
        setAutosavedState(workspace.activeState);
        setAutosavedAt(workspace.activeUpdatedAt);
        setImportReview(workspace.activeReview);
        try {
          localStorage.setItem(RESUME_LIBRARY_KEY, JSON.stringify(workspace.resumeLibrary));
          if (workspace.activeResumeId) localStorage.setItem(ACTIVE_RESUME_KEY, workspace.activeResumeId);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace.activeState));
          localStorage.setItem(AUTOSAVE_TIME_KEY, workspace.activeUpdatedAt);
          if (workspace.activeReview) localStorage.setItem(IMPORT_REVIEW_KEY, JSON.stringify(storedImportReview(workspace.activeReview)));
          else localStorage.removeItem(IMPORT_REVIEW_KEY);
          if (Object.keys(workspace.checkpointHistoryByResume).length) {
            localStorage.setItem(CHECKPOINT_HISTORY_KEY, JSON.stringify(workspace.checkpointHistoryByResume));
          } else localStorage.removeItem(CHECKPOINT_HISTORY_KEY);
          mirrorLegacyActiveHistory(activeHistory);
          if (migrated) localStorage.removeItem(VERSION_HISTORY_KEY);
        } catch {
          // The IndexedDB copy is already durable even if a legacy mirror is too large.
        }
        localStorage.removeItem("resume-editor-last-export-v1");
        localStorage.removeItem("resume-editor-role-focus-v1");
        localStorage.removeItem("resume-editor-role-focus-label-v1");
        confirmStorageAvailable();
      } catch {
        if (!cancelled) {
          try {
            const workspace = buildLegacyResumeWorkspace(legacy);
            const activeHistory = workspace.activeResumeId
              ? workspace.checkpointHistoryByResume[workspace.activeResumeId] ?? []
              : [];
            setResumeLibrary(workspace.resumeLibrary);
            setActiveResumeId(workspace.activeResumeId);
            setCheckpointHistoryByResume(workspace.checkpointHistoryByResume);
            setVersionHistory(activeHistory);
            setState(workspace.activeState);
            setAutosavedState(workspace.activeState);
            setAutosavedAt(workspace.activeUpdatedAt);
            setImportReview(workspace.activeReview);
          } catch {
            // Malformed legacy data must not prevent the editor from opening.
          }
          reportStorageIssue();
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void hydrate();
    return () => { cancelled = true; };
  }, [confirmStorageAvailable, mirrorLegacyActiveHistory, reportStorageIssue, setActiveResumeId, setAutosavedAt, setAutosavedState, setCheckpointHistoryByResume, setImportReview, setLoaded, setResumeLibrary, setState, setVersionHistory]);

  useEffect(() => {
    const handleExternalDraft = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const nextDraft = normalizeResume(JSON.parse(event.newValue));
        if (resumeExportFingerprint(nextDraft) !== resumeExportFingerprint(state)) setExternalDraft(nextDraft);
      } catch {
        // Never replace the open draft with a malformed external value.
      }
    };
    window.addEventListener("storage", handleExternalDraft);
    return () => window.removeEventListener("storage", handleExternalDraft);
  }, [setExternalDraft, state]);

  useEffect(() => {
    lastAutomaticCheckpointAtRef.current = Date.now();
  }, [activeResumeId, lastAutomaticCheckpointAtRef]);

  useEffect(() => {
    if (!loaded) return;
    if (externalDraft) {
      setAutosaveStatus("conflict");
      return;
    }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      setAutosaveStatus("saved");
      return;
    }
    setAutosaveStatus("saving");
    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const normalizedState = normalizeResume(state);
      let nextActiveId = activeResumeId;
      let nextLibrary = resumeLibraryRef.current;
      if (activeResumeId) {
        nextLibrary = nextLibrary.map((item) => item.id === activeResumeId
          ? {
              ...item,
              label: item.label === "Untitled resume" && hasAnyContent(state) ? versionLabel(state) : item.label,
              updatedAt: savedAt,
              state: normalizedState,
              importReview,
            }
          : item);
      } else {
        nextActiveId = `resume-${Date.now().toString(36)}`;
        nextLibrary = [{
          id: nextActiveId,
          label: versionLabel(state),
          createdAt: savedAt,
          updatedAt: savedAt,
          state: normalizedState,
          importReview,
        }];
        setActiveResumeId(nextActiveId);
      }
      setResumeLibrary(nextLibrary);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(AUTOSAVE_TIME_KEY, savedAt);
        localStorage.setItem(RESUME_LIBRARY_KEY, JSON.stringify(nextLibrary));
        if (nextActiveId) localStorage.setItem(ACTIVE_RESUME_KEY, nextActiveId);
      } catch {
        // IndexedDB below remains authoritative when a compatibility mirror exceeds quota.
      }
      void saveResumeLibrary(nextLibrary, nextActiveId, savedAt).then(() => {
        confirmStorageAvailable();
        setAutosavedState(normalizedState);
        setAutosavedAt(savedAt);
        setAutosaveStatus("saved");
        if (
          nextActiveId &&
          hasAnyContent(state) &&
          Date.now() - lastAutomaticCheckpointAtRef.current >= PERIODIC_CHECKPOINT_INTERVAL_MS
        ) {
          automaticCheckpointRef.current({
            idPrefix: "auto-checkpoint",
            label: `Auto · ${versionLabel(state)}`,
            note: "Saved automatically after 10 minutes of continued editing.",
          });
        }
      }).catch(() => {
        reportStorageIssue();
        setAutosaveStatus("conflict");
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeResumeId, automaticCheckpointRef, confirmStorageAvailable, externalDraft, importReview, lastAutomaticCheckpointAtRef, loaded, reportStorageIssue, resumeLibraryRef, setActiveResumeId, setAutosaveStatus, setAutosavedAt, setAutosavedState, setResumeLibrary, skipNextAutosaveRef, state]);

  useEffect(() => {
    if (!loaded) return;
    try {
      if (importReview) localStorage.setItem(IMPORT_REVIEW_KEY, JSON.stringify(storedImportReview(importReview)));
      else localStorage.removeItem(IMPORT_REVIEW_KEY);
    } catch {
      reportStorageIssue();
    }
  }, [importReview, loaded, reportStorageIssue]);

  useEffect(() => {
    if (!importReview) return;
    const draftFingerprint = importReviewDraftFingerprint(state);
    if (importReview.draftFingerprint === draftFingerprint) return;
    setImportReview((current) => current ? { ...current, draftFingerprint } : null);
  }, [importReview, setImportReview, state]);

  const useExternalDraft = () => {
    if (!externalDraft) return;
    forkAutosaveBeforeLoading(externalDraft, "the draft saved in another tab");
    saveRecoveryPoint("Before using the draft saved in another tab");
    const externalReview = parseStoredImportReview(localStorage.getItem(IMPORT_REVIEW_KEY));
    const matchingExternalReview =
      externalReview?.draftFingerprint === importReviewDraftFingerprint(externalDraft)
        ? externalReview
        : null;
    setState(externalDraft);
    setImportReview(matchingExternalReview);
    setExternalDraft(null);
    flash(matchingExternalReview ? "Loaded the draft and its import review" : "Loaded the draft saved in another tab");
  };

  const keepCurrentDraft = () => {
    setExternalDraft(null);
    flash("Keeping this tab's draft");
  };

  return { keepCurrentDraft, useExternalDraft };
}
