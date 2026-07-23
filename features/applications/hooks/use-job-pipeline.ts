"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearStoredJobPipelineData,
  createJobPipelineBackup,
  createStoredApplicationEvent,
  createStoredJobApplication,
  deleteStoredApplicationEvent,
  deleteStoredJobApplication,
  loadJobPipelineData,
  restoreJobPipelineBackup,
  updateStoredApplicationEvent,
  updateStoredJobApplication,
  type ApplicationActivityInput,
  type ApplicationActivityUpdate,
  type JobApplicationUpdate,
  type JobPipelineBackup,
} from "@/lib/job-application-db";
import { trackJobApplicationCreated } from "@/lib/job-application-metrics";
import type {
  ApplicationEvent,
  JobApplicationDraft,
  JobApplicationStatus,
  JobPipelineData,
} from "@/lib/job-applications";
import { createSampleJobPipeline } from "@/lib/job-application-sample";

const EMPTY_PIPELINE: JobPipelineData = {
  applications: [],
  events: [],
  jobSnapshots: [],
  resumeSnapshots: [],
};

const JOB_PIPELINE_CHANNEL = "privacv-job-pipeline-changes";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The job pipeline could not be saved.";
}

export function useJobPipeline() {
  const [data, setData] = useState<JobPipelineData>(EMPTY_PIPELINE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const next = await loadJobPipelineData();
      setData(next);
      setStorageError(null);
    } catch (error) {
      setStorageError(errorMessage(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(JOB_PIPELINE_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = () => void refresh();
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [refresh]);

  const finishMutation = useCallback(async () => {
    await refresh();
    channelRef.current?.postMessage({ type: "changed" });
  }, [refresh]);

  const mutate = useCallback(
    async <T>(operation: () => Promise<T>) => {
      setSaving(true);
      setStorageError(null);
      try {
        const result = await operation();
        await finishMutation();
        return result;
      } catch (error) {
        setStorageError(errorMessage(error));
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [finishMutation],
  );

  const createApplication = useCallback(
    (draft: JobApplicationDraft) =>
      mutate(async () => {
        const application = await createStoredJobApplication(draft);
        trackJobApplicationCreated();
        return application;
      }),
    [mutate],
  );

  const updateApplication = useCallback(
    (applicationId: string, update: JobApplicationUpdate) =>
      mutate(() => updateStoredJobApplication(applicationId, update)),
    [mutate],
  );

  const moveApplication = useCallback(
    (applicationId: string, status: JobApplicationStatus) =>
      updateApplication(applicationId, { status }),
    [updateApplication],
  );

  const deleteApplication = useCallback(
    (applicationId: string) => mutate(() => deleteStoredJobApplication(applicationId)),
    [mutate],
  );

  const logActivity = useCallback(
    (applicationId: string, input: ApplicationActivityInput) =>
      mutate(() => createStoredApplicationEvent(applicationId, input)),
    [mutate],
  );

  const updateActivity = useCallback(
    (eventId: string, update: ApplicationActivityUpdate) =>
      mutate(() => updateStoredApplicationEvent(eventId, update)),
    [mutate],
  );

  const deleteActivity = useCallback(
    (eventId: string) => mutate(() => deleteStoredApplicationEvent(eventId)),
    [mutate],
  );

  const restoreBackup = useCallback(
    (backup: JobPipelineBackup) => mutate(() => restoreJobPipelineBackup(backup)),
    [mutate],
  );

  const loadSample = useCallback(
    () =>
      mutate(() => restoreJobPipelineBackup(createJobPipelineBackup(createSampleJobPipeline()))),
    [mutate],
  );

  const clearPipeline = useCallback(() => mutate(clearStoredJobPipelineData), [mutate]);

  const jobSnapshotsByApplication = useMemo(
    () => new Map(data.jobSnapshots.map((snapshot) => [snapshot.applicationId, snapshot])),
    [data.jobSnapshots],
  );

  const eventsByApplication = useMemo(() => {
    const byApplication = new Map<string, ApplicationEvent[]>();
    data.events.forEach((event) => {
      const events = byApplication.get(event.applicationId) ?? [];
      events.push(event);
      byApplication.set(event.applicationId, events);
    });
    byApplication.forEach((events) =>
      events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    );
    return byApplication;
  }, [data.events]);

  return {
    data,
    loading,
    saving,
    storageError,
    jobSnapshotsByApplication,
    eventsByApplication,
    createApplication,
    updateApplication,
    moveApplication,
    deleteApplication,
    logActivity,
    updateActivity,
    deleteActivity,
    clearPipeline,
    restoreBackup,
    loadSample,
    refresh,
  };
}
