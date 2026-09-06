import { emptyState, hasAnyContent, normalizeResume, type ResumeState } from "@/lib/resume";
import {
  mergeResumeChanges,
  resumeChanges,
  ResumeConflictError,
  type ResumeChange,
} from "@/lib/resume-storage-changes";
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
export const RESUME_COMMIT_KEY = "resume-editor-commit-v1";
const PENDING_PREFIX = "resume-editor-pending-v1:";
const commitSource = crypto.randomUUID();
let journalSequence = 0;
const liveJournals = new Set<string>();
const unprotectedWrites = new Set<string>();

type PendingResumeWrite = {
  changes: ResumeChange[];
  activeResumeId: string | null;
  updatedAt: string;
  sequence: number;
};

function notifyResumeCommit() {
  if (typeof window === "undefined") return;
  const token = `${commitSource}:${crypto.randomUUID()}`;
  try {
    localStorage.setItem(RESUME_COMMIT_KEY, token);
  } catch {
    /* BroadcastChannel also works without localStorage. */
  }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(RESUME_COMMIT_KEY);
    channel.postMessage(token);
    channel.close();
  }
  window.dispatchEvent(new Event(RESUME_COMMIT_KEY));
}

export function subscribeResumeCommits(listener: () => void, includeLocal = true) {
  const storage = (event: StorageEvent) => {
    if (event.key === RESUME_COMMIT_KEY) listener();
  };
  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(RESUME_COMMIT_KEY) : null;
  if (channel)
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (
        !includeLocal &&
        typeof event.data === "string" &&
        event.data.startsWith(`${commitSource}:`)
      )
        return;
      listener();
    };
  window.addEventListener("storage", storage);
  if (includeLocal) window.addEventListener(RESUME_COMMIT_KEY, listener);
  return () => {
    channel?.close();
    window.removeEventListener("storage", storage);
    window.removeEventListener(RESUME_COMMIT_KEY, listener);
  };
}

function warnUnprotectedWrite(event: BeforeUnloadEvent) {
  if (!unprotectedWrites.size) return;
  event.preventDefault();
  event.returnValue = "";
}

export function discardPendingResumeWrites(resumeId: string) {
  for (const key of liveJournals) {
    try {
      const pending = JSON.parse(localStorage.getItem(key) ?? "null") as PendingResumeWrite | null;
      if (pending?.changes.some(({ before, after }) => (after ?? before)?.id === resumeId)) {
        localStorage.removeItem(key);
        liveJournals.delete(key);
      }
    } catch {
      /* Keep unreadable recovery records until an explicit privacy reset. */
    }
  }
}

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
    request.onerror = () =>
      reject(request.error ?? new Error("The resume database request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("The resume database transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("The resume database transaction was cancelled."));
  });
}

function enqueueWrite<T>(operation: () => Promise<T>) {
  const next = writeQueue.catch(() => undefined).then(operation);
  writeQueue = next;
  return next;
}

