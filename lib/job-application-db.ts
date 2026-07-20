import {
  JOB_APPLICATION_STATUS_META,
  createApplicationEvent,
  createJobApplicationRecord,
  createJobPipelineId,
  isJobApplicationStatus,
  shouldCaptureResumeSnapshot,
  transitionJobApplication,
  type ApplicationEvent,
  type JobApplication,
  type JobApplicationDraft,
  type JobPipelineData,
  type JobSnapshot,
  type ResumeSnapshot,
  type ResumeSnapshotInput,
} from "@/lib/job-applications";
import { normalizeResume } from "@/lib/resume";

const DATABASE_NAME = "privacv-job-pipeline";
const DATABASE_VERSION = 1;
const APPLICATIONS_STORE = "applications";
const EVENTS_STORE = "events";
const JOB_SNAPSHOTS_STORE = "jobSnapshots";
const RESUME_SNAPSHOTS_STORE = "resumeSnapshots";

export const JOB_PIPELINE_BACKUP_FORMAT = "privacv-job-pipeline-backup";
export const JOB_PIPELINE_BACKUP_VERSION = 1;

export type JobPipelineBackup = JobPipelineData & {
  format: typeof JOB_PIPELINE_BACKUP_FORMAT;
  version: typeof JOB_PIPELINE_BACKUP_VERSION;
  exportedAt: string;
};

export type JobApplicationUpdate = Partial<
  Omit<JobApplication, "id" | "createdAt" | "updatedAt">
> & {
  jobDescription?: string;
  resumeSnapshot?: ResumeSnapshotInput;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("The browser database request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("The browser database transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("The browser database transaction was cancelled."));
  });
}

export function openJobPipelineDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(APPLICATIONS_STORE)) {
        const applications = database.createObjectStore(APPLICATIONS_STORE, { keyPath: "id" });
        applications.createIndex("status", "status", { unique: false });
        applications.createIndex("updatedAt", "updatedAt", { unique: false });
        applications.createIndex("nextActionAt", "nextActionAt", { unique: false });
      }
      if (!database.objectStoreNames.contains(EVENTS_STORE)) {
        const events = database.createObjectStore(EVENTS_STORE, { keyPath: "id" });
        events.createIndex("applicationId", "applicationId", { unique: false });
        events.createIndex("occurredAt", "occurredAt", { unique: false });
      }
      if (!database.objectStoreNames.contains(JOB_SNAPSHOTS_STORE)) {
        database.createObjectStore(JOB_SNAPSHOTS_STORE, { keyPath: "applicationId" });
      }
      if (!database.objectStoreNames.contains(RESUME_SNAPSHOTS_STORE)) {
        const snapshots = database.createObjectStore(RESUME_SNAPSHOTS_STORE, { keyPath: "id" });
        snapshots.createIndex("applicationId", "applicationId", { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("PrivaCV could not open the job pipeline database."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Close other PrivaCV tabs so the job pipeline database can be upgraded."));
    };
  });

  return databasePromise;
}

export async function loadJobPipelineData(): Promise<JobPipelineData> {
  const database = await openJobPipelineDatabase();
  const transaction = database.transaction(
    [APPLICATIONS_STORE, EVENTS_STORE, JOB_SNAPSHOTS_STORE, RESUME_SNAPSHOTS_STORE],
    "readonly",
  );
  const applicationsRequest = transaction.objectStore(APPLICATIONS_STORE).getAll() as IDBRequest<
    JobApplication[]
  >;
  const eventsRequest = transaction.objectStore(EVENTS_STORE).getAll() as IDBRequest<
    ApplicationEvent[]
  >;
  const jobSnapshotsRequest = transaction.objectStore(JOB_SNAPSHOTS_STORE).getAll() as IDBRequest<
    JobSnapshot[]
  >;
  const resumeSnapshotsRequest = transaction
    .objectStore(RESUME_SNAPSHOTS_STORE)
    .getAll() as IDBRequest<ResumeSnapshot[]>;
  const [applications, events, jobSnapshots, resumeSnapshots] = await Promise.all([
    requestResult(applicationsRequest),
    requestResult(eventsRequest),
    requestResult(jobSnapshotsRequest),
    requestResult(resumeSnapshotsRequest),
    transactionComplete(transaction),
  ]);
  return { applications, events, jobSnapshots, resumeSnapshots };
}

