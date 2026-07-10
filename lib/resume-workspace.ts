import {
  SECTION_LABELS,
  normalizeResume,
  type ExportChange,
  type ResumeEntry,
  type ResumeState,
} from "@/lib/resume";

export const STORAGE_KEY = "resume-editor-data-v2";
export const EXPORT_CHECKPOINT_KEY = "resume-editor-last-export-v1";
export const VERSION_HISTORY_KEY = "resume-editor-version-history-v1";
export const ROLE_FOCUS_KEY = "resume-editor-role-focus-v1";
export const ROLE_FOCUS_LABEL_KEY = "resume-editor-role-focus-label-v1";
export const VERSION_HISTORY_BACKUP_FORMAT = "resume-editor-version-history-backup";
export const VERSION_HISTORY_BACKUP_VERSION = 1;
export const MAX_VERSION_HISTORY = 5;
export const CHANGE_PREVIEW_LIMIT = 4;
export const REPEATABLE_SECTIONS = ["experience", "education", "projects"] as const;

export const ENTRY_SCHEMA: Record<
  (typeof REPEATABLE_SECTIONS)[number],
  { title: string; subtitle: string; meta: string; details: string }
> = {
  experience: {
    title: "Job Title",
    subtitle: "Company",
    meta: "Dates (e.g. Jan 2020 - Present)",
    details: "Responsibilities / achievements (one bullet per line)",
  },
  education: {
    title: "Degree",
    subtitle: "School",
    meta: "Dates / Location",
    details: "Details (one bullet per line, optional)",
  },
  projects: {
    title: "Project Name",
    subtitle: "Technologies / Role",
    meta: "Dates / Link",
    details: "Description (one bullet per line)",
  },
};

export type ToastState = {
  id: number;
  message: string;
};

export type ImportReviewItem = {
  id: string;
  label: string;
  targetId: string;
  detail: string;
};

export type ImportReviewState = {
  fileName: string;
  sections: string[];
  items: ImportReviewItem[];
};

export type RecoveryPoint = {
  label: string;
  state: ResumeState;
  importReview: ImportReviewState | null;
  jobDescription: string;
  roleLabel: string;
};

export type VersionHistoryItem = {
  id: string;
  savedAt: string;
  label: string;
  note?: string;
  derivedFromId?: string;
  derivedFromLabel?: string;
  fingerprint: string;
  state: ResumeState;
  importReview: ImportReviewState | null;
  jobDescription?: string;
  roleLabel?: string;
};

export type VersionHistoryBackup = {
  format: typeof VERSION_HISTORY_BACKUP_FORMAT;
  version: typeof VERSION_HISTORY_BACKUP_VERSION;
  exportedAt: string;
  checkpoints: VersionHistoryItem[];
};

export type VersionHistoryMerge = {
  checkpoints: VersionHistoryItem[];
  overflow: VersionHistoryItem[];
  incomingUnique: VersionHistoryItem[];
  matchingCheckpoints: VersionHistoryItem[];
};

export type VersionCompareTarget = {
  baseId: string;
  targetId: "current" | string;
};

export type RestoredVersionSummary = {
  id: string;
  label: string;
  savedAt: string;
  fingerprint: string;
  changes: ExportChange[];
};

export type ExportCheckpoint = {
  fingerprint: string;
  exportedAt: string;
  pageCount: number;
  issueCount: number;
  snapshot?: ResumeState;
};

export function compactDetail(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return "No text detected";
  return cleaned.length > 92 ? `${cleaned.slice(0, 89)}...` : cleaned;
}