export function openResumeDatabase() {
  if (databasePromise) return databasePromise;
  if (typeof indexedDB === "undefined")
    return Promise.reject(new Error("IndexedDB is unavailable in this browser."));

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

function hydratedWorkspace(
  data: ResumeWorkspaceData,
  fallbackTime = new Date().toISOString(),
): HydratedResumeWorkspace {
  const activeItem =
    data.resumeLibrary.find((item) => item.id === data.activeResumeId) ?? data.resumeLibrary[0];
  return {
    ...data,
    activeResumeId: activeItem?.id ?? null,
    activeState: activeItem?.state ?? emptyState(),
    activeReview: activeItem?.importReview ?? null,
    activeUpdatedAt: activeItem?.updatedAt ?? fallbackTime,
  };
}

export function buildLegacyResumeWorkspace(
  values: LegacyResumeStorageValues,
  now = new Date().toISOString(),
): HydratedResumeWorkspace {
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

  return hydratedWorkspace(
    {
      resumeLibrary: library,
      activeResumeId: activeId,
      checkpointHistoryByResume: storedCheckpoints,
    },
    values.autosaveTime ?? now,
  );
}

export async function loadResumeWorkspace(): Promise<HydratedResumeWorkspace | null> {
  await writeQueue.catch(() => undefined);
  const database = await openResumeDatabase();
  const transaction = database.transaction(
    [RESUMES_STORE, CHECKPOINTS_STORE, META_STORE],
    "readonly",
  );
  const resumesRequest = transaction.objectStore(RESUMES_STORE).getAll() as IDBRequest<
    StoredResume[]
  >;
  const checkpointsRequest = transaction.objectStore(CHECKPOINTS_STORE).getAll() as IDBRequest<
    StoredCheckpoint[]
  >;
  const metaRequest = transaction.objectStore(META_STORE).get(WORKSPACE_META_KEY) as IDBRequest<
    WorkspaceMeta | undefined
  >;
  const [storedResumes, storedCheckpoints, meta] = await Promise.all([
    requestResult(resumesRequest),
    requestResult(checkpointsRequest),
    requestResult(metaRequest),
    transactionComplete(transaction),
  ]);
  if (!storedResumes.length && !meta) return null;

  const resumeLibrary = storedResumes
    .sort((left, right) => left.storageOrder - right.storageOrder)
    .map(({ storageOrder: _storageOrder, ...item }) => ({
      ...item,
      state: normalizeResume(item.state),
    }));
  const checkpointHistoryByResume: CheckpointHistoryByResume = {};
  storedCheckpoints
    .sort((left, right) => left.storageOrder - right.storageOrder)
    .forEach(({ resumeId, checkpoint }) => {
      (checkpointHistoryByResume[resumeId] ??= []).push({
        ...checkpoint,
        state: normalizeResume(checkpoint.state),
      });
    });

  return hydratedWorkspace(
    {
      resumeLibrary,
      activeResumeId: meta?.activeResumeId ?? null,
      checkpointHistoryByResume,
    },
    meta?.updatedAt,
  );
}

async function writeWorkspace(data: ResumeWorkspaceData, updatedAt = new Date().toISOString()) {
  const database = await openResumeDatabase();
  const transaction = database.transaction(
    [RESUMES_STORE, CHECKPOINTS_STORE, META_STORE],
    "readwrite",
  );
  const resumes = transaction.objectStore(RESUMES_STORE);
  const checkpoints = transaction.objectStore(CHECKPOINTS_STORE);
  resumes.clear();
  checkpoints.clear();
  data.resumeLibrary.forEach((item, storageOrder) =>
    resumes.put({ ...item, storageOrder } satisfies StoredResume),
  );
  Object.entries(data.checkpointHistoryByResume).forEach(([resumeId, history]) => {
    history.forEach((checkpoint, storageOrder) =>
      checkpoints.put({
        storageId: checkpointStorageId(resumeId, checkpoint.id),
        resumeId,
        storageOrder,
        checkpoint,
      } satisfies StoredCheckpoint),
    );
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

export function saveResumeLibrary(
  resumeLibrary: ResumeLibraryItem[],
  activeResumeId: string | null,
  previousLibrary: ResumeLibraryItem[],
  updatedAt = new Date().toISOString(),
) {
  const pending: PendingResumeWrite = {
    changes: resumeChanges(previousLibrary, resumeLibrary),
    activeResumeId,
    updatedAt,
    sequence: journalSequence++,
  };
  const key = `${PENDING_PREFIX}${crypto.randomUUID()}`;
  if (pending.changes.length && typeof window !== "undefined") {
    // Synchronous recovery protects a reload/close before IndexedDB commits.
    try {
      localStorage.setItem(key, JSON.stringify(pending));
      liveJournals.add(key);
    } catch {
      unprotectedWrites.add(key);
      window.addEventListener("beforeunload", warnUnprotectedWrite);
    }
  }
  return enqueueWrite(async () => {
    const result = await writeResumeChanges(pending);
    try {
      localStorage.removeItem(key);
    } catch {
      /* Replay is idempotent. */
    }
    liveJournals.delete(key);
    unprotectedWrites.delete(key);
    notifyResumeCommit();
    return result;
  });
}

async function writeResumeChanges(pending: PendingResumeWrite, recoveryKey?: string) {
  const database = await openResumeDatabase();
  const transaction = database.transaction(
    [RESUMES_STORE, CHECKPOINTS_STORE, META_STORE],
    "readwrite",
  );
  const completion = transactionComplete(transaction);
  const resumes = transaction.objectStore(RESUMES_STORE);
  const stored = await requestResult(resumes.getAll() as IDBRequest<StoredResume[]>);
  const current = stored
    .sort((a, b) => a.storageOrder - b.storageOrder)
    .map(({ storageOrder: _order, ...item }) => ({ ...item, state: normalizeResume(item.state) }));
  let next: ResumeLibraryItem[];
  try {
    next = mergeResumeChanges(current, pending.changes);
  } catch (error) {
    if (!recoveryKey || !(error instanceof ResumeConflictError)) {
      transaction.abort();
      await completion.catch(() => undefined);
      throw error;
    }
    // An interrupted tab must not replace a newer draft. Preserve its work as copies.
    next = [...current];
    for (const { after } of pending.changes) {
      if (
        !after ||
        current.some((item) => item.id === after.id && !resumeChanges([item], [after]).length)
      )
        continue;
      const id = `resume-recovered-${recoveryKey.slice(PENDING_PREFIX.length)}-${after.id}`;
      if (!next.some((item) => item.id === id))
        next.push({ ...after, id, label: `${after.label} — recovered draft` });
    }
  }
  for (const item of current) {
    if (next.some((candidate) => candidate.id === item.id)) continue;
    resumes.delete(item.id);
    const checkpoints = transaction.objectStore(CHECKPOINTS_STORE);
    const keys = await requestResult(checkpoints.index("resumeId").getAllKeys(item.id));
    keys.forEach((checkpointKey) => checkpoints.delete(checkpointKey));
  }
  next.forEach((item, storageOrder) => {
    if (
      JSON.stringify(item) !== JSON.stringify(current.find((candidate) => candidate.id === item.id))
    ) {
      resumes.put({ ...item, storageOrder } satisfies StoredResume);
    }
  });
  const activeResumeId = next.some((item) => item.id === pending.activeResumeId)
    ? pending.activeResumeId
    : (next[0]?.id ?? null);
  transaction.objectStore(META_STORE).put({
    key: WORKSPACE_META_KEY,
    activeResumeId,
    updatedAt: pending.updatedAt,
  } satisfies WorkspaceMeta);
  await completion;
  return next;
}

export function saveCheckpointHistories(
  checkpointHistoryByResume: CheckpointHistoryByResume,
  previous: CheckpointHistoryByResume,
) {
  return enqueueWrite(async () => {
    const database = await openResumeDatabase();
    const transaction = database.transaction([RESUMES_STORE, CHECKPOINTS_STORE], "readwrite");
    const completion = transactionComplete(transaction);
    const checkpoints = transaction.objectStore(CHECKPOINTS_STORE);
    for (const resumeId of new Set([
      ...Object.keys(previous),
      ...Object.keys(checkpointHistoryByResume),
    ])) {
      const before = previous[resumeId] ?? [];
      const after = checkpointHistoryByResume[resumeId] ?? [];
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      const parent = await requestResult(transaction.objectStore(RESUMES_STORE).get(resumeId));
      if (!parent) continue;
      for (const checkpoint of before) {
        if (!after.some((item) => item.id === checkpoint.id))
          checkpoints.delete(checkpointStorageId(resumeId, checkpoint.id));
      }
      after.forEach((checkpoint, storageOrder) => {
        if (!before.some((item) => item.id === checkpoint.id))
          checkpoints.put({
            storageId: checkpointStorageId(resumeId, checkpoint.id),
            resumeId,
            storageOrder,
            checkpoint,
          } satisfies StoredCheckpoint);
      });
    }
    await completion;
    notifyResumeCommit();
  });
}

export function clearResumeWorkspace() {
  if (typeof window !== "undefined") {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith(PENDING_PREFIX)) localStorage.removeItem(key);
    }
    liveJournals.clear();
    unprotectedWrites.clear();
  }
  return enqueueWrite(async () => {
    const database = await openResumeDatabase();
    const transaction = database.transaction(
      [RESUMES_STORE, CHECKPOINTS_STORE, META_STORE],
      "readwrite",
    );
    transaction.objectStore(RESUMES_STORE).clear();
    transaction.objectStore(CHECKPOINTS_STORE).clear();
    transaction.objectStore(META_STORE).clear();
    await transactionComplete(transaction);
    notifyResumeCommit();
  });
}

export async function loadOrMigrateResumeWorkspace(legacy: LegacyResumeStorageValues) {
  // Replay interrupted writes before reading the authoritative workspace. Never
  // replay this module's in-flight writes: its queue already owns them.
  if (typeof window !== "undefined") {
    const pending: Array<{ key: string; write: PendingResumeWrite }> = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PENDING_PREFIX) || liveJournals.has(key)) continue;
      try {
        const write = JSON.parse(localStorage.getItem(key)!) as PendingResumeWrite;
        if (
          !Array.isArray(write.changes) ||
          typeof write.updatedAt !== "string" ||
          !Number.isFinite(write.sequence) ||
          (write.activeResumeId !== null && typeof write.activeResumeId !== "string")
        )
          continue;
        const changes = write.changes.map((change) => {
          const before = change.before
            ? parseResumeLibrary(JSON.stringify([change.before]))[0]
            : undefined;
          const after = change.after
            ? parseResumeLibrary(JSON.stringify([change.after]))[0]
            : undefined;
          if (
            (!before && !after) ||
            (change.before && !before) ||
            (change.after && !after) ||
            (before && after && before.id !== after.id)
          )
            throw new Error("Invalid recovery record");
          return { before, after };
        });
        pending.push({ key, write: { ...write, changes } });
      } catch {
        /* Ignore malformed recovery records. */
      }
    }
    pending.sort(
      (a, b) =>
        a.write.updatedAt.localeCompare(b.write.updatedAt) || a.write.sequence - b.write.sequence,
    );
    for (const { key, write } of pending) {
      await enqueueWrite(() => writeResumeChanges(write, key));
      localStorage.removeItem(key);
    }
  }
  const stored = await loadResumeWorkspace();
  const hasMeaningfulData = (candidate: HydratedResumeWorkspace) =>
    candidate.resumeLibrary.length > 1 ||
    candidate.resumeLibrary.some(
      (resume) => hasAnyContent(resume.state) || Boolean(resume.importReview),
    ) ||
    Object.values(candidate.checkpointHistoryByResume).some((history) => history.length > 0);
  if (stored && hasMeaningfulData(stored)) return { workspace: stored, migrated: false };
  const workspace = buildLegacyResumeWorkspace(legacy);
  if (stored && !hasMeaningfulData(workspace)) return { workspace: stored, migrated: false };
  await saveResumeWorkspace(workspace, workspace.activeUpdatedAt);
  return { workspace, migrated: true };
}
