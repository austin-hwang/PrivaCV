"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { importResumeDocxWithSource } from "@/lib/docx-import";
import { importResumePdfWithSource, importResumeTextWithSource } from "@/lib/pdf-import";
import { resumeDocxBlob } from "@/lib/docx-export";
import {
  blankEntry,
  buildResumeChecks,
  clampTextScale,
  emptyState,
  getSectionEntries,
  hasAnyContent,
  isBuiltinSection,
  normalizeTagGroups,
  parseTagGroups,
  tagGroupsToText,
  normalizeResume,
  resumeExportFingerprint,
  resumePlainText,
  sampleState,
  SECTION_LABELS,
  type SectionKey,
  type CustomSection,
  type ResumeEntry,
  type ResumeState,
  type ResumeTheme,
  type SectionFormat,
  type TagGroup,
  type OversizedResumeEntry,
} from "@/lib/resume";
import {
  IMPORT_REVIEW_KEY,
  STORAGE_KEY,
  VERSION_HISTORY_BACKUP_FORMAT,
  VERSION_HISTORY_BACKUP_VERSION,
  VERSION_HISTORY_KEY,
  buildImportReview,
  importReviewProgress,
  importReviewDraftFingerprint,
  mergeVersionHistory,
  parseStoredImportReview,
  parseVersionHistory,
  parseVersionHistoryBackup,
  storedImportReview,
  versionHistoryFingerprint,
  versionLabel,
  type ImportReviewState,
  type RecoveryPoint,
  type ToastState,
  type VersionHistoryBackup,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

const AUTOSAVE_TIME_KEY = "resume-editor-autosave-time-v1";

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadFile(blob, filename);
}

function downloadTextFile(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadFile(blob, filename);
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Clipboard access can be unavailable in a privacy-restricted browser or an
 * embedded context even when a person explicitly presses a copy button.
 * Prefer the modern async API, then use the browser's user-gesture copy path
 * as a narrow fallback so application-form copying remains dependable.
 */
async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the synchronous browser fallback below.
    }
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.readOnly = true;
  fallback.setAttribute("aria-hidden", "true");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  fallback.style.pointerEvents = "none";
  // Keep the temporary control within an open modal when there is one. A modal
  // focus trap can immediately pull focus away from a textarea added to body,
  // leaving the legacy copy command with no selected text.
  const fallbackContainer = activeElement?.closest<HTMLElement>("[role=dialog]") ?? document.body;
  fallbackContainer.appendChild(fallback);
  // Some browsers no longer focus a just-appended textarea as a side effect of
  // select(). Explicit focus keeps the legacy user-gesture copy path reliable
  // when the async Clipboard API is unavailable or denied.
  fallback.focus();
  fallback.select();
  fallback.setSelectionRange(0, fallback.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    fallback.remove();
    activeElement?.focus();
  }
}

function safeResumeFilename(name: string) {
  return name.trim().replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "resume";
}

/**
 * Browsers commonly use document.title as the initial Save as PDF filename.
 * Keep that transient title descriptive, but restore the public page title as
 * soon as printing finishes.
 */
function pdfDocumentTitle(name: string) {
  const filename = safeResumeFilename(name);
  return filename === "resume" ? "Resume" : `${filename}_Resume`;
}

type UndoableChange =
  | {
      kind: "entry";
      toastId: number;
      section: string;
      index: number;
      entry: ResumeEntry;
    }
  | {
      kind: "custom-section";
      toastId: number;
      section: CustomSection;
      sectionOrderIndex: number;
      format: SectionFormat;
      tagGroups: TagGroup[];
      text: string;
    }
  | {
      kind: "builtin-section";
      toastId: number;
      section: SectionKey;
      title: string;
      entries: ResumeEntry[];
      skills: string;
      sectionOrderIndex: number;
      format: SectionFormat;
      tagGroups: TagGroup[];
      text: string;
    }
  | {
      kind: "layout";
      toastId: number;
      density: ResumeTheme["density"];
      textScale: number;
    };

