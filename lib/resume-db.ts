import { emptyState, hasAnyContent, normalizeResume, type ResumeState } from "@/lib/resume";
import {
  parseCheckpointHistory,
  parseResumeLibrary,
  parseStoredImportReview,
  parseVersionHistory,
  versionLabel,
  type CheckpointHistoryByResume,
  type ImportReviewState,
  type ResumeLibraryItem,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

export const RESUME_DATABASE_NAME = "privacv-resume-workspace";
const RESUME_DATABASE_VERSION = 1;
const RESUMES_STORE = "resumes";
const CHECKPOINTS_STORE = "checkpoints";
const META_STORE = "meta";
const WORKSPACE_META_KEY = "workspace";

type StoredResume = ResumeLibraryItem & { storageOrder: number };
type StoredCheckpoint = {
  storageId: string;
  resumeId: string;
  storageOrder: number;
  checkpoint: VersionHistoryItem;
};
type WorkspaceMeta = {
  key: typeof WORKSPACE_META_KEY;
  activeResumeId: string | null;
  updatedAt: string;
};

export type ResumeWorkspaceData = {
  resumeLibrary: ResumeLibraryItem[];
  activeResumeId: string | null;
  checkpointHistoryByResume: CheckpointHistoryByResume;
};

export type HydratedResumeWorkspace = ResumeWorkspaceData & {
  activeState: ResumeState;
  activeReview: ImportReviewState | null;
  activeUpdatedAt: string;
};

export type LegacyResumeStorageValues = {
  savedDraft: string | null;
  legacyDraft: string | null;
  importReview: string | null;
  resumeLibrary: string | null;
  activeResumeId: string | null;
  checkpointHistory: string | null;
  legacyVersionHistory: string | null;
  autosaveTime: string | null;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The resume database request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("The resume database transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("The resume database transaction was cancelled."));
  });
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const next = writeQueue.catch(() => undefined).then(operation);
  writeQueue = next;
  return next;
}

export function openResumeDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable in this browser."));

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(RESUME_DATABASE_NAME, RESUME_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RESUMES_STORE)) {
        database.createObjectStore(RESUMES_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(CHECKPOINTS_STORE)) {
        const checkpoints = database.createObjectStore(CHECKPOINTS_STORE, { keyPath: "storageId" });
        checkpoints.createIndex("resumeId", "resumeId", { unique: false });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
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
      reject(request.error ?? new Error("PrivaCV could not open the resume database."));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error("Close other PrivaCV tabs so the resume database can be upgraded."));
    };
  });
  return databasePromise;
}

function checkpointStorageId(resumeId: string, checkpointId: string) {
  return `${resumeId}\u0000${checkpointId}`;
}

function hydratedWorkspace(data: ResumeWorkspaceData, fallbackTime = new Date().toISOString()): HydratedResumeWorkspace {
  const activeItem = data.resumeLibrary.find((item) => item.id === data.activeResumeId) ?? data.resumeLibrary[0];
  return {
    ...data,
    activeResumeId: activeItem?.id ?? null,
    activeState: activeItem?.state ?? emptyState(),
    activeReview: activeItem?.importReview ?? null,
    activeUpdatedAt: activeItem?.updatedAt ?? fallbackTime,
  };
}

export function buildLegacyResumeWorkspace(values: LegacyResumeStorageValues, now = new Date().toISOString()): HydratedResumeWorkspace {
  const saved = values.savedDraft ?? values.legacyDraft;
  const savedState = saved ? normalizeResume(JSON.parse(saved)) : emptyState();
  const savedReview = parseStoredImportReview(values.importReview);
  const storedLibrary = parseResumeLibrary(values.resumeLibrary);
  const storedCheckpoints = parseCheckpointHistory(values.checkpointHistory);
  let library = storedLibrary;
  let activeId = values.activeResumeId;

  if (!library.length) {
    const currentId = `resume-${Date.now().toString(36)}`;
    const legacyVersions = parseVersionHistory(values.legacyVersionHistory);
    library = [
      {
        id: currentId,
        label: versionLabel(savedState),
        createdAt: values.autosaveTime ?? now,
        updatedAt: values.autosaveTime ?? now,
        state: savedState,
        importReview: savedReview,
      },
      ...legacyVersions.map((item, index) => ({
        id: `resume-migrated-${item.id || index}`,
        label: item.label,
        createdAt: item.savedAt,
        updatedAt: item.savedAt,
        state: item.state,
        importReview: item.importReview,
      })),
    ];
    activeId = currentId;
  }

  return hydratedWorkspace({
    resumeLibrary: library,
    activeResumeId: activeId,
    checkpointHistoryByResume: storedCheckpoints,
  }, values.autosaveTime ?? now);
}