export async function createStoredJobApplication(draft: JobApplicationDraft) {
  const database = await openJobPipelineDatabase();
  let application = createJobApplicationRecord(draft);
  const resumeSnapshot =
    draft.resumeSnapshot && shouldCaptureResumeSnapshot(application.status)
      ? createResumeSnapshot(application.id, draft.resumeSnapshot, application.createdAt)
      : null;
  if (resumeSnapshot) application = { ...application, resumeSnapshotId: resumeSnapshot.id };
  const createdEvent = createApplicationEvent(
    application.id,
    "created",
    `Added to ${JOB_APPLICATION_STATUS_META[application.status].label}`,
    { occurredAt: application.createdAt, toStatus: application.status },
  );
  const transaction = database.transaction(
    [APPLICATIONS_STORE, EVENTS_STORE, JOB_SNAPSHOTS_STORE, RESUME_SNAPSHOTS_STORE],
    "readwrite",
  );
  transaction.objectStore(APPLICATIONS_STORE).add(application);
  transaction.objectStore(EVENTS_STORE).add(createdEvent);

  const description = draft.jobDescription?.trim() ?? "";
  if (description || application.sourceUrl) {
    const snapshot: JobSnapshot = {
      applicationId: application.id,
      sourceUrl: application.sourceUrl,
      description,
      capturedAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
    transaction.objectStore(JOB_SNAPSHOTS_STORE).put(snapshot);
  }
  if (resumeSnapshot) {
    transaction.objectStore(RESUME_SNAPSHOTS_STORE).put(resumeSnapshot);
    transaction.objectStore(EVENTS_STORE).add(
      createApplicationEvent(application.id, "resume_attached", "Captured submitted resume", {
        occurredAt: application.createdAt,
        detail: resumeSnapshot.label,
      }),
    );
  }

  await transactionComplete(transaction);
  return application;
}

export async function updateStoredJobApplication(
  applicationId: string,
  update: JobApplicationUpdate,
) {
  const database = await openJobPipelineDatabase();
  const existing = await requestResult(
    database
      .transaction(APPLICATIONS_STORE, "readonly")
      .objectStore(APPLICATIONS_STORE)
      .get(applicationId) as IDBRequest<JobApplication | undefined>,
  );
  if (!existing) throw new Error("This application no longer exists.");

  const now = new Date().toISOString();
  const requestedStatus = isJobApplicationStatus(update.status) ? update.status : existing.status;
  const transitioned = transitionJobApplication(existing, requestedStatus, now);
  const updated: JobApplication = {
    ...transitioned,
    ...update,
    id: existing.id,
    company: update.company?.trim() ?? existing.company,
    role: update.role?.trim() ?? existing.role,
    sourceUrl: update.sourceUrl?.trim() ?? existing.sourceUrl,
    source: update.source?.trim() ?? existing.source,
    location: update.location?.trim() ?? existing.location,
    compensation: update.compensation?.trim() ?? existing.compensation,
    contactName: update.contactName?.trim() ?? existing.contactName,
    contactEmail: update.contactEmail?.trim() ?? existing.contactEmail,
    notes: update.notes?.trim() ?? existing.notes,
    nextAction: update.nextAction?.trim() ?? existing.nextAction,
    nextActionAt: update.nextActionAt?.trim() ?? existing.nextActionAt,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  delete (updated as JobApplication & { jobDescription?: string }).jobDescription;
  delete (updated as JobApplication & { resumeSnapshot?: ResumeSnapshotInput }).resumeSnapshot;

  const resumeSelectionChanged =
    Boolean(update.resumeSnapshot) &&
    (existing.resumeId !== update.resumeSnapshot?.resumeId ||
      existing.resumeCheckpointId !== update.resumeSnapshot?.checkpointId);
  const crossedIntoSubmittedState =
    !shouldCaptureResumeSnapshot(existing.status) && shouldCaptureResumeSnapshot(updated.status);
  const capturedResume =
    update.resumeSnapshot &&
    shouldCaptureResumeSnapshot(updated.status) &&
    (!existing.resumeSnapshotId || resumeSelectionChanged || crossedIntoSubmittedState)
      ? createResumeSnapshot(applicationId, update.resumeSnapshot, now)
      : null;
  if (capturedResume) updated.resumeSnapshotId = capturedResume.id;

  const stores = [APPLICATIONS_STORE, EVENTS_STORE];
  if (typeof update.jobDescription === "string" || update.sourceUrl !== undefined)
    stores.push(JOB_SNAPSHOTS_STORE);
  if (capturedResume) stores.push(RESUME_SNAPSHOTS_STORE);
  const existingSnapshot = stores.includes(JOB_SNAPSHOTS_STORE)
    ? await requestResult(
        database
          .transaction(JOB_SNAPSHOTS_STORE, "readonly")
          .objectStore(JOB_SNAPSHOTS_STORE)
          .get(applicationId) as IDBRequest<JobSnapshot | undefined>,
      )
    : undefined;
  const transaction = database.transaction(stores, "readwrite");
  transaction.objectStore(APPLICATIONS_STORE).put(updated);

  if (updated.status !== existing.status) {
    transaction.objectStore(EVENTS_STORE).add(
      createApplicationEvent(
        applicationId,
        "status_changed",
        `Moved to ${JOB_APPLICATION_STATUS_META[updated.status].label}`,
        {
          occurredAt: now,
          fromStatus: existing.status,
          toStatus: updated.status,
          detail: `${JOB_APPLICATION_STATUS_META[existing.status].label} → ${JOB_APPLICATION_STATUS_META[updated.status].label}`,
        },
      ),
    );
  }

  if (capturedResume) {
    transaction.objectStore(RESUME_SNAPSHOTS_STORE).put(capturedResume);
    transaction.objectStore(EVENTS_STORE).add(
      createApplicationEvent(applicationId, "resume_attached", "Captured submitted resume", {
        occurredAt: now,
        detail: capturedResume.label,
      }),
    );
  }

  if (stores.includes(JOB_SNAPSHOTS_STORE)) {
    const snapshotStore = transaction.objectStore(JOB_SNAPSHOTS_STORE);
    const description = update.jobDescription ?? existingSnapshot?.description ?? "";
    if (description.trim() || updated.sourceUrl) {
      snapshotStore.put({
        applicationId,
        sourceUrl: updated.sourceUrl,
        description: description.trim(),
        capturedAt: existingSnapshot?.capturedAt ?? now,
        updatedAt: now,
      } satisfies JobSnapshot);
    } else if (existingSnapshot) {
      snapshotStore.delete(applicationId);
    }
  }

  await transactionComplete(transaction);
  return updated;
}

export async function deleteStoredJobApplication(applicationId: string) {
  const database = await openJobPipelineDatabase();
  const eventKeys = await requestResult(
    database
      .transaction(EVENTS_STORE, "readonly")
      .objectStore(EVENTS_STORE)
      .index("applicationId")
      .getAllKeys(applicationId),
  );
  const resumeKeys = await requestResult(
    database
      .transaction(RESUME_SNAPSHOTS_STORE, "readonly")
      .objectStore(RESUME_SNAPSHOTS_STORE)
      .index("applicationId")
      .getAllKeys(applicationId),
  );
  const transaction = database.transaction(
    [APPLICATIONS_STORE, EVENTS_STORE, JOB_SNAPSHOTS_STORE, RESUME_SNAPSHOTS_STORE],
    "readwrite",
  );
  transaction.objectStore(APPLICATIONS_STORE).delete(applicationId);
  transaction.objectStore(JOB_SNAPSHOTS_STORE).delete(applicationId);

  const eventStore = transaction.objectStore(EVENTS_STORE);
  eventKeys.forEach((key) => eventStore.delete(key));

  const resumeStore = transaction.objectStore(RESUME_SNAPSHOTS_STORE);
  resumeKeys.forEach((key) => resumeStore.delete(key));
  await transactionComplete(transaction);
}

export async function clearStoredJobPipelineData() {
  const database = await openJobPipelineDatabase();
  const transaction = database.transaction(
    [APPLICATIONS_STORE, EVENTS_STORE, JOB_SNAPSHOTS_STORE, RESUME_SNAPSHOTS_STORE],
    "readwrite",
  );
  transaction.objectStore(APPLICATIONS_STORE).clear();
  transaction.objectStore(EVENTS_STORE).clear();
  transaction.objectStore(JOB_SNAPSHOTS_STORE).clear();
  transaction.objectStore(RESUME_SNAPSHOTS_STORE).clear();
  await transactionComplete(transaction);
}

export function createJobPipelineBackup(data: JobPipelineData): JobPipelineBackup {
  return {
    format: JOB_PIPELINE_BACKUP_FORMAT,
    version: JOB_PIPELINE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...data,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createResumeSnapshot(
  applicationId: string,
  input: ResumeSnapshotInput,
  capturedAt: string,
): ResumeSnapshot {
  return {
    id: createJobPipelineId("resume"),
    applicationId,
    resumeId: input.resumeId,
    ...(input.checkpointId ? { checkpointId: input.checkpointId } : {}),
    label: input.label,
    capturedAt,
    source: input.checkpointId ? "checkpoint" : "current",
    data: normalizeResume(input.data),
  };
}

export function parseJobPipelineBackup(value: string): JobPipelineBackup {
  const parsed: unknown = JSON.parse(value);
  if (
    !isRecord(parsed) ||
    parsed.format !== JOB_PIPELINE_BACKUP_FORMAT ||
    parsed.version !== JOB_PIPELINE_BACKUP_VERSION
  ) {
    throw new Error("This is not a supported PrivaCV job pipeline backup.");
  }
  if (
    !Array.isArray(parsed.applications) ||
    !Array.isArray(parsed.events) ||
    !Array.isArray(parsed.jobSnapshots) ||
    !Array.isArray(parsed.resumeSnapshots)
  ) {
    throw new Error("The job pipeline backup is incomplete.");
  }

  const applications = parsed.applications.flatMap((item): JobApplication[] => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.company !== "string" ||
      typeof item.role !== "string" ||
      !isJobApplicationStatus(item.status) ||
      typeof item.createdAt !== "string" ||
      typeof item.updatedAt !== "string"
    )
      return [];
    const optionalString = (field: string) =>
      typeof item[field] === "string" ? (item[field] as string) : "";
    return [
      {
        id: item.id,
        company: item.company,
        role: item.role,
        status: item.status,
        sourceUrl: optionalString("sourceUrl"),
        source: optionalString("source"),
        location: optionalString("location"),
        compensation: optionalString("compensation"),
        contactName: optionalString("contactName"),
        contactEmail: optionalString("contactEmail"),
        notes: optionalString("notes"),
        nextAction: optionalString("nextAction"),
        nextActionAt: optionalString("nextActionAt"),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        ...(typeof item.appliedAt === "string" ? { appliedAt: item.appliedAt } : {}),
        ...(typeof item.closedAt === "string" ? { closedAt: item.closedAt } : {}),
        ...(typeof item.resumeId === "string" ? { resumeId: item.resumeId } : {}),
        ...(typeof item.resumeCheckpointId === "string"
          ? { resumeCheckpointId: item.resumeCheckpointId }
          : {}),
        ...(typeof item.resumeLabel === "string" ? { resumeLabel: item.resumeLabel } : {}),
        ...(typeof item.resumeSnapshotId === "string"
          ? { resumeSnapshotId: item.resumeSnapshotId }
          : {}),
      },
    ];
  });
  if (applications.length !== parsed.applications.length)
    throw new Error("The backup contains an invalid application record.");

  const events = parsed.events.filter(
    (item): item is ApplicationEvent =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.applicationId === "string" &&
      ["created", "status_changed", "resume_attached", "note"].includes(String(item.type)) &&
      typeof item.title === "string" &&
      typeof item.occurredAt === "string",
  );
  const jobSnapshots = parsed.jobSnapshots.filter(
    (item): item is JobSnapshot =>
      isRecord(item) &&
      typeof item.applicationId === "string" &&
      typeof item.sourceUrl === "string" &&
      typeof item.description === "string" &&
      typeof item.capturedAt === "string" &&
      typeof item.updatedAt === "string",
  );
  const resumeSnapshots = parsed.resumeSnapshots.filter(
    (item): item is ResumeSnapshot =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.applicationId === "string" &&
      typeof item.label === "string" &&
      typeof item.capturedAt === "string" &&
      (item.source === "current" || item.source === "checkpoint") &&
      isRecord(item.data),
  );
  if (
    events.length !== parsed.events.length ||
    jobSnapshots.length !== parsed.jobSnapshots.length ||
    resumeSnapshots.length !== parsed.resumeSnapshots.length
  ) {
    throw new Error("The backup contains an invalid history or snapshot record.");
  }

  return {
    format: JOB_PIPELINE_BACKUP_FORMAT,
    version: JOB_PIPELINE_BACKUP_VERSION,
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    applications,
    events,
    jobSnapshots,
    resumeSnapshots,
  };
}

export async function restoreJobPipelineBackup(backup: JobPipelineBackup) {
  const database = await openJobPipelineDatabase();
  const transaction = database.transaction(
    [APPLICATIONS_STORE, EVENTS_STORE, JOB_SNAPSHOTS_STORE, RESUME_SNAPSHOTS_STORE],
    "readwrite",
  );
  backup.applications.forEach((item) => transaction.objectStore(APPLICATIONS_STORE).put(item));
  backup.events.forEach((item) => transaction.objectStore(EVENTS_STORE).put(item));
  backup.jobSnapshots.forEach((item) => transaction.objectStore(JOB_SNAPSHOTS_STORE).put(item));
  backup.resumeSnapshots.forEach((item) =>
    transaction.objectStore(RESUME_SNAPSHOTS_STORE).put(item),
  );
  await transactionComplete(transaction);
}