export function useResumeEditor() {
  const [state, setState] = useState<ResumeState>(() => emptyState());
  const [loaded, setLoaded] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [pageGuides, setPageGuides] = useState<Array<{ page: number; label?: string }>>([]);
  const [printBreaks, setPrintBreaks] = useState<Array<{ targetId: string; spacer: number }>>([]);
  const [oversizedEntry, setOversizedEntry] = useState<OversizedResumeEntry | null>(null);
  const [textReviewOpen, setTextReviewOpen] = useState(false);
  const [applicationCopyOpen, setApplicationCopyOpen] = useState(false);
  const [textImportOpen, setTextImportOpen] = useState(false);
  const [exportCheckOpen, setExportCheckOpen] = useState(false);
  // Keep one review checkpoint for every downloadable resume format. This
  // prevents an imported draft from quietly bypassing review through Word
  // export while preserving an explicit, informed continue action.
  const [pendingExportFormat, setPendingExportFormat] = useState<"pdf" | "docx">("pdf");
  const [versionSaveOpen, setVersionSaveOpen] = useState(false);
  const [versionDraftLabel, setVersionDraftLabel] = useState("");
  const [versionDraftNote, setVersionDraftNote] = useState("");
  const [draftSourceVersionId, setDraftSourceVersionId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [undoableRemoval, setUndoableRemoval] = useState<UndoableChange | null>(null);
  const [importReview, setImportReview] = useState<ImportReviewState | null>(null);
  const [recoveryPoint, setRecoveryPoint] = useState<RecoveryPoint | null>(null);
  const [deletedVersion, setDeletedVersion] = useState<VersionHistoryItem | null>(null);
  const [historyBackupToImport, setHistoryBackupToImport] = useState<VersionHistoryItem[] | null>(null);
  const [versionHistory, setVersionHistory] = useState<VersionHistoryItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [storageIssue, setStorageIssue] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"saving" | "saved" | "conflict">("saved");
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null);
  // Unlike the live editor state, this is the exact draft most recently
  // written to browser storage. It makes the autosave entry a real restore
  // point while a newer edit is waiting for its debounce to finish.
  const [autosavedState, setAutosavedState] = useState<ResumeState | null>(null);
  const [externalDraft, setExternalDraft] = useState<ResumeState | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const historyBackupInputRef = useRef<HTMLInputElement>(null);
  const resumeRef = useRef<HTMLDivElement>(null);
  const requestExportRef = useRef<() => void>(() => undefined);
  // A deliberate privacy reset should not immediately recreate an empty draft
  // in browser storage. The next actual edit resumes normal autosave.
  const skipNextAutosaveRef = useRef(false);

  const hasContent = hasAnyContent(state);
  const checks = useMemo(() => buildResumeChecks(state, pageCount, oversizedEntry), [oversizedEntry, pageCount, state]);
  const failedChecks = checks.filter((check) => !check.ok);
  const passedChecks = checks.filter((check) => check.ok).length;
  const plainText = useMemo(() => resumePlainText(state), [state]);
  const exportFingerprint = useMemo(() => resumeExportFingerprint(state), [state]);
  const currentVersionHistoryFingerprint = exportFingerprint;
  const existingVersionForSave = useMemo(
    () => versionHistory.find((item) => versionHistoryFingerprint(item) === currentVersionHistoryFingerprint) ?? null,
    [currentVersionHistoryFingerprint, versionHistory],
  );
  const mergedHistoryBackup = useMemo(
    () =>
      historyBackupToImport
        ? mergeVersionHistory(versionHistory, historyBackupToImport)
        : { checkpoints: [], incomingUnique: [], matchingCheckpoints: [] },
    [historyBackupToImport, versionHistory],
  );
  const importReviewTargets = useMemo(
    () => new Set(importReview?.items.map((item) => item.targetId) ?? []),
    [importReview],
  );
  const importReviewItemsByTarget = useMemo(() => {
    const reviewedItemIds = new Set(importReview?.reviewedItemIds ?? []);
    return new Map(
      (importReview?.items ?? []).map((item) => [item.targetId, {
        ...item,
        confirmed: reviewedItemIds.has(item.id),
      }]),
    );
  }, [importReview]);
  const importReviewStatus = useMemo(
    () => (importReview ? importReviewProgress(importReview) : null),
    [importReview],
  );

  const flash = useCallback((message: string, action?: ToastState["action"]) => {
    const id = Date.now();
    setToast({ id, message, action });
    if (!action) setUndoableRemoval(null);
    return id;
  }, []);

  const reportStorageIssue = useCallback(() => {
    setStorageIssue(true);
  }, []);

  const confirmStorageAvailable = useCallback(() => {
    setStorageIssue(false);
  }, []);

  /**
   * Version checkpoints can grow much faster than the active draft. Write
   * them synchronously at the action boundary so a person never receives a
   * false "saved" confirmation when the browser has run out of room.
   */
  const persistVersionHistory = useCallback((nextHistory: VersionHistoryItem[]) => {
    try {
      if (nextHistory.length) localStorage.setItem(VERSION_HISTORY_KEY, JSON.stringify(nextHistory));
      else localStorage.removeItem(VERSION_HISTORY_KEY);
      confirmStorageAvailable();
      return true;
    } catch {
      reportStorageIssue();
      return false;
    }
  }, [confirmStorageAvailable, reportStorageIssue]);

  const saveRecoveryPoint = useCallback(
    (
      label: string,
      previousState = state,
      previousImportReview = importReview,
    ) => {
      if (!hasAnyContent(previousState) && !previousImportReview) {
        setRecoveryPoint(null);
        return;
      }
      setRecoveryPoint({
        label,
        state: previousState,
        importReview: previousImportReview,
      });
    },
    [importReview, state],
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

  const saveVersion = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    // Every save is its own checkpoint now — no cap and no fingerprint-based
    // replacement. People differentiate near-identical saves with the label +
    // note, so two saves of similar content each keep their own entry.
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
    const saved = persistVersionHistory(nextHistory);
    // Keep the checkpoint visible for this session even when browser storage
    // is unavailable, but also give the person a durable copy immediately.
    setVersionHistory(nextHistory);
    setDraftSourceVersionId(entry.id);
    setVersionSaveOpen(false);
    if (saved) {
      flash("Version saved locally");
    } else {
      downloadJsonFile({
        format: VERSION_HISTORY_BACKUP_FORMAT,
        version: VERSION_HISTORY_BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        checkpoints: nextHistory,
      } satisfies VersionHistoryBackup, `${safeResumeFilename(state.name || "resume")}-checkpoints.json`);
      flash("Browser storage unavailable — checkpoint backup downloaded");
    }
  };

  /**
   * The live autosave key points at the resume currently open in the editor.
   * Before loading a different saved resume, preserve the outgoing working
   * draft as its own history slot so the incoming resume can autosave without
   * replacing the previous draft.
   */
  const forkAutosaveBeforeLoading = (nextState: ResumeState, destinationLabel: string) => {
    if (!hasAnyContent(state)) return;
    const fingerprint = resumeExportFingerprint(state);
    if (fingerprint === resumeExportFingerprint(nextState)) return;
    if (versionHistory.some((item) => versionHistoryFingerprint(item) === fingerprint)) return;

    const derivedFrom = versionHistory.find((item) => item.id === draftSourceVersionId) ?? null;
    const timestamp = Date.now();
    let id = `autosave-slot-${timestamp}`;
    let suffix = 2;
    while (versionHistory.some((item) => item.id === id)) {
      id = `autosave-slot-${timestamp}-${suffix}`;
      suffix += 1;
    }
    const entry: VersionHistoryItem = {
      id,
      savedAt: new Date(timestamp).toISOString(),
      label: `Autosave · ${versionLabel(state)}`,
      note: `Preserved automatically before loading ${destinationLabel}.`,
      derivedFromId: derivedFrom?.id,
      derivedFromLabel: derivedFrom?.label,
      fingerprint,
      state: normalizeResume(state),
      importReview,
    };
    const nextHistory = [entry, ...versionHistory];
    persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
  };

  const restoreVersion = (item: VersionHistoryItem) => {
    forkAutosaveBeforeLoading(item.state, item.label);
    saveRecoveryPoint(`Before restoring ${item.label}`);
    setState(item.state);
    setImportReview(item.importReview);
    setDraftSourceVersionId(item.id === "autosave-copy" ? null : item.id);
    flash(`Restored ${item.label}`);
  };

  const deleteVersion = (id: string) => {
    const deleted = versionHistory.find((item) => item.id === id) ?? null;
    const nextHistory = versionHistory.filter((item) => item.id !== id);
    const deletedLocally = persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
    setDeletedVersion(deleted);
    if (draftSourceVersionId === id) setDraftSourceVersionId(null);
    flash(deletedLocally ? "Deleted saved version" : "Could not remove the saved version from browser storage");
  };

  const undoDeleteVersion = () => {
    if (!deletedVersion) return;
    const nextHistory = [deletedVersion, ...versionHistory.filter((item) => item.id !== deletedVersion.id)]
      .sort((first, second) => new Date(second.savedAt).getTime() - new Date(first.savedAt).getTime());
    const restoredLocally = persistVersionHistory(nextHistory);
    setVersionHistory(nextHistory);
    setDeletedVersion(null);
    flash(restoredLocally ? "Restored deleted checkpoint" : "Checkpoint restored for this session only");
  };

  const focusCheckTarget = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  useEffect(() => {
    try {
      const legacy = localStorage.getItem("resume-editor-data-v1");
      const saved = localStorage.getItem(STORAGE_KEY) ?? legacy;
      if (saved) {
        const savedState = normalizeResume(JSON.parse(saved));
        setState(savedState);
        setAutosavedState(savedState);
        setAutosavedAt(localStorage.getItem(AUTOSAVE_TIME_KEY) ?? new Date().toISOString());
      }
      setImportReview(parseStoredImportReview(localStorage.getItem(IMPORT_REVIEW_KEY)));
      localStorage.removeItem("resume-editor-last-export-v1");
      setVersionHistory(parseVersionHistory(localStorage.getItem(VERSION_HISTORY_KEY)));
      // Role Focus was removed because it added a distracting detour without
      // reliably improving a person's resume. Clear its old private data too.
      localStorage.removeItem("resume-editor-role-focus-v1");
      localStorage.removeItem("resume-editor-role-focus-label-v1");
    } catch {
      reportStorageIssue();
    } finally {
      setLoaded(true);
    }
  }, [reportStorageIssue]);

  // `storage` fires only in the other tab. Keep a different draft visible
  // until the person decides, rather than silently replacing active work or
  // letting this stale tab overwrite the newer local autosave.
  useEffect(() => {
    const handleExternalDraft = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const nextDraft = normalizeResume(JSON.parse(event.newValue));
        if (resumeExportFingerprint(nextDraft) !== resumeExportFingerprint(state)) setExternalDraft(nextDraft);
      } catch {
        // Never replace the open draft with a malformed external value.
      }
    };

    window.addEventListener("storage", handleExternalDraft);
    return () => window.removeEventListener("storage", handleExternalDraft);
  }, [state]);

  useEffect(() => {
    if (!loaded) return;
    if (externalDraft) {
      setAutosaveStatus("conflict");
      return;
    }
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      setAutosaveStatus("saved");
      return;
    }
    setAutosaveStatus("saving");
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(AUTOSAVE_TIME_KEY, savedAt);
        confirmStorageAvailable();
        setAutosavedState(normalizeResume(state));
        setAutosavedAt(savedAt);
        setAutosaveStatus("saved");
      } catch {
        reportStorageIssue();
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [confirmStorageAvailable, externalDraft, loaded, reportStorageIssue, state]);

  // A refresh should never turn an unreviewed import into an ordinary draft.
  // Persist the checklist with a bounded copy of its extracted source so local
  // parser repair remains available after a refresh.
  useEffect(() => {
    if (!loaded) return;
    try {
      if (importReview) localStorage.setItem(IMPORT_REVIEW_KEY, JSON.stringify(storedImportReview(importReview)));
      else localStorage.removeItem(IMPORT_REVIEW_KEY);
    } catch {
      reportStorageIssue();
    }
  }, [importReview, loaded, reportStorageIssue]);

  // The checklist follows ordinary edits to an imported draft. That gives a
  // second tab a reliable way to tell whether the currently saved draft and
  // the persisted review belong together, without duplicating the full resume
  // in the review's browser-storage entry.
  useEffect(() => {
    if (!importReview) return;
    const draftFingerprint = importReviewDraftFingerprint(state);
    if (importReview.draftFingerprint === draftFingerprint) return;
    setImportReview((current) => current ? { ...current, draftFingerprint } : null);
  }, [importReview, state]);

  const useExternalDraft = () => {
    if (!externalDraft) return;
    forkAutosaveBeforeLoading(externalDraft, "the draft saved in another tab");
    saveRecoveryPoint("Before using the draft saved in another tab");
    // Import-review metadata is persisted separately from the editable draft.
    // Bring it across only when it identifies this exact saved draft; a stale
    // checklist is less safe than asking the person to review again.
    const externalReview = parseStoredImportReview(localStorage.getItem(IMPORT_REVIEW_KEY));
    const matchingExternalReview =
      externalReview?.draftFingerprint === importReviewDraftFingerprint(externalDraft)
        ? externalReview
        : null;
    setState(externalDraft);
    setImportReview(matchingExternalReview);
    setExternalDraft(null);
    flash(matchingExternalReview ? "Loaded the draft and its import review" : "Loaded the draft saved in another tab");
  };

  const keepCurrentDraft = () => {
    setExternalDraft(null);
    flash("Keeping this tab's draft");
  };

  useEffect(() => {
    if (!loaded) return;
    persistVersionHistory(versionHistory);
  }, [loaded, persistVersionHistory, versionHistory]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast((current) => current?.id === toast.id ? null : current);
      if (toast.action === "undo") {
        setUndoableRemoval((current) => current?.toastId === toast.id ? null : current);
      }
    }, toast.action === "undo" ? 5000 : 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const measure = () => {
      const sheet = resumeRef.current;
      if (!sheet) return;
      const pageHeightPx = 11 * 96;
      const roundingTolerancePx = 2;
      // Measure the natural content height, not scrollHeight: the sheet's
      // min-height is set from the current page count to render whole pages, so
      // scrollHeight is floored at pageCount * 11in and could never shrink back
      // (e.g. switching to a denser layout would keep a phantom extra page).
      // The page frames and guides are absolutely positioned, so ignore them.
      const contentHeight = Array.from(sheet.children).reduce((max, child) => {
        const el = child as HTMLElement;
        if (el.classList.contains("resume-page-frame") || el.classList.contains("resume-page-guide")) return max;
        return Math.max(max, el.offsetTop + el.offsetHeight);
      }, 0);
      const nextPageCount = Math.max(1, Math.ceil((contentHeight - roundingTolerancePx) / pageHeightPx));
      setPageCount(nextPageCount);

      // A page boundary is most useful when it tells a person what will be
      // encountered next. Use the live preview geometry so this remains true
      // as text, font, density, or section order changes; the guides remain
      // screen-only and do not affect the exported document.
      const guideTargets = Array.from(sheet.querySelectorAll<HTMLElement>("[data-resume-guide-label]"));
      const nextPageGuides = Array.from({ length: Math.max(0, nextPageCount - 1) }, (_, index) => {
        const page = index + 2;
        const boundary = (page - 1) * pageHeightPx;
        const nextTarget = guideTargets.find((target) => target.offsetTop + target.offsetHeight > boundary + roundingTolerancePx);
        return { page, label: nextTarget?.dataset.resumeGuideLabel };
      });
      setPageGuides((current) =>
        current.length === nextPageGuides.length && current.every((guide, index) =>
          guide.page === nextPageGuides[index].page && guide.label === nextPageGuides[index].label,
        )
          ? current
          : nextPageGuides,
      );

      // Entries normally stay together in print. If an entry is taller than a
      // printable content area, though, every browser must split it. Surface
      // that specific role before export instead of leaving its continuation
      // to appear without a heading on a later page.
      const sheetStyle = window.getComputedStyle(sheet);
      const printableContentHeight = pageHeightPx -
        Number.parseFloat(sheetStyle.paddingTop) -
        Number.parseFloat(sheetStyle.paddingBottom);
      const nextOversizedEntry = Array.from(sheet.querySelectorAll<HTMLElement>("[data-resume-entry-section]")).find((entry) =>
        entry.offsetHeight > printableContentHeight + roundingTolerancePx,
      );
      const next = nextOversizedEntry
        ? {
            section: nextOversizedEntry.dataset.resumeEntrySection ?? "experience",
            index: Number(nextOversizedEntry.dataset.resumeEntryIndex ?? 0),
          }
        : null;
      setOversizedEntry((current) =>
        current?.section === next?.section && current?.index === next?.index ? current : next,
      );

      // Browser print engines keep role entries intact. When an otherwise
      // printable entry would straddle a Letter boundary, Chromium moves it to
      // the next page. Reserve that same space in the live sheet, so the
      // visible page count and page guides describe the PDF a person will save.
      const existingBreaks = new Map(printBreaks.map((item) => [item.targetId, item.spacer]));
      const printableUnits: Array<{ targetId: string; element: HTMLElement; end: number }> = [];
      Array.from(sheet.querySelectorAll<HTMLElement>("[data-resume-print-section]")).forEach((section) => {
        const sectionId = section.dataset.resumePrintSection;
        if (!sectionId) return;
        const entries = Array.from(section.querySelectorAll<HTMLElement>("[data-resume-print-entry]"));

        // A section without individually breakable entries (Skills renders as
        // list lines, not entries) is one atomic unit. Reserve the same page
        // break the print engine takes for it via `break-inside: avoid`, so the
        // block moves to the next page in the preview exactly as it does in the
        // exported PDF instead of straddling the Letter boundary.
        if (!entries.length) {
          printableUnits.push({
            targetId: `section:${sectionId}`,
            element: section,
            end: section.offsetTop + section.offsetHeight,
          });
          return;
        }

        const startsWithHeading = section.dataset.resumeSectionHasHeading === "true";
        const firstEntry = entries[0];
        if (startsWithHeading) {
          printableUnits.push({
            targetId: `section:${sectionId}`,
            element: section,
            end: firstEntry.offsetTop + firstEntry.offsetHeight,
          });
        } else {
          printableUnits.push({
            targetId: `entry:${firstEntry.dataset.resumePrintEntry}`,
            element: firstEntry,
            end: firstEntry.offsetTop + firstEntry.offsetHeight,
          });
        }

        entries.slice(1).forEach((entry) => {
          printableUnits.push({
            targetId: `entry:${entry.dataset.resumePrintEntry}`,
            element: entry,
            end: entry.offsetTop + entry.offsetHeight,
          });
        });
      });

      const desiredBreaks: Array<{ targetId: string; spacer: number }> = [];
      let existingSpacerBeforeUnit = 0;
      let simulatedSpacer = 0;
      printableUnits.forEach((unit) => {
        const existingSpacerAtUnit = existingBreaks.get(unit.targetId) ?? 0;
        const baseStart = unit.element.offsetTop - existingSpacerBeforeUnit;
        const baseEnd = unit.end - existingSpacerBeforeUnit - existingSpacerAtUnit;
        const start = baseStart + simulatedSpacer;
        const end = baseEnd + simulatedSpacer;
        const currentPage = Math.max(0, Math.floor(start / pageHeightPx));
        const pageContentEnd = (currentPage + 1) * pageHeightPx - Number.parseFloat(sheetStyle.paddingBottom);
        if (end > pageContentEnd + roundingTolerancePx) {
          const spacer = (currentPage + 1) * pageHeightPx + Number.parseFloat(sheetStyle.paddingTop) - start;
          desiredBreaks.push({ targetId: unit.targetId, spacer });
          simulatedSpacer += spacer;
        }
        existingSpacerBeforeUnit += existingSpacerAtUnit;
      });
      setPrintBreaks((current) =>
        current.length === desiredBreaks.length && current.every((item, index) =>
          item.targetId === desiredBreaks[index].targetId && Math.abs(item.spacer - desiredBreaks[index].spacer) < 0.5,
        )
          ? current
          : desiredBreaks,
      );
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [printBreaks, state]);

  const updateField = <K extends keyof ResumeState>(key: K, value: ResumeState[K]) => {
    setState((current) => {
      if (key === "skills") {
        const skills = String(value);
        return {
          ...current,
          skills,
          sectionTagGroups: { ...current.sectionTagGroups, skills: parseTagGroups(skills, "skills") },
        };
      }
      return { ...current, [key]: value };
    });
  };

  const updateEntry = (
    section: string,
    index: number,
    key: keyof ResumeEntry,
    value: string,
  ) => {
    setState((current) => {
      if (section === "skills") {
        return {
          ...current,
          skillEntries: current.skillEntries.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [key]: value } : entry,
          ),
        };
      }
      if (isBuiltinSection(section) && section !== "skills") {
        return {
          ...current,
          [section]: current[section].map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [key]: value } : entry,
          ),
        };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section
            ? {
              ...custom,
              entries: custom.entries.map((entry, entryIndex) =>
                entryIndex === index ? { ...entry, [key]: value } : entry,
              ),
            }
            : custom,
        ),
      };
    });
  };

  const swapExperienceTitleAndCompany = (index: number) => {
    setState((current) => ({
      ...current,
      experience: current.experience.map((entry, entryIndex) =>
        entryIndex === index
          ? { ...entry, title: entry.subtitle, subtitle: entry.title }
          : entry,
      ),
    }));
  };

  const addEntry = (section: string) => {
    setState((current) => {
      if (section === "skills") {
        return { ...current, skillEntries: [...current.skillEntries, blankEntry()] };
      }
      if (isBuiltinSection(section) && section !== "skills") {
        return { ...current, [section]: [...current[section], blankEntry()] };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section ? { ...custom, entries: [...custom.entries, blankEntry()] } : custom,
        ),
      };
    });
  };

  const removeEntry = (section: string, index: number) => {
    const entry = getSectionEntries(state, section)[index];
    if (!entry) return;
    const sectionTitle = isBuiltinSection(section)
      ? state.sectionTitles[section]
      : state.customSections.find((custom) => custom.id === section)?.title ?? "Custom section";
    setState((current) => {
      if (section === "skills") {
        return { ...current, skillEntries: current.skillEntries.filter((_, entryIndex) => entryIndex !== index) };
      }
      if (isBuiltinSection(section) && section !== "skills") {
        return { ...current, [section]: current[section].filter((_, entryIndex) => entryIndex !== index) };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) =>
          custom.id === section ? { ...custom, entries: custom.entries.filter((_, entryIndex) => entryIndex !== index) } : custom,
        ),
      };
    });
    const toastId = flash(`Removed ${sectionTitle || "custom"} entry`, "undo");
    setUndoableRemoval({ kind: "entry", toastId, section, index, entry });
  };

  const reorderEntry = (section: string, index: number, target: number) => {
    setState((current) => {
      const next = [...getSectionEntries(current, section)];
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      if (section === "skills") return { ...current, skillEntries: next };
      if (isBuiltinSection(section) && section !== "skills") return { ...current, [section]: next };
      return {
        ...current,
        customSections: current.customSections.map((custom) => custom.id === section ? { ...custom, entries: next } : custom),
      };
    });
  };

  const moveEntry = (section: string, index: number, direction: -1 | 1) => reorderEntry(section, index, index + direction);

  const reorderSection = (section: string, target: number) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      if (target < 0 || target >= next.length) return current;
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...current, sectionOrder: next };
    });
  };

  const moveSection = (section: string, direction: -1 | 1) => {
    setState((current) => {
      const next = [...current.sectionOrder];
      const index = next.indexOf(section);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, sectionOrder: next };
    });
  };

  // Keep page-fit help deliberately modest and reversible. It never removes or
  // rewrites content: compact spacing comes first, followed by small text-size
  // steps if the person has already chosen the compact layout.
  const tightenLayout = () => {
    const previousDensity = state.theme.density;
    const previousTextScale = state.textScale;
    const nextTextScale = previousDensity === "compact" ? clampTextScale(previousTextScale - 0.02) : previousTextScale;

    if (previousDensity === "compact" && nextTextScale === previousTextScale) {
      flash("The tightest layout is already active");
      return;
    }

    setState((current) => ({
      ...current,
      theme: { ...current.theme, density: "compact" },
      textScale: current.theme.density === "compact" ? clampTextScale(current.textScale - 0.02) : current.textScale,
    }));
    const toastId = flash(
      previousDensity === "compact"
        ? `Reduced text size to ${Math.round(nextTextScale * 100)}%`
        : "Applied compact spacing",
      "undo",
    );
    setUndoableRemoval({ kind: "layout", toastId, density: previousDensity, textScale: previousTextScale });
  };

  const updateSectionTitle = (section: string, title: string) => {
    setState((current) => {
      if (isBuiltinSection(section)) {
        return { ...current, sectionTitles: { ...current.sectionTitles, [section]: title } };
      }
      return {
        ...current,
        customSections: current.customSections.map((custom) => custom.id === section ? { ...custom, title } : custom),
      };
    });
  };

  const updateSectionFormat = (section: string, format: SectionFormat) => {
    setState((current) => ({
      ...current,
      sectionFormats: { ...current.sectionFormats, [section]: format },
    }));
  };

  const updateSectionTagGroups = (section: string, groups: TagGroup[]) => {
    setState((current) => {
      // Keep a newly added blank group in the live editor long enough for the
      // person to name it. Full resume normalization still drops abandoned
      // empty groups when data is loaded or exported.
      const normalized = normalizeTagGroups(groups, section, true);
      return {
        ...current,
        sectionTagGroups: { ...current.sectionTagGroups, [section]: normalized },
        // Keep the legacy Skills text in sync so older JSON consumers and
        // import/export paths retain a readable representation.
        ...(section === "skills" ? { skills: tagGroupsToText(normalized) } : {}),
      };
    });
  };

  const updateSectionText = (section: string, text: string) => {
    setState((current) => ({
      ...current,
      sectionText: { ...current.sectionText, [section]: text },
    }));
  };

  const addCustomSection = (title = "New Section") => {
    const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setState((current) => ({
      ...current,
      customSections: [...current.customSections, { id, title, entries: [blankEntry()] }],
      sectionOrder: [...current.sectionOrder, id],
    }));
    return id;
  };

  const addBuiltinSection = (section: SectionKey) => {
    setState((current) => {
      if (current.sectionOrder.includes(section)) return current;
      const next = {
        ...current,
        sectionOrder: [...current.sectionOrder, section],
        // A freshly (re)added section should be visible.
        hiddenSections: current.hiddenSections.filter((id) => id !== section),
        sectionTitles: { ...current.sectionTitles, [section]: SECTION_LABELS[section] },
      };
      if (section === "skills") {
        return {
          ...next,
          skills: "",
          skillEntries: [],
          sectionFormats: { ...next.sectionFormats, skills: "tag-groups" },
          sectionTagGroups: { ...next.sectionTagGroups, skills: [] },
        };
      }
      return { ...next, [section]: [blankEntry()] };
    });
    flash(`Added ${SECTION_LABELS[section]} section`);
  };

  const toggleSectionHidden = (section: string) => {
    setState((current) => {
      const hidden = new Set(current.hiddenSections);
      if (hidden.has(section)) hidden.delete(section);
      else hidden.add(section);
      return { ...current, hiddenSections: [...hidden] };
    });
  };

  const removeCustomSection = (section: string) => {
    const removedSection = state.customSections.find((custom) => custom.id === section);
    if (!removedSection) return;
    const sectionOrderIndex = state.sectionOrder.indexOf(section);
    setState((current) => ({
      ...current,
      customSections: current.customSections.filter((custom) => custom.id !== section),
      sectionOrder: current.sectionOrder.filter((id) => id !== section),
      hiddenSections: current.hiddenSections.filter((id) => id !== section),
      sectionFormats: Object.fromEntries(Object.entries(current.sectionFormats).filter(([id]) => id !== section)),
      sectionTagGroups: Object.fromEntries(Object.entries(current.sectionTagGroups).filter(([id]) => id !== section)),
      sectionText: Object.fromEntries(Object.entries(current.sectionText).filter(([id]) => id !== section)),
    }));
    const toastId = flash(`Removed ${removedSection.title || "custom"} section`, "undo");
    setUndoableRemoval({
      kind: "custom-section",
      toastId,
      section: removedSection,
      sectionOrderIndex,
      format: state.sectionFormats[section] ?? "entries",
      tagGroups: state.sectionTagGroups[section] ?? [],
      text: state.sectionText[section] ?? "",
    });
  };

  const removeBuiltinSection = (section: SectionKey) => {
    if (!state.sectionOrder.includes(section)) return;
    const sectionOrderIndex = state.sectionOrder.indexOf(section);
    const title = state.sectionTitles[section];
    const entries = getSectionEntries(state, section);
    const skills = section === "skills" ? state.skills : "";
    const format = state.sectionFormats[section] ?? (section === "skills" ? "tag-groups" : "entries");
    const tagGroups = state.sectionTagGroups[section] ?? [];
    const text = state.sectionText[section] ?? "";
    setState((current) => {
      if (!current.sectionOrder.includes(section)) return current;
      const next = {
        ...current,
        sectionOrder: current.sectionOrder.filter((id) => id !== section),
        hiddenSections: current.hiddenSections.filter((id) => id !== section),
        sectionTitles: { ...current.sectionTitles, [section]: SECTION_LABELS[section] },
      };
      if (section === "skills") {
        return {
          ...next,
          skills: "",
          skillEntries: [],
          sectionFormats: { ...next.sectionFormats, skills: "tag-groups" },
          sectionTagGroups: { ...next.sectionTagGroups, skills: [] },
        };
      }
      return { ...next, [section]: [] };
    });
    const toastId = flash(`Removed ${title || SECTION_LABELS[section]} section`, "undo");
    setUndoableRemoval({ kind: "builtin-section", toastId, section, title, entries, skills, sectionOrderIndex, format, tagGroups, text });
  };

  const undoRemoval = () => {
    if (!undoableRemoval) return;
    setState((current) => {
      if (undoableRemoval.kind === "layout") {
        return {
          ...current,
          theme: { ...current.theme, density: undoableRemoval.density },
          textScale: undoableRemoval.textScale,
        };
      }

      if (undoableRemoval.kind === "entry") {
        const { section, index, entry } = undoableRemoval;
        if (section === "skills") {
          const skillEntries = [...current.skillEntries];
          skillEntries.splice(Math.min(index, skillEntries.length), 0, entry);
          return { ...current, skillEntries };
        }
        if (isBuiltinSection(section) && section !== "skills") {
          const entries = [...current[section]];
          entries.splice(Math.min(index, entries.length), 0, entry);
          return { ...current, [section]: entries };
        }
        const customSection = current.customSections.find((item) => item.id === section);
        if (!customSection) return current;
        const entries = [...customSection.entries];
        entries.splice(Math.min(index, entries.length), 0, entry);
        return {
          ...current,
          customSections: current.customSections.map((item) =>
            item.id === section ? { ...item, entries } : item,
          ),
        };
      }

      if (undoableRemoval.kind === "custom-section") {
        if (current.customSections.some((item) => item.id === undoableRemoval.section.id)) return current;
        const sectionOrder = [...current.sectionOrder];
        sectionOrder.splice(Math.min(undoableRemoval.sectionOrderIndex, sectionOrder.length), 0, undoableRemoval.section.id);
        return {
          ...current,
          customSections: [...current.customSections, undoableRemoval.section],
          sectionOrder,
          sectionFormats: { ...current.sectionFormats, [undoableRemoval.section.id]: undoableRemoval.format },
          sectionTagGroups: { ...current.sectionTagGroups, [undoableRemoval.section.id]: undoableRemoval.tagGroups },
          sectionText: { ...current.sectionText, [undoableRemoval.section.id]: undoableRemoval.text },
        };
      }

      if (current.sectionOrder.includes(undoableRemoval.section)) return current;
      const sectionOrder = [...current.sectionOrder];
      sectionOrder.splice(Math.min(undoableRemoval.sectionOrderIndex, sectionOrder.length), 0, undoableRemoval.section);
      const next = {
        ...current,
        sectionOrder,
        sectionTitles: { ...current.sectionTitles, [undoableRemoval.section]: undoableRemoval.title },
      };
      if (undoableRemoval.section === "skills") {
        return {
          ...next,
          skills: undoableRemoval.skills,
          skillEntries: undoableRemoval.entries,
          sectionFormats: { ...next.sectionFormats, skills: undoableRemoval.format },
          sectionTagGroups: { ...next.sectionTagGroups, skills: undoableRemoval.tagGroups },
          sectionText: { ...next.sectionText, skills: undoableRemoval.text },
        };
      }
      return {
        ...next,
        [undoableRemoval.section]: undoableRemoval.entries,
        sectionFormats: { ...next.sectionFormats, [undoableRemoval.section]: undoableRemoval.format },
        sectionTagGroups: { ...next.sectionTagGroups, [undoableRemoval.section]: undoableRemoval.tagGroups },
        sectionText: { ...next.sectionText, [undoableRemoval.section]: undoableRemoval.text },
      };
    });
    setUndoableRemoval(null);
    flash(
      undoableRemoval.kind === "layout"
        ? "Restored layout"
        : undoableRemoval.kind === "entry"
          ? "Restored entry"
          : "Restored section",
    );
  };

  const loadSample = () => {
    saveRecoveryPoint("Before loading the sample");
    // Loading a sample should replace the resume content, not quietly undo the
    // design a person just chose to evaluate it in. Keep every visual setting
    // (including scale) aligned with the active preview and PDF.
    setState((current) => ({
      ...sampleState(),
      template: current.template,
      theme: current.theme,
      textScale: current.textScale,
    }));
    setImportReview(null);
    setDraftSourceVersionId(null);
    flash("Sample loaded");
  };

  const clearResume = () => {
    saveRecoveryPoint("Before clearing the resume");
    setState(emptyState());
    setImportReview(null);
    setDraftSourceVersionId(null);
    flash("Cleared");
  };

  /**
   * Remove resume content and the related browser-only records together. This
   * is intentionally separate from Clear, whose recovery point is useful when
   * someone merely wants to start over while keeping their local work safe.
   */
  const clearSavedBrowserData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("resume-editor-data-v1");
      localStorage.removeItem(IMPORT_REVIEW_KEY);
      localStorage.removeItem("resume-editor-last-export-v1");
      localStorage.removeItem(VERSION_HISTORY_KEY);
      localStorage.removeItem(AUTOSAVE_TIME_KEY);
      localStorage.removeItem("resume-editor-role-focus-v1");
      localStorage.removeItem("resume-editor-role-focus-label-v1");
      confirmStorageAvailable();
    } catch {
      reportStorageIssue();
    }
    skipNextAutosaveRef.current = true;
    setState(emptyState());
    setImportReview(null);
    setVersionHistory([]);
    setAutosavedAt(null);
    setAutosavedState(null);
    setRecoveryPoint(null);
    setDeletedVersion(null);
    setHistoryBackupToImport(null);
    setUndoableRemoval(null);
    setExternalDraft(null);
    setDraftSourceVersionId(null);
    flash("Deleted all data");
  };

  const dismissRecoveryPoint = () => {
    setRecoveryPoint(null);
  };

  const toggleImportReviewItem = (itemId: string) => {
    setImportReview((current) => {
      if (!current || !current.items.some((item) => item.id === itemId)) return current;
      const reviewedItemIds = new Set(current.reviewedItemIds ?? []);
      if (reviewedItemIds.has(itemId)) {
        reviewedItemIds.delete(itemId);
      } else {
        reviewedItemIds.add(itemId);
      }
      return { ...current, reviewedItemIds: [...reviewedItemIds] };
    });
  };

  // Finishing from the summary is itself the deliberate bulk confirmation.
  // The walkthrough still requires each field to be confirmed before its own
  // finish action becomes available.
  const completeImportReview = (confirmAll = false) => {
    if (!importReview || (!confirmAll && !importReviewProgress(importReview).isComplete)) return;
    setImportReview(null);
    flash("Import review complete");
  };

  const saveJson = () => {
    downloadJsonFile(state, `${safeResumeFilename(state.name || "resume")}.json`);
    flash("Saved JSON to downloads");
  };

  const saveVersionHistoryBackup = () => {
    if (!versionHistory.length) {
      flash("Save a checkpoint first");
      return;
    }
    const backup: VersionHistoryBackup = {
      format: VERSION_HISTORY_BACKUP_FORMAT,
      version: VERSION_HISTORY_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      checkpoints: versionHistory,
    };
    downloadJsonFile(backup, `${safeResumeFilename(state.name || "resume")}-checkpoints.json`);
    flash("Saved checkpoint backup to downloads");
  };

  const openVersionHistoryBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      const checkpoints = parseVersionHistoryBackup(JSON.parse(await file.text()));
      if (!checkpoints?.length) {
        flash("That backup has no saved checkpoints");
        return;
      }
      setHistoryBackupToImport(checkpoints);
    } catch {
      flash("That file is not a checkpoint backup");
    }
  };

  const importVersionHistoryBackup = () => {
    if (!historyBackupToImport) return;
    const importedCount = mergedHistoryBackup.checkpoints.filter((checkpoint) =>
      mergedHistoryBackup.incomingUnique.some(
        (incoming) => versionHistoryFingerprint(incoming) === versionHistoryFingerprint(checkpoint),
      ),
    ).length;
    const matchingCount = mergedHistoryBackup.matchingCheckpoints.length;
    const saved = persistVersionHistory(mergedHistoryBackup.checkpoints);
    setVersionHistory(mergedHistoryBackup.checkpoints);
    setHistoryBackupToImport(null);
    setDeletedVersion(null);
    setDraftSourceVersionId(null);
    const message =
      importedCount
        ? `Added ${importedCount} ${importedCount === 1 ? "checkpoint" : "checkpoints"}${
            matchingCount ? ` · ${matchingCount} already saved` : ""
          }`
        : "All backup checkpoints are already saved";
    flash(saved ? message : `${message} · not saved to this browser`);
  };

  const openJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const nextState = normalizeResume(JSON.parse(text));
      forkAutosaveBeforeLoading(nextState, file.name);
      saveRecoveryPoint(`Before opening ${file.name}`);
      setState(nextState);
      setImportReview(null);
      setDraftSourceVersionId(null);
      flash("Loaded JSON");
    } catch {
      flash("That file is not valid resume JSON");
    }
  };

  const openPdf = async (file: File | undefined) => {
    if (!file) return;
    const previousState = state;
    const previousImportReview = importReview;
    setIsImporting(true);
    try {
      const imported = await importResumePdfWithSource(file);
      saveRecoveryPoint(`Before importing ${file.name}`, previousState, previousImportReview);
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, file.name, imported.sourceText));
      setDraftSourceVersionId(null);
      flash("Imported PDF - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this PDF");
    } finally {
      setIsImporting(false);
    }
  };

  const openDocx = async (file: File | undefined) => {
    if (!file) return;
    const previousState = state;
    const previousImportReview = importReview;
    setIsImporting(true);
    try {
      const imported = await importResumeDocxWithSource(file);
      saveRecoveryPoint(`Before importing ${file.name}`, previousState, previousImportReview);
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, file.name, imported.sourceText));
      setDraftSourceVersionId(null);
      flash("Imported Word document - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this Word document");
    } finally {
      setIsImporting(false);
    }
  };

  // People shouldn't have to know whether their file is a PDF or a Word
  // document before clicking — one importer routes on the file itself.
  const openResumeFile = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isDocx =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx");
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    if (isDocx) return openDocx(file);
    if (isPdf) return openPdf(file);
    flash("Choose a PDF or Word (.docx) file, or paste the text instead");
  };

  const openTextImport = (text: string) => {
    try {
      const imported = importResumeTextWithSource(text);
      saveRecoveryPoint("Before importing pasted resume text");
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, "pasted resume text", imported.sourceText));
      setDraftSourceVersionId(null);
      setTextImportOpen(false);
      flash("Imported pasted text - please review");
      return true;
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import pasted text");
      return false;
    }
  };

  const applyAIImportFix = (proposal: ResumeState) => {
    if (!importReview?.sourceText) {
      flash("The original import text is no longer available - import the file again first");
      return false;
    }
    const nextState = normalizeResume(proposal);
    saveRecoveryPoint(`Before fixing the ${importReview.fileName} import with local AI`, state, importReview);
    setState(nextState);
    setImportReview(buildImportReview(nextState, importReview.fileName, importReview.sourceText));
    setDraftSourceVersionId(null);
    flash("Applied local AI import proposal - please review every field");
    return true;
  };

  const copyPlainText = async () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    if (await copyText(plainText)) {
      flash("Copied plain text");
    } else {
      flash("Could not copy text");
    }
  };

  const copyApplicationField = async (text: string, label: string) => {
    if (!text.trim()) {
      flash(`Add ${label.toLocaleLowerCase()} first`);
      return;
    }
    if (await copyText(text)) {
      flash(`Copied ${label.toLocaleLowerCase()}`);
    } else {
      flash("Could not copy text");
    }
  };

  const downloadPlainText = () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    downloadTextFile(plainText, `${safeResumeFilename(state.name || "resume")}.txt`);
    flash("Saved plain text to downloads");
  };

  const downloadDocxFile = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    downloadFile(resumeDocxBlob(state), `${safeResumeFilename(state.name || "resume")}.docx`);
    flash("Saved Word document to downloads");
  };

  const requestDocxExport = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    if (failedChecks.length || importReview) {
      setPendingExportFormat("docx");
      setExportCheckOpen(true);
      return;
    }
    downloadDocxFile();
  };

  const startPrintExport = () => {
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
    };
    document.title = pdfDocumentTitle(safeResumeFilename(state.name || "resume"));
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
  };

  const requestExport = () => {
    if (failedChecks.length || importReview) {
      setPendingExportFormat("pdf");
      setExportCheckOpen(true);
      return;
    }
    startPrintExport();
  };

  // People naturally reach for the browser print shortcut when a PDF is the
  // goal. Keep that familiar route, but do not let it skip the same local
  // review checkpoint used by the visible Export PDF control.
  requestExportRef.current = requestExport;

  useEffect(() => {
    const handlePrintShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLowerCase() !== "p"
      ) {
        return;
      }

      event.preventDefault();
      requestExportRef.current();
    };

    window.addEventListener("keydown", handlePrintShortcut);
    return () => window.removeEventListener("keydown", handlePrintShortcut);
  }, []);

  const exportAnyway = () => {
    setExportCheckOpen(false);
    if (pendingExportFormat === "docx") {
      downloadDocxFile();
      return;
    }
    window.setTimeout(startPrintExport, 120);
  };

  const focusFromExportCheck = (targetId: string) => {
    setExportCheckOpen(false);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  };

  return {
    addCustomSection,
    addBuiltinSection,
    addEntry,
    applicationCopyOpen,
    applyAIImportFix,
    autosaveStatus,
    autosavedAt,
    autosavedState,
    checks,
    clearSavedBrowserData,
    clearResume,
    copyApplicationField,
    copyPlainText,
    importFileInputRef,
    deleteVersion,
    requestDocxExport,
    downloadPlainText,
    externalDraft,
    deletedVersion,
    dismissRecoveryPoint,
    existingVersionForSave,
    exportAnyway,
    exportCheckOpen,
    pendingExportFormat,
    exportFingerprint,
    failedChecks,
    focusCheckTarget,
    focusFromExportCheck,
    hasContent,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importReviewItemsByTarget,
    importReviewStatus,
    importReviewTargets,
    importVersionHistoryBackup,
    isImporting,
    jsonInputRef,
    keepCurrentDraft,
    loadSample,
    mergedHistoryBackup,
    moveEntry,
    moveSection,
    openJson,
    openResumeFile,
    openTextImport,
    openVersionHistoryBackup,
    openVersionSave,
    pageCount,
    pageGuides,
    printBreaks,
    passedChecks,
    plainText,
    recoveryPoint,
    removeEntry,
    removeCustomSection,
    removeBuiltinSection,
    reorderEntry,
    reorderSection,
    toggleSectionHidden,
    requestExport,
    restoreRecoveryPoint,
    restoreVersion,
    resumeRef,
    saveJson,
    saveVersion,
    saveVersionHistoryBackup,
    setDeletedVersion,
    setExportCheckOpen,
    setApplicationCopyOpen,
    setHistoryBackupToImport,
    setImportReview,
    setTextReviewOpen,
    setTextImportOpen,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    state,
    storageIssue,
    swapExperienceTitleAndCompany,
    textReviewOpen,
    textImportOpen,
    tightenLayout,
    toast,
    toggleImportReviewItem,
    completeImportReview,
    undoDeleteVersion,
    undoRemoval,
    updateEntry,
    updateField,
    updateSectionFormat,
    updateSectionTagGroups,
    updateSectionText,
    updateSectionTitle,
    useExternalDraft,
    versionDraftLabel,
    versionDraftNote,
    versionHistory,
    versionSaveOpen,
  };
}