export async function loadResumeWorkspace(): Promise<HydratedResumeWorkspace | null> {
  await writeQueue.catch(() => undefined);
  const database = await openResumeDatabase();
  const transaction = database.transaction([RESUMES_STORE, CHECKPOINTS_STORE, META_STORE], "readonly");
  const resumesRequest = transaction.objectStore(RESUMES_STORE).getAll() as IDBRequest<StoredResume[]>;
  const checkpointsRequest = transaction.objectStore(CHECKPOINTS_STORE).getAll() as IDBRequest<StoredCheckpoint[]>;
  const metaRequest = transaction.objectStore(META_STORE).get(WORKSPACE_META_KEY) as IDBRequest<WorkspaceMeta | undefined>;
  const [storedResumes, storedCheckpoints, meta] = await Promise.all([
    requestResult(resumesRequest),
    requestResult(checkpointsRequest),
    requestResult(metaRequest),
    transactionComplete(transaction),
  ]);
  if (!storedResumes.length && !meta) return null;

  const resumeLibrary = storedResumes
    .sort((left, right) => left.storageOrder - right.storageOrder)
    .map(({ storageOrder: _storageOrder, ...item }) => ({ ...item, state: normalizeResume(item.state) }));
  const checkpointHistoryByResume: CheckpointHistoryByResume = {};
  storedCheckpoints
    .sort((left, right) => left.storageOrder - right.storageOrder)
    .forEach(({ resumeId, checkpoint }) => {
      (checkpointHistoryByResume[resumeId] ??= []).push({ ...checkpoint, state: normalizeResume(checkpoint.state) });
    });

  return hydratedWorkspace({
    resumeLibrary,
    activeResumeId: meta?.activeResumeId ?? null,
    checkpointHistoryByResume,
  }, meta?.updatedAt);
}

async function writeWorkspace(data: ResumeWorkspaceData, updatedAt = new Date().toISOString()) {
  const database = await openResumeDatabase();
  const transaction = database.transaction([RESUMES_STORE, CHECKPOINTS_STORE, META_STORE], "readwrite");
  const resumes = transaction.objectStore(RESUMES_STORE);
  const checkpoints = transaction.objectStore(CHECKPOINTS_STORE);
  resumes.clear();
  checkpoints.clear();
  data.resumeLibrary.forEach((item, storageOrder) => resumes.put({ ...item, storageOrder } satisfies StoredResume));
  Object.entries(data.checkpointHistoryByResume).forEach(([resumeId, history]) => {
    history.forEach((checkpoint, storageOrder) => checkpoints.put({
      storageId: checkpointStorageId(resumeId, checkpoint.id),
      resumeId,
      storageOrder,
      checkpoint,
    } satisfies StoredCheckpoint));
  });
  transaction.objectStore(META_STORE).put({
    key: WORKSPACE_META_KEY,
    activeResumeId: data.activeResumeId,
    updatedAt,
  } satisfies WorkspaceMeta);
  await transactionComplete(transaction);
}

export function saveResumeWorkspace(data: ResumeWorkspaceData, updatedAt?: string) {
  return enqueueWrite(() => writeWorkspace(data, updatedAt));
}

export function saveResumeLibrary(resumeLibrary: ResumeLibraryItem[], activeResumeId: string | null, updatedAt = new Date().toISOString()) {
  return enqueueWrite(async () => {
    const database = await openResumeDatabase();
    const transaction = database.transaction([RESUMES_STORE, META_STORE], "readwrite");
    const resumes = transaction.objectStore(RESUMES_STORE);
    resumes.clear();
    resumeLibrary.forEach((item, storageOrder) => resumes.put({ ...item, storageOrder } satisfies StoredResume));
    transaction.objectStore(META_STORE).put({ key: WORKSPACE_META_KEY, activeResumeId, updatedAt } satisfies WorkspaceMeta);
    await transactionComplete(transaction);
  });
}

export function saveCheckpointHistories(checkpointHistoryByResume: CheckpointHistoryByResume) {
  return enqueueWrite(async () => {
    const database = await openResumeDatabase();
    const transaction = database.transaction(CHECKPOINTS_STORE, "readwrite");
    const checkpoints = transaction.objectStore(CHECKPOINTS_STORE);
    checkpoints.clear();
    Object.entries(checkpointHistoryByResume).forEach(([resumeId, history]) => {
      history.forEach((checkpoint, storageOrder) => checkpoints.put({
        storageId: checkpointStorageId(resumeId, checkpoint.id),
        resumeId,
        storageOrder,
        checkpoint,
      } satisfies StoredCheckpoint));
    });
    await transactionComplete(transaction);
  });
}

export function clearResumeWorkspace() {
  return enqueueWrite(async () => {
    const database = await openResumeDatabase();
    const transaction = database.transaction([RESUMES_STORE, CHECKPOINTS_STORE, META_STORE], "readwrite");
    transaction.objectStore(RESUMES_STORE).clear();
    transaction.objectStore(CHECKPOINTS_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    await transactionComplete(transaction);
  });
}

export async function loadOrMigrateResumeWorkspace(legacy: LegacyResumeStorageValues) {
  const stored = await loadResumeWorkspace();
  const hasMeaningfulData = (candidate: HydratedResumeWorkspace) => (
    candidate.resumeLibrary.length > 1
    || candidate.resumeLibrary.some((resume) => hasAnyContent(resume.state) || Boolean(resume.importReview))
    || Object.values(candidate.checkpointHistoryByResume).some((history) => history.length > 0)
  );
  if (stored && hasMeaningfulData(stored)) return { workspace: stored, migrated: false };
  const workspace = buildLegacyResumeWorkspace(legacy);
  if (stored && !hasMeaningfulData(workspace)) return { workspace: stored, migrated: false };
  await saveResumeWorkspace(workspace, workspace.activeUpdatedAt);
  return { workspace, migrated: true };
}