export function roleFocusFingerprint(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function roleContextFingerprint(jobDescription: string | undefined, roleLabel: string | undefined) {
  return `${roleFocusFingerprint(roleLabel)}\u0000${roleFocusFingerprint(jobDescription)}`;
}

export function versionHistoryFingerprint(item: Pick<VersionHistoryItem, "fingerprint" | "jobDescription" | "roleLabel">) {
  return `${item.fingerprint}\u0000${roleContextFingerprint(item.jobDescription, item.roleLabel)}`;
}

export function parseExportCheckpoint(value: string | null): ExportCheckpoint | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ExportCheckpoint>;
    if (
      typeof parsed.fingerprint === "string" &&
      typeof parsed.exportedAt === "string" &&
      typeof parsed.pageCount === "number" &&
      typeof parsed.issueCount === "number"
    ) {
      return {
        fingerprint: parsed.fingerprint,
        exportedAt: parsed.exportedAt,
        pageCount: parsed.pageCount,
        issueCount: parsed.issueCount,
        snapshot: parsed.snapshot ? normalizeResume(parsed.snapshot) : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function parseVersionHistory(value: string | null, limit = MAX_VERSION_HISTORY): VersionHistoryItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): VersionHistoryItem | null => {
        if (
          !item ||
          typeof item.id !== "string" ||
          typeof item.savedAt !== "string" ||
          typeof item.label !== "string" ||
          typeof item.fingerprint !== "string"
        ) {
          return null;
        }
        return {
          id: item.id,
          savedAt: item.savedAt,
          label: item.label,
          note: typeof item.note === "string" ? item.note : undefined,
          derivedFromId: typeof item.derivedFromId === "string" ? item.derivedFromId : undefined,
          derivedFromLabel: typeof item.derivedFromLabel === "string" ? item.derivedFromLabel : undefined,
          fingerprint: item.fingerprint,
          state: normalizeResume(item.state),
          importReview: item.importReview ?? null,
          jobDescription: typeof item.jobDescription === "string" ? item.jobDescription : undefined,
          roleLabel: typeof item.roleLabel === "string" ? item.roleLabel : undefined,
        };
      })
      .filter((item): item is VersionHistoryItem => Boolean(item))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export function parseVersionHistoryBackup(value: unknown): VersionHistoryItem[] | null {
  if (!value || typeof value !== "object") return null;
  const backup = value as Partial<VersionHistoryBackup>;
  if (
    backup.format !== VERSION_HISTORY_BACKUP_FORMAT ||
    backup.version !== VERSION_HISTORY_BACKUP_VERSION ||
    !Array.isArray(backup.checkpoints)
  ) {
    return null;
  }

  return parseVersionHistory(JSON.stringify(backup.checkpoints), Number.POSITIVE_INFINITY);
}

export function mergeVersionHistory(existing: VersionHistoryItem[], incoming: VersionHistoryItem[]): VersionHistoryMerge {
  const existingFingerprints = new Set(existing.map(versionHistoryFingerprint));
  const seenIncomingFingerprints = new Set<string>();
  const matchingCheckpoints = incoming.filter((item) => existingFingerprints.has(versionHistoryFingerprint(item)));
  const incomingUnique = incoming.filter((item) => {
    const fingerprint = versionHistoryFingerprint(item);
    if (existingFingerprints.has(fingerprint) || seenIncomingFingerprints.has(fingerprint)) return false;
    seenIncomingFingerprints.add(fingerprint);
    return true;
  });
  const seenFingerprints = new Set<string>();
  const usedIds = new Set<string>();

  const uniqueHistory = [...existing, ...incomingUnique]
    .sort((first, second) => new Date(second.savedAt).getTime() - new Date(first.savedAt).getTime())
    .filter((item) => {
      const fingerprint = versionHistoryFingerprint(item);
      if (seenFingerprints.has(fingerprint)) return false;
      seenFingerprints.add(fingerprint);
      return true;
    })
    .map((item) => {
      let id = item.id;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${item.id}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      return id === item.id ? item : { ...item, id };
    });

  return {
    checkpoints: uniqueHistory.slice(0, MAX_VERSION_HISTORY),
    overflow: uniqueHistory.slice(MAX_VERSION_HISTORY),
    incomingUnique,
    matchingCheckpoints,
  };
}

export function formatCheckpointTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function versionLabel(state: ResumeState) {
  return state.name.trim() || state.title.trim() || "Untitled resume";
}

export function versionHeadline(state: ResumeState) {
  return [state.name.trim() || "Unnamed resume", state.title.trim()].filter(Boolean).join(" - ");
}

export function entryHasContent(entry: ResumeEntry) {
  return Boolean(entry.title || entry.subtitle || entry.meta || entry.details);
}

export function versionContentBadges(state: ResumeState) {
  const experienceCount = state.experience.filter(entryHasContent).length;
  const educationCount = state.education.filter(entryHasContent).length;
  const projectCount = state.projects.filter(entryHasContent).length;
  const skillCount = state.skills.split("\n").filter((line) => line.trim()).length;
  const badges: string[] = [];

  if (experienceCount) badges.push(`${experienceCount} ${experienceCount === 1 ? "role" : "roles"}`);
  if (educationCount) badges.push(`${educationCount} education`);
  if (projectCount) badges.push(`${projectCount} ${projectCount === 1 ? "project" : "projects"}`);
  if (skillCount) badges.push(`${skillCount} ${skillCount === 1 ? "skill line" : "skill lines"}`);

  return badges.length ? badges : ["Empty draft"];
}

export function versionReplacementCandidate(versions: VersionHistoryItem[], fingerprint: string) {
  if (versions.some((item) => versionHistoryFingerprint(item) === fingerprint)) return null;
  if (versions.length < MAX_VERSION_HISTORY) return null;
  return versions[versions.length - 1] ?? null;
}

export function entryTargetId(section: (typeof REPEATABLE_SECTIONS)[number], entry: ResumeEntry, index: number) {
  const field = entry.title ? "title" : entry.subtitle ? "subtitle" : entry.meta ? "meta" : "details";
  return `field-${section}-${index}-${field}`;
}

export function buildImportReview(state: ResumeState, fileName: string): ImportReviewState {
  const items: ImportReviewItem[] = [];
  const sections = new Set<string>();
  const addItem = (item: ImportReviewItem, section: string) => {
    items.push(item);
    sections.add(section);
  };

  addItem(
    {
      id: "contact",
      label: "Contact details",
      targetId: state.name ? "field-name" : "field-email",
      detail: compactDetail([state.name, state.email, state.phone, state.location, state.website].filter(Boolean).join(" | ")),
    },
    "Header",
  );

  if (state.summary) {
    addItem(
      {
        id: "summary",
        label: "Summary",
        targetId: "field-summary",
        detail: compactDetail(state.summary),
      },
      "Summary",
    );
  }

  REPEATABLE_SECTIONS.forEach((section) => {
    const index = state[section].findIndex(entryHasContent);
    if (index < 0) return;
    const entry = state[section][index];
    addItem(
      {
        id: section,
        label: `First ${SECTION_LABELS[section].toLowerCase()} entry`,
        targetId: entryTargetId(section, entry, index),
        detail: compactDetail([entry.title, entry.subtitle, entry.meta, entry.details.split("\n")[0]].filter(Boolean).join(" | ")),
      },
      SECTION_LABELS[section],
    );
  });

  if (state.skills) {
    addItem(
      {
        id: "skills",
        label: "Skills",
        targetId: "field-skills",
        detail: compactDetail(state.skills.split("\n")[0] ?? state.skills),
      },
      "Skills",
    );
  }

  return {
    fileName,
    sections: [...sections],
    items,
  };
}
