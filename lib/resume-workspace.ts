import {
  SECTION_LABELS,
  normalizeResume,
  type ExportChange,
  type ResumeEntry,
  type ResumeState,
} from "@/lib/resume";
import { detectSection } from "@/lib/pdf-import";

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
  sourceExcerpt?: string;
};

export type ImportCoverageItem = {
  id: "header" | "summary" | "experience" | "education" | "projects" | "skills";
  label: string;
  detected: boolean;
  detail: string;
  targetId: string;
  /** Whether the imported source contained a recognizable heading for this area. */
  sourceDetected?: boolean;
};

export type ImportReviewState = {
  fileName: string;
  sections: string[];
  items: ImportReviewItem[];
  reviewedItemIds?: string[];
  sourceText?: string;
  coverage?: ImportCoverageItem[];
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

/**
 * Finds a short, line-preserving piece of the extracted source that supports
 * an imported value. This is a review aid, not a claim that the parser mapped
 * the source perfectly: users still decide whether the field is correct.
 */
export function importSourceExcerpt(sourceText: string | undefined, values: string[]) {
  if (!sourceText?.trim()) return undefined;

  const lines = sourceText.split("\n").map((line) => line.trim());
  const candidates = values
    .flatMap((value) => value.split("\n"))
    .map((value) => value.replace(/^[•*-]\s*/, "").replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 4);
  const matches = candidates
    .map((candidate) => {
      const normalizedCandidate = candidate.toLocaleLowerCase();
      const indexes = lines.flatMap((line, index) => {
        const normalizedLine = line.toLocaleLowerCase();
        return normalizedLine && (normalizedLine.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedLine))
          ? [index]
          : [];
      });
      return { candidate, indexes };
    })
    .filter((match) => match.indexes.length)
    .sort((first, second) => first.indexes.length - second.indexes.length || second.candidate.length - first.candidate.length);
  const matchingLineIndex = matches[0]?.indexes[0];
  if (matchingLineIndex === undefined) return undefined;
  const excerpt = lines
    .slice(Math.max(0, matchingLineIndex - 1), Math.min(lines.length, matchingLineIndex + 3))
    .filter(Boolean)
    .join("\n");
  return excerpt || undefined;
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

export function entryTargetId(section: string, entry: ResumeEntry, index: number) {
  const field = entry.title ? "title" : entry.subtitle ? "subtitle" : entry.meta ? "meta" : "details";
  return `field-${section}-${index}-${field}`;
}

function populatedEntryCount(entries: ResumeEntry[]) {
  return entries.filter(entryHasContent).length;
}

function entryCoverage(
  section: Exclude<(typeof REPEATABLE_SECTIONS)[number], "skills">,
  state: ResumeState,
  sourceSections: Set<Exclude<ReturnType<typeof detectSection>, null>>,
): ImportCoverageItem {
  const count = populatedEntryCount(state[section]);
  const label = SECTION_LABELS[section];
  const firstEntry = state[section].find(entryHasContent);
  const firstEntryIndex = firstEntry ? state[section].indexOf(firstEntry) : -1;

  return {
    id: section,
    label,
    detected: count > 0,
    detail: count
      ? `${count} ${count === 1 ? "entry" : "entries"} detected`
      : sourceSections.has(section)
        ? `${label} heading found in source, but no entries detected`
        : `No ${label.toLocaleLowerCase()} entries detected`,
    targetId: firstEntry && firstEntryIndex >= 0
      ? entryTargetId(section, firstEntry, firstEntryIndex)
      : `add-${section}-entry`,
    sourceDetected: sourceSections.has(section),
  };
}

/**
 * Gives import review a truthful coverage snapshot. When source text is
 * available, a recognizable heading is kept separate from the parser's draft
 * output so a skipped section is explicit rather than mistaken for an omitted
 * one. This remains a review aid, not a claim that every source section should
 * appear in the resume.
 */
export function buildImportCoverage(state: ResumeState, sourceText?: string): ImportCoverageItem[] {
  const contactCount = [state.email, state.phone, state.location, state.website].filter((value) => value.trim()).length;
  const skillLineCount = state.skills.split("\n").filter((line) => line.trim()).length;
  const sourceSections = new Set(
    (sourceText ?? "")
      .split(/\r?\n/)
      .map((line) => detectSection(line))
      .filter((section): section is Exclude<ReturnType<typeof detectSection>, null> => Boolean(section)),
  );

  return [
    {
      id: "header",
      label: "Header",
      detected: Boolean(state.name.trim() || contactCount),
      detail: state.name.trim()
        ? `Name and ${contactCount} ${contactCount === 1 ? "contact detail" : "contact details"} detected`
        : contactCount
          ? `${contactCount} ${contactCount === 1 ? "contact detail" : "contact details"} detected; no name detected`
          : "No name or contact details detected",
      targetId: state.name.trim() ? "field-name" : "field-email",
    },
    {
      id: "summary",
      label: "Summary",
      detected: Boolean(state.summary.trim()),
      detail: state.summary.trim()
        ? "Summary text detected"
        : sourceSections.has("summary")
          ? "Summary heading found in source, but no text detected"
          : "No summary detected",
      targetId: "field-summary",
      sourceDetected: sourceSections.has("summary"),
    },
    entryCoverage("experience", state, sourceSections),
    entryCoverage("education", state, sourceSections),
    entryCoverage("projects", state, sourceSections),
    {
      id: "skills",
      label: "Skills",
      detected: skillLineCount > 0,
      detail: skillLineCount
        ? `${skillLineCount} ${skillLineCount === 1 ? "skill line" : "skill lines"} detected`
        : sourceSections.has("skills")
          ? "Skills heading found in source, but no text detected"
          : "No skills detected",
      targetId: "field-skills",
      sourceDetected: sourceSections.has("skills"),
    },
  ];
}

export function buildImportReview(state: ResumeState, fileName: string, sourceText?: string): ImportReviewState {
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
      sourceExcerpt:
        importSourceExcerpt(sourceText, state.name ? [state.name] : [state.email, state.phone, state.location, state.website]) ??
        importSourceExcerpt(sourceText, [state.name, state.email, state.phone, state.location, state.website]),
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
        sourceExcerpt: importSourceExcerpt(sourceText, [state.summary]),
      },
      "Summary",
    );
  }

  REPEATABLE_SECTIONS.forEach((section) => {
    state[section].forEach((entry, index) => {
      if (!entryHasContent(entry)) return;
      addItem(
        {
          id: `${section}-${index}`,
          label: `${SECTION_LABELS[section]} entry ${index + 1}`,
          targetId: entryTargetId(section, entry, index),
          detail: compactDetail([entry.title, entry.subtitle, entry.meta, entry.details.split("\n")[0]].filter(Boolean).join(" | ")),
          sourceExcerpt: importSourceExcerpt(sourceText, [entry.title, entry.subtitle, entry.meta, entry.details]),
        },
        SECTION_LABELS[section],
      );
    });
  });

  // Specialty content is often the most consequential part of an imported
  // resume (for example, a certification or publication). Keep it in the same
  // explicit review flow as standard sections so "finish review" never skips
  // data the importer placed in a custom section.
  state.customSections.forEach((custom) => {
    custom.entries.forEach((entry, index) => {
      if (!entryHasContent(entry)) return;
      addItem(
        {
          id: `${custom.id}-${index}`,
          label: `${custom.title || "Custom section"} entry ${index + 1}`,
          targetId: entryTargetId(custom.id, entry, index),
          detail: compactDetail([entry.title, entry.subtitle, entry.meta, entry.details.split("\n")[0]].filter(Boolean).join(" | ")),
          sourceExcerpt: importSourceExcerpt(sourceText, [entry.title, entry.subtitle, entry.meta, entry.details]),
        },
        custom.title || "Custom section",
      );
    });
  });

  if (state.skills) {
    addItem(
      {
        id: "skills",
        label: "Skills",
        targetId: "field-skills",
        detail: compactDetail(state.skills.split("\n")[0] ?? state.skills),
        sourceExcerpt: importSourceExcerpt(sourceText, [state.skills]),
      },
      "Skills",
    );
  }

  return {
    fileName,
    sections: [...sections],
    items,
    reviewedItemIds: [],
    sourceText: sourceText?.trim() || undefined,
    coverage: buildImportCoverage(state, sourceText),
  };
}

/**
 * Returns the user's explicit confirmation progress for an imported resume.
 * Unknown ids are ignored so old local checkpoints and changed review rules
 * remain safe to restore.
 */
export function importReviewProgress(importReview: ImportReviewState) {
  const reviewedIds = new Set(importReview.reviewedItemIds ?? []);
  const reviewedCount = importReview.items.filter((item) => reviewedIds.has(item.id)).length;

  return {
    reviewedCount,
    remainingCount: importReview.items.length - reviewedCount,
    isComplete: reviewedCount === importReview.items.length,
  };
}
