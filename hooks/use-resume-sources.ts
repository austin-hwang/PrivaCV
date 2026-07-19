"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadResumeWorkspace } from "@/lib/resume-db";
import { CHECKPOINT_HISTORY_KEY, RESUME_LIBRARY_KEY, type ResumeLibraryItem, type VersionHistoryItem } from "@/lib/resume-workspace";
import type { ResumeState } from "@/lib/resume";

export type ResumeSourceOption = {
  key: string;
  resumeId: string;
  checkpointId?: string;
  label: string;
  description: string;
  state: ResumeState;
};

function currentSource(resume: ResumeLibraryItem): ResumeSourceOption {
  return {
    key: `resume:${resume.id}:current`,
    resumeId: resume.id,
    label: `${resume.label} — current draft`,
    description: `Updated ${resume.updatedAt}`,
    state: resume.state,
  };
}

function checkpointSource(resume: ResumeLibraryItem, checkpoint: VersionHistoryItem): ResumeSourceOption {
  return {
    key: `resume:${resume.id}:checkpoint:${checkpoint.id}`,
    resumeId: resume.id,
    checkpointId: checkpoint.id,
    label: `${resume.label} — ${checkpoint.label}`,
    description: `Saved ${checkpoint.savedAt}`,
    state: checkpoint.state,
  };
}

export function useResumeSources() {
  const [sources, setSources] = useState<ResumeSourceOption[]>([]);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const workspace = await loadResumeWorkspace();
      if (!workspace) {
        setSources([]);
        setActiveResumeId(null);
        setError(null);
        return;
      }
      const next = workspace.resumeLibrary.flatMap((resume) => [
        currentSource(resume),
        ...(workspace.checkpointHistoryByResume[resume.id] ?? []).map((checkpoint) => checkpointSource(resume, checkpoint)),
      ]);
      setSources(next);
      setActiveResumeId(workspace.activeResumeId);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved resumes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handleStorage = (event: StorageEvent) => {
      if ([RESUME_LIBRARY_KEY, CHECKPOINT_HISTORY_KEY].includes(event.key ?? "")) void refresh();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [refresh]);

  const defaultSourceKey = useMemo(
    () => sources.find((source) => source.resumeId === activeResumeId && !source.checkpointId)?.key ?? sources[0]?.key ?? "",
    [activeResumeId, sources],
  );
  const byKey = useMemo(() => new Map(sources.map((source) => [source.key, source])), [sources]);

  return { sources, byKey, defaultSourceKey, loading, error, refresh };
}
