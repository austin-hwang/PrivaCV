import {
  SECTION_LABELS,
  normalizeResume,
  resumeExportFingerprint,
  type ExportChange,
  type ResumeEntry,
  type ResumeState,
} from "@/lib/resume";
import { detectSection, detectSpecialtySection } from "@/lib/pdf-import";

export const STORAGE_KEY = "resume-editor-data-v2";
/**
 * The import-review checklist is stored separately from the editable resume.
 * Keeping it independent preserves compatibility with existing local drafts,
 * while allowing a required import review to survive a refresh.
 */
export const IMPORT_REVIEW_KEY = "resume-editor-import-review-v1";
export const EXPORT_CHECKPOINT_KEY = "resume-editor-last-export-v1";
export const VERSION_HISTORY_KEY = "resume-editor-version-history-v1";
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
  /** Used only for short, reversible editing actions. */
  action?: "undo";
};

export type ImportReviewItem = {
  id: string;
  label: string;
  targetId: string;
  detail: string;
  sourceExcerpt?: string;
};

export type ImportCoverageItem = {
  id: string;
  label: string;
  detected: boolean;
  detail: string;
  targetId: string;
  /** Whether the imported source contained a recognizable heading for this area. */
  sourceDetected?: boolean;
  /** Short local excerpt from the matching source section, when available. */
  sourceExcerpt?: string;
};

export type ImportReviewState = {
  fileName: string;
  /** Compact identity of the draft this review belongs to (for cross-tab safety). */
  draftFingerprint?: string;
  sections: string[];
  items: ImportReviewItem[];
  reviewedItemIds?: string[];
  sourceText?: string;
  coverage?: ImportCoverageItem[];
};

/**
 * A compact, reload-safe representation of an import review. The complete
 * extracted source can be much larger than a normal localStorage budget, and
 * the checklist already keeps the small source excerpts needed for review.
 */
export type StoredImportReview = Omit<ImportReviewState, "sourceText">;

/**
 * A compact, deterministic identity for associating a review checklist with
 * its draft. This is not a security primitive; it avoids copying the full
 * resume into a second localStorage key just to coordinate browser tabs.
 */
export function importReviewDraftFingerprint(state: ResumeState) {
  const value = resumeExportFingerprint(state);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${value.length.toString(36)}-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

export type RecoveryPoint = {
  label: string;
  state: ResumeState;
  importReview: ImportReviewState | null;
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

/**
 * Keeps a small, self-contained view of a recognized source section beside
 * the import coverage summary. This makes a skipped section recoverable
 * without asking someone to search through the complete extracted text. The
 * source stays local and the excerpt deliberately stops at the next known
 * heading rather than trying to infer document structure.
 */
export function importSectionExcerpt(sourceText: string | undefined, section: string) {
  if (!sourceText?.trim()) return undefined;

  const lines = sourceText.split("\n").map((line) => line.trim());
  const isMatchingHeading = (line: string) =>
    detectSection(line) === section || detectSpecialtySection(line) === section;
  const isRecognizedHeading = (line: string) => Boolean(detectSection(line) || detectSpecialtySection(line));
  const headingIndex = lines.findIndex(isMatchingHeading);
  if (headingIndex < 0) return undefined;

  const excerpt: string[] = [];
  for (let index = headingIndex; index < lines.length && excerpt.length < 5; index += 1) {
    const line = lines[index];
    if (index > headingIndex && isRecognizedHeading(line)) break;
    if (line) excerpt.push(line);
  }

  return excerpt.join("\n") || undefined;
}

/** A checkpoint represents one unique resume state. */
export function versionHistoryFingerprint(item: Pick<VersionHistoryItem, "fingerprint">) {
  return item.fingerprint;
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

function limitedString(value: unknown, maximum = 2_000) {
  return typeof value === "string" ? value.slice(0, maximum) : undefined;
}

/**
 * Restores only well-formed review metadata from browser storage. This is
 * deliberately narrower than a version checkpoint: it excludes the complete
 * extracted source while retaining the local excerpts and coverage prompts
 * needed to finish an interrupted review after a refresh.
 */
export function parseStoredImportReview(value: string | null): ImportReviewState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<StoredImportReview>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.fileName !== "string" || !Array.isArray(parsed.items)) {
      return null;
    }

    const items = parsed.items
      .slice(0, 250)
      .flatMap((item): ImportReviewItem[] => {
        if (!item || typeof item !== "object") return [];
        const candidate = item as Partial<ImportReviewItem>;
        const id = limitedString(candidate.id, 160);
        const label = limitedString(candidate.label, 240);
        const targetId = limitedString(candidate.targetId, 240);
        const detail = limitedString(candidate.detail);
        if (!id || !label || !targetId || !detail) return [];
        const sourceExcerpt = limitedString(candidate.sourceExcerpt, 4_000);
        return [{ id, label, targetId, detail, ...(sourceExcerpt ? { sourceExcerpt } : {}) }];
      });

    if (!items.length) return null;
    const itemIds = new Set(items.map((item) => item.id));
    const coverage = Array.isArray(parsed.coverage)
      ? parsed.coverage.slice(0, 40).flatMap((item): ImportCoverageItem[] => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as Partial<ImportCoverageItem>;
          const id = limitedString(candidate.id, 160);
          const label = limitedString(candidate.label, 240);
          const detail = limitedString(candidate.detail);
          const targetId = limitedString(candidate.targetId, 240);
          if (!id || !label || !detail || !targetId || typeof candidate.detected !== "boolean") return [];
          const sourceExcerpt = limitedString(candidate.sourceExcerpt, 4_000);
          return [{
            id,
            label,
            detail,
            targetId,
            detected: candidate.detected,
            ...(typeof candidate.sourceDetected === "boolean" ? { sourceDetected: candidate.sourceDetected } : {}),
            ...(sourceExcerpt ? { sourceExcerpt } : {}),
          }];
        })
      : undefined;

    return {
      fileName: limitedString(parsed.fileName, 500) ?? "imported resume",
      ...(limitedString(parsed.draftFingerprint, 120) ? { draftFingerprint: limitedString(parsed.draftFingerprint, 120) } : {}),
      sections: Array.isArray(parsed.sections)
        ? parsed.sections.map((section) => limitedString(section, 240)).filter((section): section is string => Boolean(section)).slice(0, 40)
        : [],
      items,
      reviewedItemIds: Array.isArray(parsed.reviewedItemIds)
        ? parsed.reviewedItemIds
            .map((id) => limitedString(id, 160))
            .filter((id): id is string => typeof id === "string" && itemIds.has(id))
        : [],
      ...(coverage ? { coverage } : {}),
    };
  } catch {
    return null;
  }
}

