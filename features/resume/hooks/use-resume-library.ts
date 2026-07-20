"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { saveCheckpointHistories, saveResumeLibrary } from "@/lib/resume-db";
import { emptyState, normalizeResume, type ResumeState } from "@/lib/resume";
import {
  ACTIVE_RESUME_KEY,
  CHECKPOINT_HISTORY_KEY,
  RESUME_LIBRARY_KEY,
  type ImportReviewState,
  type ResumeLibraryItem,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

type Options = {
  state: ResumeState;
  setState: Dispatch<SetStateAction<ResumeState>>;
  importReview: ImportReviewState | null;
  setImportReview: Dispatch<SetStateAction<ImportReviewState | null>>;
  resumeLibrary: ResumeLibraryItem[];
  setResumeLibrary: Dispatch<SetStateAction<ResumeLibraryItem[]>>;
  activeResumeId: string | null;
  setActiveResumeId: Dispatch<SetStateAction<string | null>>;
  checkpointHistoryByResume: Record<string, VersionHistoryItem[]>;
  setCheckpointHistoryByResume: Dispatch<SetStateAction<Record<string, VersionHistoryItem[]>>>;
  setVersionHistory: Dispatch<SetStateAction<VersionHistoryItem[]>>;
  setAutosavedState: Dispatch<SetStateAction<ResumeState | null>>;
  setAutosavedAt: Dispatch<SetStateAction<string | null>>;
  setExternalDraft: Dispatch<SetStateAction<ResumeState | null>>;
  setDraftSourceVersionId: Dispatch<SetStateAction<string | null>>;
  forkAutosaveBeforeLoading: (nextState: ResumeState, destinationLabel: string) => void;
  mirrorLegacyActiveHistory: (history: VersionHistoryItem[]) => void;
  confirmStorageAvailable: () => void;
  reportStorageIssue: () => void;
  flash: (message: string) => unknown;
};

export function useResumeLibrary({
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
}: Options) {
  const persistResumeLibrary = useCallback(
    (library: ResumeLibraryItem[], nextActiveId = activeResumeId) => {
      try {
        localStorage.setItem(RESUME_LIBRARY_KEY, JSON.stringify(library));
        if (nextActiveId) localStorage.setItem(ACTIVE_RESUME_KEY, nextActiveId);
      } catch {
        // IndexedDB remains authoritative when the compatibility mirror fails.
      }
      void saveResumeLibrary(library, nextActiveId)
        .then(confirmStorageAvailable)
        .catch(reportStorageIssue);
    },
    [activeResumeId, confirmStorageAvailable, reportStorageIssue],
  );

  const libraryWithCurrentDraft = useCallback(
    (library = resumeLibrary) => {
      if (!activeResumeId) return library;
      const updatedAt = new Date().toISOString();
      return library.map((item) =>
        item.id === activeResumeId
          ? { ...item, updatedAt, state: normalizeResume(state), importReview }
          : item,
      );
    },
    [activeResumeId, importReview, resumeLibrary, state],
  );

  const openResume = (resumeId: string) => {
    if (resumeId === activeResumeId) return;
    const nextItem = resumeLibrary.find((item) => item.id === resumeId);
    if (!nextItem) return;
    forkAutosaveBeforeLoading(nextItem.state, nextItem.label);
    const library = libraryWithCurrentDraft();
    persistResumeLibrary(library, resumeId);
    setResumeLibrary(library);
    setActiveResumeId(resumeId);
    setState(nextItem.state);
    setImportReview(nextItem.importReview);
    const nextHistory = checkpointHistoryByResume[resumeId] ?? [];
    setVersionHistory(nextHistory);
    try {
      mirrorLegacyActiveHistory(nextHistory);
    } catch {
      reportStorageIssue();
    }
    setAutosavedState(nextItem.state);
    setAutosavedAt(nextItem.updatedAt);
    setExternalDraft(null);
    setDraftSourceVersionId(null);
    flash(`Opened ${nextItem.label}`);
  };

  const createResume = () => {
    const now = new Date().toISOString();
    const id = `resume-${Date.now().toString(36)}`;
    const nextState = emptyState();
    const nextItem: ResumeLibraryItem = {
      id,
      label: "Untitled resume",
      createdAt: now,
      updatedAt: now,
      state: nextState,
      importReview: null,
    };
    forkAutosaveBeforeLoading(nextState, "a new resume");
    const library = [...libraryWithCurrentDraft(), nextItem];
    persistResumeLibrary(library, id);
    setResumeLibrary(library);
    setActiveResumeId(id);
    setState(nextState);
    setImportReview(null);
    setVersionHistory([]);
    try {
      mirrorLegacyActiveHistory([]);
    } catch {
      reportStorageIssue();
    }
    setAutosavedState(nextState);
    setAutosavedAt(now);
    setExternalDraft(null);
    setDraftSourceVersionId(null);
    flash("Created a new resume");
  };

  const duplicateResume = (resumeId = activeResumeId) => {
    if (!resumeId) return;
    const source =
      resumeId === activeResumeId
        ? libraryWithCurrentDraft().find((item) => item.id === resumeId)
        : resumeLibrary.find((item) => item.id === resumeId);
    if (!source) return;
    const now = new Date().toISOString();
    const id = `resume-${Date.now().toString(36)}`;
    const copy: ResumeLibraryItem = {
      ...source,
      id,
      label: `${source.label} copy`,
      createdAt: now,
      updatedAt: now,
      state: normalizeResume(source.state),
    };
    forkAutosaveBeforeLoading(copy.state, copy.label);
    const library = [...libraryWithCurrentDraft(), copy];
    persistResumeLibrary(library, id);
    setResumeLibrary(library);
    setActiveResumeId(id);
    setState(copy.state);
    setImportReview(copy.importReview);
    setVersionHistory([]);
    try {
      mirrorLegacyActiveHistory([]);
    } catch {
      reportStorageIssue();
    }
    setAutosavedState(copy.state);
    setAutosavedAt(now);
    setExternalDraft(null);
    setDraftSourceVersionId(null);
    flash(`Duplicated ${source.label}`);
  };

  const renameResume = (resumeId: string, label: string) => {
    const clean = label.trim();
    if (!clean) return;
    const library = resumeLibrary.map((item) =>
      item.id === resumeId ? { ...item, label: clean } : item,
    );
    persistResumeLibrary(library);
    setResumeLibrary(library);
    flash("Renamed resume");
  };

  const deleteResume = (resumeId: string) => {
    const remaining = resumeLibrary.filter((item) => item.id !== resumeId);
    const now = new Date().toISOString();
    const nextLibrary = remaining.length
      ? remaining
      : [
          {
            id: `resume-${Date.now().toString(36)}`,
            label: "Untitled resume",
            createdAt: now,
            updatedAt: now,
            state: emptyState(),
            importReview: null,
          } satisfies ResumeLibraryItem,
        ];
    const deletingActive = resumeId === activeResumeId;
    const nextActive = deletingActive
      ? nextLibrary[0]
      : (nextLibrary.find((item) => item.id === activeResumeId) ?? nextLibrary[0]);
    persistResumeLibrary(nextLibrary, nextActive.id);
    setResumeLibrary(nextLibrary);
    setCheckpointHistoryByResume((current) => {
      const next = { ...current };
      delete next[resumeId];
      try {
        if (Object.keys(next).length)
          localStorage.setItem(CHECKPOINT_HISTORY_KEY, JSON.stringify(next));
        else localStorage.removeItem(CHECKPOINT_HISTORY_KEY);
      } catch {
        // IndexedDB remains authoritative when the compatibility mirror fails.
      }
      void saveCheckpointHistories(next).then(confirmStorageAvailable).catch(reportStorageIssue);
      return next;
    });
    if (deletingActive) {
      const nextHistory = checkpointHistoryByResume[nextActive.id] ?? [];
      setActiveResumeId(nextActive.id);
      setState(nextActive.state);
      setImportReview(nextActive.importReview);
      setVersionHistory(nextHistory);
      try {
        mirrorLegacyActiveHistory(nextHistory);
      } catch {
        reportStorageIssue();
      }
      setAutosavedState(nextActive.state);
      setAutosavedAt(nextActive.updatedAt);
    }
    flash("Deleted resume");
  };

  return {
    createResume,
    deleteResume,
    duplicateResume,
    renameResume,
    switchResume: openResume,
  };
}
