"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { downloadJsonFile } from "@/lib/browser-files";
import { saveCheckpointHistories } from "@/lib/resume-db";
import {
  hasAnyContent,
  normalizeResume,
  resumeExportFingerprint,
  type ResumeState,
} from "@/lib/resume";
import {
  CHECKPOINT_HISTORY_KEY,
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  limitAutomaticCheckpoints,
  versionHistoryFingerprint,
  versionLabel,
  type ImportReviewState,
  type RecoveryPoint,
  type VersionHistoryBackup,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";
import { safeResumeFilename } from "@/features/resume/lib/resume-file-name";

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
  importReview: ImportReviewState | null;
  setImportReview: Dispatch<SetStateAction<ImportReviewState | null>>;
  activeResumeId: string | null;
  checkpointHistoryByResume: Record<string, VersionHistoryItem[]>;
  setCheckpointHistoryByResume: Dispatch<SetStateAction<Record<string, VersionHistoryItem[]>>>;
  versionHistory: VersionHistoryItem[];
  setVersionHistory: Dispatch<SetStateAction<VersionHistoryItem[]>>;
  draftSourceVersionId: string | null;
  setDraftSourceVersionId: Dispatch<SetStateAction<string | null>>;
  versionDraftLabel: string;
  setVersionDraftLabel: Dispatch<SetStateAction<string>>;
  versionDraftNote: string;
  setVersionDraftNote: Dispatch<SetStateAction<string>>;
  setVersionSaveOpen: Dispatch<SetStateAction<boolean>>;
  recoveryPoint: RecoveryPoint | null;
  setRecoveryPoint: Dispatch<SetStateAction<RecoveryPoint | null>>;
  deletedVersion: VersionHistoryItem | null;
  setDeletedVersion: Dispatch<SetStateAction<VersionHistoryItem | null>>;
  lastAutomaticCheckpointAtRef: MutableRefObject<number>;
  automaticCheckpointRef: MutableRefObject<AutomaticCheckpoint>;
  mirrorLegacyActiveHistory: (history: VersionHistoryItem[]) => void;
  confirmStorageAvailable: () => void;
  reportStorageIssue: () => void;
  flash: (message: string) => unknown;
};