/** Drops full extracted source text before persisting a review in localStorage. */
export function storedImportReview(importReview: ImportReviewState): StoredImportReview {
  const { sourceText: _sourceText, ...review } = importReview;
  return review;
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
  sourceText?: string,
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
    sourceExcerpt: importSectionExcerpt(sourceText, section),
  };
}

function customCoverageId(title: string) {
  return `custom-${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section"}`;
}

function specialtyCoverage(
  title: string,
  state: ResumeState,
  sourceDetected: boolean,
  sourceText?: string,
): ImportCoverageItem {
  const section = state.customSections.find((candidate) => candidate.title.toLocaleLowerCase() === title.toLocaleLowerCase());
  const entries = section?.entries.filter(entryHasContent) ?? [];
  const firstEntry = entries[0];
  const firstEntryIndex = firstEntry && section ? section.entries.indexOf(firstEntry) : -1;

  return {
    id: customCoverageId(title),
    label: title,
    detected: entries.length > 0,
    detail: entries.length
      ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} detected`
      : sourceDetected
        ? `${title} heading found in source, but no entries detected`
        : `No ${title.toLocaleLowerCase()} entries detected`,
    targetId: section && firstEntry && firstEntryIndex >= 0
      ? entryTargetId(section.id, firstEntry, firstEntryIndex)
      : "add-custom-section",
    sourceDetected,
    sourceExcerpt: sourceDetected ? importSectionExcerpt(sourceText, title) : undefined,
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
  const sourceSpecialtySections = new Set(
    (sourceText ?? "")
      .split(/\r?\n/)
      .map((line) => detectSpecialtySection(line))
      .filter((section): section is string => Boolean(section)),
  );
  const importedSpecialtySections = state.customSections.flatMap((section) => {
    const title = detectSpecialtySection(section.title);
    return title ? [title] : [];
  });
  const specialtySections = [...sourceSpecialtySections];
  importedSpecialtySections.forEach((title) => {
    if (!specialtySections.some((candidate) => candidate.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      specialtySections.push(title);
    }
  });

  const coverage: ImportCoverageItem[] = [
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
      sourceExcerpt: importSectionExcerpt(sourceText, "summary"),
    },
    entryCoverage("experience", state, sourceSections, sourceText),
    entryCoverage("education", state, sourceSections, sourceText),
    entryCoverage("projects", state, sourceSections, sourceText),
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
      sourceExcerpt: importSectionExcerpt(sourceText, "skills"),
    },
  ];

  return [
    ...coverage,
    ...specialtySections.map((title) => specialtyCoverage(title, state, sourceSpecialtySections.has(title), sourceText)),
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
    draftFingerprint: importReviewDraftFingerprint(state),
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