export function useResumeHistory({
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
}: Options) {
  const persistVersionHistory = useCallback(
    async (nextHistory: VersionHistoryItem[]) => {
      if (!activeResumeId) return false;
      const nextByResume = { ...checkpointHistoryByResume, [activeResumeId]: nextHistory };
      if (!nextHistory.length) delete nextByResume[activeResumeId];
      try {
        if (Object.keys(nextByResume).length)
          localStorage.setItem(CHECKPOINT_HISTORY_KEY, JSON.stringify(nextByResume));
        else localStorage.removeItem(CHECKPOINT_HISTORY_KEY);
        mirrorLegacyActiveHistory(nextHistory);
      } catch {
        // IndexedDB remains authoritative when the compatibility mirror fails.
      }
      setCheckpointHistoryByResume(nextByResume);
      try {
        await saveCheckpointHistories(nextByResume, checkpointHistoryByResume);
        confirmStorageAvailable();
        return true;
      } catch {
        reportStorageIssue();
        return false;
      }
    },
    [
      activeResumeId,
      checkpointHistoryByResume,
      confirmStorageAvailable,
      mirrorLegacyActiveHistory,
      reportStorageIssue,
      setCheckpointHistoryByResume,
    ],
  );

  const saveAutomaticCheckpoint: AutomaticCheckpoint = ({
    idPrefix,
    label,
    note,
    snapshot = state,
    snapshotImportReview = importReview,
  }) => {
    if (!activeResumeId || !hasAnyContent(snapshot)) return false;
    const fingerprint = resumeExportFingerprint(snapshot);
    if (versionHistory.some((item) => versionHistoryFingerprint(item) === fingerprint)) {
      lastAutomaticCheckpointAtRef.current = Date.now();
      return false;
    }
    const timestamp = Date.now();
    let id = `${idPrefix}-${timestamp}`;
    let suffix = 2;
    while (versionHistory.some((item) => item.id === id)) {
      id = `${idPrefix}-${timestamp}-${suffix}`;
      suffix += 1;
    }
    const derivedFrom = versionHistory.find((item) => item.id === draftSourceVersionId) ?? null;
    const entry: VersionHistoryItem = {
      id,
      savedAt: new Date(timestamp).toISOString(),
      label,
      note,
      derivedFromId: derivedFrom?.id,
      derivedFromLabel: derivedFrom?.label,
      fingerprint,
      state: normalizeResume(snapshot),
      importReview: snapshotImportReview,
    };
    const nextHistory = limitAutomaticCheckpoints([entry, ...versionHistory]);
    void persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
    lastAutomaticCheckpointAtRef.current = timestamp;
    return true;
  };
  automaticCheckpointRef.current = saveAutomaticCheckpoint;

  const saveRecoveryPoint = useCallback(
    (label: string, previousState = state, previousImportReview = importReview) => {
      if (!hasAnyContent(previousState) && !previousImportReview) {
        setRecoveryPoint(null);
        return;
      }
      setRecoveryPoint({ label, state: previousState, importReview: previousImportReview });
    },
    [importReview, setRecoveryPoint, state],
  );

  const restoreRecoveryPoint = () => {
    if (!recoveryPoint) return;
    setState(recoveryPoint.state);
    setImportReview(recoveryPoint.importReview);
    setRecoveryPoint(null);
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

  const saveVersion = async () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    const fingerprint = resumeExportFingerprint(state);
    const label = versionDraftLabel.trim() || versionLabel(state);
    const note = versionDraftNote.trim();
    const derivedFrom = versionHistory.find((item) => item.id === draftSourceVersionId) ?? null;
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
    const nextHistory = [entry, ...versionHistory];
    const saved = await persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
    setDraftSourceVersionId(entry.id);
    lastAutomaticCheckpointAtRef.current = Date.now();
    setVersionSaveOpen(false);
    if (saved) flash("Checkpoint saved locally");
    else {
      downloadJsonFile(
        {
          format: VERSION_HISTORY_BACKUP_FORMAT,
          version: VERSION_HISTORY_BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          checkpoints: nextHistory,
        } satisfies VersionHistoryBackup,
        `${safeResumeFilename(state.name || "resume")}-checkpoints.json`,
      );
      flash("Browser storage unavailable — checkpoint backup downloaded");
    }
  };

  const forkAutosaveBeforeLoading = (nextState: ResumeState, destinationLabel: string) => {
    if (!hasAnyContent(state)) return;
    if (resumeExportFingerprint(state) === resumeExportFingerprint(nextState)) return;
    saveAutomaticCheckpoint({
      idPrefix: "autosave-slot",
      label: `Auto · ${versionLabel(state)}`,
      note: `Preserved automatically before loading ${destinationLabel}.`,
    });
  };

  const checkpointBeforeDestructiveEdit = (description: string) => {
    saveAutomaticCheckpoint({
      idPrefix: "auto-checkpoint",
      label: `Auto · ${versionLabel(state)}`,
      note: `Saved automatically before ${description}.`,
    });
  };

  const restoreVersion = (item: VersionHistoryItem) => {
    forkAutosaveBeforeLoading(item.state, item.label);
    saveRecoveryPoint(`Before restoring ${item.label}`);
    setState(item.state);
    setImportReview(item.importReview);
    setDraftSourceVersionId(item.id === "autosave-copy" ? null : item.id);
    flash(`Restored ${item.label}`);
  };

  const deleteVersion = async (id: string) => {
    const deleted = versionHistory.find((item) => item.id === id) ?? null;
    const nextHistory = versionHistory.filter((item) => item.id !== id);
    const deletedLocally = await persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
    setDeletedVersion(deleted);
    if (draftSourceVersionId === id) setDraftSourceVersionId(null);
    flash(
      deletedLocally
        ? "Deleted checkpoint"
        : "Could not remove the checkpoint from browser storage",
    );
  };

  const clearVersionHistory = async () => {
    const clearedLocally = await persistVersionHistory([]);
    setVersionHistory([]);
    setDeletedVersion(null);
    setDraftSourceVersionId(null);
    flash(
      clearedLocally ? "Cleared checkpoints" : "Could not clear checkpoints from browser storage",
    );
  };

  const undoDeleteVersion = async () => {
    if (!deletedVersion) return;
    const nextHistory = [
      deletedVersion,
      ...versionHistory.filter((item) => item.id !== deletedVersion.id),
    ].sort(
      (first, second) => new Date(second.savedAt).getTime() - new Date(first.savedAt).getTime(),
    );
    const restoredLocally = await persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
    setDeletedVersion(null);
    flash(
      restoredLocally ? "Restored deleted checkpoint" : "Checkpoint restored for this session only",
    );
  };

  return {
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
  };
}
