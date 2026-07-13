"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertCircle,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  FileJson,
  FileText,
  GripVertical,
  History,
  Keyboard,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Target,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Input } from "@/components/ui/input";
import { EntryList, FieldGroup, TextAreaField, TextField } from "@/components/resume-editor/editor-fields";
import { ResumeEditorOverlays } from "@/components/resume-editor/resume-editor-overlays";
import { ResumePreview } from "@/components/resume-editor/resume-preview";
import { ReviewDrawer } from "@/components/resume-editor/review-drawer";
import { VersionHistoryCard } from "@/components/resume-editor/version-history-card";
import { GuidedReview, type GuidedReviewStep } from "@/components/resume-editor/guided-review";
import { SectionNav, type SectionNavItem } from "@/components/resume-editor/section-nav";
import { StartPanel } from "@/components/resume-editor/start-panel";
import { ChangeSummaryGrid, RestoredVersionCard } from "@/components/resume-editor/version-changes";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import {
  ACCENT_PRESETS,
  clampTextScale,
  CUSTOM_SECTION_PRESETS,
  DENSITIES,
  DENSITY_LABELS,
  exportChangeSummary,
  getSectionEntries,
  getSectionTitle,
  HEADING_STYLE_LABELS,
  HEADING_STYLES,
  isBuiltinSection,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  normalizeAccent,
  RESUME_FONTS,
  RESUME_TEMPLATES,
  resolveFontStack,
  SECTION_KEYS,
  SECTION_LABELS,
  TEMPLATE_THEMES,
  type Density,
  type HeadingStyle,
  type ResumeTemplateId,
  type ResumeTheme,
} from "@/lib/resume";
import { buildImportCoverage } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

function ThemeSegment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-md border bg-muted/40 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResumeEditor() {
  const editor = useResumeEditor();
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"editor" | "preview">("editor");
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [jobMatchOpen, setJobMatchOpen] = useState(false);
  const [reviewTour, setReviewTour] = useState<{ kind: "import" | "checks"; index: number } | null>(null);
  // Inline editing on the resume sheet is the primary way to edit; the left
  // form stays available as a fallback (and can be collapsed for a focused
  // canvas).
  const [inlineEdit, setInlineEdit] = useState(true);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  // Turn inline editing off while the browser prints so the exported PDF keeps
  // its normal markup (e.g. clickable contact links) and none of the editing
  // affordances.
  const [printing, setPrinting] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [blankWorkspaceOpen, setBlankWorkspaceOpen] = useState(false);
  // Collapsed editor groups (by group id) so a long resume is quick to scan and
  // scroll without hunting through every open section.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const {
    addCustomSection,
    addBuiltinSection,
    addEntry,
    autosaveStatus,
    checks,
    clearResume,
    dismissRecoveryPoint,
    docxInputRef,
    exportCheckpoint,
    externalDraft,
    exportIsCurrent,
    focusCheckTarget,
    focusFromExportCheck,
    focusFromVersionCompare,
    hasContent,
    historyBackupInputRef,
    importReview,
    importReviewStatus,
    isImporting,
    jsonInputRef,
    keepCurrentDraft,
    loadSample,
    moveEntry,
    moveSection,
    openDocx,
    pageCount,
    pageGuides,
    printBreaks,
    passedChecks,
    pdfInputRef,
    recoveryPoint,
    removeEntry,
    removeCustomSection,
    removeBuiltinSection,
    reorderEntry,
    reorderSection,
    requestExport,
    restoreRecoveryPoint,
    resumeRef,
    saveJson,
    downloadDocx,
    setTextReviewOpen,
    setApplicationCopyOpen,
    setTextImportOpen,
    state,
    storageIssue,
    swapExperienceTitleAndCompany,
    tightenLayout,
    updateEntry,
    updateField,
    updateSectionTitle,
    useExternalDraft,
    toggleImportReviewItem,
    toggleEntryBullet,
    completeImportReview,
    confirmAllImportReviewItems,
    dismissRestoredVersionSummary,
    versionHistory,
    visibleRestoredVersionSummary,
  } = editor;
  const workspaceHasStarted = hasContent || blankWorkspaceOpen;
  const externalDraftChanges = useMemo(
    () => externalDraft ? exportChangeSummary(state, externalDraft) : [],
    [externalDraft, state],
  );

  useEffect(() => {
    const before = () => setPrinting(true);
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const startBlankResume = (template = state.template) => {
    updateField("template", template);
    updateField("theme", TEMPLATE_THEMES[template]);
    setBlankWorkspaceOpen(true);
    window.setTimeout(() => document.getElementById("field-name")?.focus(), 120);
  };

  const updateTheme = (patch: Partial<ResumeTheme>) => updateField("theme", { ...state.theme, ...patch });
  const applyTemplate = (template: ResumeTemplateId) => {
    updateField("template", template);
    updateField("theme", TEMPLATE_THEMES[template]);
  };

  const clearEditor = () => {
    setBlankWorkspaceOpen(false);
    clearResume();
  };

  const toggleGroup = (groupId: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  const expandGroup = useCallback((groupId: string) =>
    setCollapsedGroups((prev) => {
      if (!prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    }), []);
  const groupProps = (groupId: string) => ({
    groupId,
    collapsible: true,
    collapsed: collapsedGroups.has(groupId),
    onToggleCollapsed: () => toggleGroup(groupId),
  });
  // Expand whichever collapsed group holds a jump target before focusing it.
  const revealTarget = useCallback((targetId: string) => {
    const group = document.getElementById(targetId)?.closest("[data-field-group]")?.getAttribute("data-field-group");
    if (group) expandGroup(group);
  }, [expandGroup]);
  const editorGroupIds = ["design", "arrange", "header", "summary", ...state.sectionOrder];
  const allCollapsed = editorGroupIds.every((groupId) => collapsedGroups.has(groupId));

  const focusEditorTarget = useCallback((targetId: string) => {
    setActiveTarget(targetId);
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    revealTarget(targetId);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  }, [revealTarget, focusCheckTarget]);
  const focusEditorFromExportCheck = (targetId: string) => {
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    revealTarget(targetId);
    window.setTimeout(() => focusFromExportCheck(targetId), 0);
  };
  const focusEditorFromVersionCompare = (targetId: string) => {
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    revealTarget(targetId);
    window.setTimeout(() => focusFromVersionCompare(targetId), 0);
  };

  // Keep common tailoring actions within reach for keyboard-first editing.
  // The shortcut is deliberately scoped to the form editor so it cannot steal
  // ordinary typing or inline editing on the resume sheet.
  useEffect(() => {
    const focusShortcutTarget = (targetId: string) => {
      setActiveTarget(targetId);
      // The affected field is already in the open section that has focus. Wait
      // for its React update, then focus it directly—without the longer guided
      // review delay that could otherwise override a user's next action.
      window.setTimeout(() => focusCheckTarget(targetId), 0);
    };

    const handleEditorShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        !event.altKey ||
        !event.shiftKey
      ) {
        return;
      }

      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || !focused.closest("#resume-editor-pane")) return;

      const sectionElement = focused.closest<HTMLElement>("[data-editor-section]");
      const section = sectionElement?.dataset.editorSection;
      if (!section) return;

      if (event.code === "KeyN") {
        if (section === "skills") return;
        event.preventDefault();
        const nextIndex = getSectionEntries(state, section).length;
        addEntry(section);
        focusShortcutTarget(`field-${section}-${nextIndex}-title`);
        return;
      }

      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const entryElement = focused.closest<HTMLElement>("[data-editor-entry]");

      if (entryElement) {
        const entryIndex = Number(entryElement.dataset.editorEntryIndex);
        const entries = getSectionEntries(state, section);
        const targetIndex = entryIndex + direction;
        if (!Number.isInteger(entryIndex) || targetIndex < 0 || targetIndex >= entries.length) return;
        event.preventDefault();
        const fieldMatch = focused.id.match(new RegExp(`^field-${section}-${entryIndex}-(title|subtitle|meta|details)$`));
        const field = fieldMatch?.[1] ?? "title";
        moveEntry(section, entryIndex, direction);
        focusShortcutTarget(`field-${section}-${targetIndex}-${field}`);
        return;
      }

      const sectionIndex = state.sectionOrder.indexOf(section);
      const targetIndex = sectionIndex + direction;
      if (targetIndex < 0 || targetIndex >= state.sectionOrder.length) return;
      event.preventDefault();
      moveSection(section, direction);
      focusShortcutTarget(`section-title-${section}`);
    };

    window.addEventListener("keydown", handleEditorShortcut);
    return () => window.removeEventListener("keydown", handleEditorShortcut);
  }, [addEntry, focusCheckTarget, moveEntry, moveSection, state]);

  const importCoverage = importReview?.coverage ?? (importReview ? buildImportCoverage(state, importReview.sourceText) : []);
  const importSkippedCoverage = importCoverage.filter((item) => item.sourceDetected && !item.detected);

  // Guided-review tour steps. Import: confirm each imported field, then flag any
  // source section the importer skipped. Checks: walk each readiness check.
  const importTourSteps: GuidedReviewStep[] = importReview
    ? [
        ...importReview.items.map((item, itemIndex) => {
          const confirmed = Boolean(importReview.reviewedItemIds?.includes(item.id));
          return {
            id: `item-${item.id}`,
            targetId: item.targetId,
            eyebrow: `Imported field ${itemIndex + 1} of ${importReview.items.length}`,
            title: item.label,
            description: item.detail,
            excerpt: item.sourceExcerpt,
            tone: (confirmed ? "ok" : "warn") as GuidedReviewStep["tone"],
            done: confirmed,
            action: {
              label: confirmed ? "Confirmed" : "Confirm this field",
              run: () => toggleImportReviewItem(item.id),
            },
          } satisfies GuidedReviewStep;
        }),
        ...importSkippedCoverage.map((item) => ({
          id: `coverage-${item.id}`,
          targetId: item.targetId,
          eyebrow: "Possible skipped section",
          title: item.label,
          description: item.detail,
          excerpt: item.sourceExcerpt,
          tone: "warn" as GuidedReviewStep["tone"],
          action: {
            label: "Go to this section",
            run: () => {
              setReviewTour(null);
              focusEditorTarget(item.targetId);
            },
          },
        } satisfies GuidedReviewStep)),
      ]
    : [];

  const checksTourSteps: GuidedReviewStep[] = checks.map((check) => ({
    id: check.id,
    targetId: check.targetId,
    eyebrow: "Resume check",
    title: check.label,
    description: check.ok && !check.advisory ? check.detail : `${check.detail} ${check.guidance}`,
    tone: (check.advisory ? "info" : check.ok ? "ok" : "warn") as GuidedReviewStep["tone"],
    done: check.ok,
    action: check.ok && !check.advisory ? undefined : { label: check.actionLabel, run: () => focusEditorTarget(check.targetId) },
  } satisfies GuidedReviewStep));

  const startImportTour = () => {
    if (!importReview) return;
    const firstUnconfirmed = importReview.items.findIndex((item) => !importReview.reviewedItemIds?.includes(item.id));
    setToolsOpen(false);
    setMobileWorkspaceView("editor");
    setReviewTour({ kind: "import", index: firstUnconfirmed >= 0 ? firstUnconfirmed : 0 });
  };
  const startChecksTour = () => {
    setToolsOpen(false);
    setMobileWorkspaceView("editor");
    setReviewTour({ kind: "checks", index: 0 });
  };
  const tourSteps = reviewTour?.kind === "import" ? importTourSteps : reviewTour?.kind === "checks" ? checksTourSteps : [];

  const checksReady = passedChecks === checks.length;
  const exportStale = Boolean(exportCheckpoint) && !exportIsCurrent;
  const canTightenLayout = state.theme.density !== "compact" || state.textScale > MIN_TEXT_SCALE;
  const removedBuiltinSections = SECTION_KEYS.filter((section) => !state.sectionOrder.includes(section));
  const navItems: SectionNavItem[] = workspaceHasStarted
    ? [
        { id: "edit-layout", label: "Layout" },
        { id: "edit-header", label: "Header" },
        { id: "edit-summary", label: "Summary" },
        ...state.sectionOrder.map((section) => ({
          id: `edit-section-${section}`,
          label: getSectionTitle(state, section).trim() || "Untitled section",
        })),
      ]
    : [];

  const startSectionDrag = (event: DragEvent<HTMLElement>, section: string, title: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-resume-section", section);
    event.dataTransfer.setData("text/plain", `section:${section}`);

    const dragImage = document.createElement("div");
    dragImage.textContent = `Moving ${title.trim() || "Untitled section"}`;
    Object.assign(dragImage.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      display: "flex",
      alignItems: "center",
      border: "1px solid rgb(148 163 184)",
      borderRadius: "6px",
      background: "white",
      boxShadow: "0 8px 20px rgb(15 23 42 / 22%)",
      padding: "8px 12px",
      color: "rgb(15 23 42)",
      fontSize: "13px",
      fontWeight: "600",
    });
    document.body.append(dragImage);
    event.dataTransfer.setDragImage(dragImage, 18, 18);
    window.setTimeout(() => dragImage.remove(), 0);
    setDraggedSection(section);
    setDropTargetSection(null);
  };

  const finishSectionDrag = () => {
    setDraggedSection(null);
    setDropTargetSection(null);
  };

  // Scale the 8.5in sheet to fit whatever width the preview column actually has,
  // on every breakpoint. Keeps the resume fully visible instead of clipping the
  // left/right edges on narrower desktop splits, and unifies the mobile path.
  const SHEET_WIDTH_PX = 8.5 * 96;
  const [sheetHeight, setSheetHeight] = useState(11 * 96);
  useEffect(() => {
    const wrap = previewWrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const available = wrap.clientWidth;
      if (available > 0) setPreviewScale(Math.min(1, Math.max(0.2, available / SHEET_WIDTH_PX)));
      const sheet = resumeRef.current;
      if (sheet) setSheetHeight(sheet.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    if (resumeRef.current) observer.observe(resumeRef.current);
    return () => observer.disconnect();
  }, [SHEET_WIDTH_PX, resumeRef]);

  const previewFrameStyle = {
    "--resume-preview-scale": previewScale,
    "--resume-preview-frame-width": `${Math.round(SHEET_WIDTH_PX * previewScale)}px`,
    "--resume-preview-frame-height": `${Math.round(sheetHeight * previewScale)}px`,
  } as CSSProperties;

  return (
    <>
      <header className="app-chrome sticky top-0 z-50 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
              Private workspace
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">PrivaCV</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasContent && !storageIssue ? (
              <span
                data-autosave-status={autosaveStatus}
                aria-label={`Local autosave: ${autosaveStatus === "saving" ? "saving" : autosaveStatus === "conflict" ? "paused for another tab" : "saved"}`}
                title={
                  autosaveStatus === "saving"
                    ? "Saving this resume in this browser"
                    : autosaveStatus === "conflict"
                      ? "Autosave is paused until you choose which tab's draft to keep."
                    : "Saved in this browser. Use Save JSON for a portable backup."
                }
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs font-medium",
                  autosaveStatus === "saving" ? "text-muted-foreground" : autosaveStatus === "conflict" ? "text-amber-700" : "text-emerald-700",
                )}
              >
                {autosaveStatus === "saving" ? (
                  <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                ) : autosaveStatus === "conflict" ? (
                  <span className="inline-flex size-3.5 items-center justify-center rounded-full border border-current text-[10px] leading-none" aria-hidden="true">!</span>
                ) : (
                  <Check className="size-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">
                  {autosaveStatus === "saving" ? "Saving locally" : autosaveStatus === "conflict" ? "Autosave paused" : "Saved locally"}
                </span>
              </span>
            ) : null}
            {hasContent || versionHistory.length ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setToolsOpen(true)}
                aria-label="Open review tools"
                className="gap-2"
              >
                <SlidersHorizontal />
                <span className="hidden sm:inline">Tools</span>
                {hasContent ? (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                      checksReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900",
                    )}
                  >
                    {passedChecks}/{checks.length}
                  </span>
                ) : null}
              </Button>
            ) : null}
            {hasContent || versionHistory.length ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setVersionsOpen(true)}
                aria-label="Open version history"
                className="gap-2"
              >
                <History />
                <span className="hidden sm:inline">Versions</span>
                {versionHistory.length ? (
                  <span className="hidden min-w-5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:inline">
                    {versionHistory.length}
                  </span>
                ) : null}
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={requestExport}
              aria-label={exportStale ? "Export PDF (resume changed since last export)" : "Export PDF"}
              title={exportStale ? "Resume changed since your last export — export again" : "Export PDF (Cmd/Ctrl+P)"}
              className="relative"
            >
              <Printer /> <span className="hidden sm:inline">Export PDF</span>
              <span className="sm:hidden">Export</span>
              <kbd className="hidden rounded border border-primary-foreground/35 px-1 py-px text-[10px] font-medium leading-none opacity-80 2xl:inline">
                Cmd/Ctrl P
              </kbd>
              {exportStale ? (
                <span
                  className="absolute -right-1 -top-1 size-2.5 rounded-full bg-amber-400 ring-2 ring-card"
                  aria-hidden="true"
                />
              ) : null}
            </Button>
            <Menu>
              <MenuTrigger>
                <Button type="button" variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Import</MenuLabel>
                <MenuItem onSelect={() => setTextImportOpen(true)}>
                  <ClipboardPaste /> Paste text
                </MenuItem>
                <MenuItem onSelect={() => pdfInputRef.current?.click()} disabled={isImporting}>
                  <Upload /> {isImporting ? "Importing" : "Import PDF"}
                </MenuItem>
                <MenuItem onSelect={() => docxInputRef.current?.click()} disabled={isImporting}>
                  <FileText /> {isImporting ? "Importing" : "Import Word (.docx)"}
                </MenuItem>
                <MenuSeparator />
                <MenuLabel>Export & files</MenuLabel>
                <MenuItem onSelect={() => setJobMatchOpen(true)} disabled={!hasContent}>
                  <Target /> Tailor to job
                </MenuItem>
                <MenuItem onSelect={() => setApplicationCopyOpen(true)} disabled={!hasContent}>
                  <ClipboardCopy /> Copy for applications
                </MenuItem>
                <MenuItem onSelect={() => setTextReviewOpen(true)}>
                  <ClipboardCopy /> Review Text
                </MenuItem>
                <MenuItem onSelect={downloadDocx} disabled={!hasContent}>
                  <FileText /> Download Word (.docx)
                </MenuItem>
                <MenuItem onSelect={saveJson}>
                  <Download /> Save JSON
                </MenuItem>
                <MenuItem onSelect={() => jsonInputRef.current?.click()}>
                  <FileJson /> Open JSON
                </MenuItem>
                <MenuSeparator />
                <MenuItem onSelect={loadSample}>
                  <FileText /> Sample
                </MenuItem>
                <MenuItem
                  destructive
                  onSelect={() => {
                    if (window.confirm("Clear all fields? You can restore this version from the recovery card.")) {
                      clearEditor();
                    }
                  }}
                >
                  <RotateCcw /> Clear
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </div>
        <div className="border-t px-4 py-2 lg:hidden">
          <div className="grid grid-cols-2 rounded-md border bg-muted/30 p-1" aria-label="Resume workspace view">
            <Button
              id="mobile-editor-tab"
              type="button"
              size="sm"
              variant={mobileWorkspaceView === "editor" ? "secondary" : "ghost"}
              aria-pressed={mobileWorkspaceView === "editor"}
              aria-controls="resume-editor-pane"
              onClick={() => setMobileWorkspaceView("editor")}
            >
              <FileText /> Edit resume
            </Button>
            <Button
              id="mobile-preview-tab"
              type="button"
              size="sm"
              variant={mobileWorkspaceView === "preview" ? "secondary" : "ghost"}
              aria-pressed={mobileWorkspaceView === "preview"}
              aria-controls="resume-preview-pane"
              onClick={() => setMobileWorkspaceView("preview")}
            >
              <Eye /> Preview
            </Button>
          </div>
        </div>
      </header>

      <main className={cn("app-shell grid min-h-[calc(100vh-73px)] grid-cols-1", editorCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(390px,1fr)_minmax(440px,1fr)]")}>
        <section
          id="resume-editor-pane"
          aria-label="Resume editor"
          onFocusCapture={(event) => {
            const target = event.target as HTMLElement;
            if (target.id?.startsWith("field-") || target.id?.startsWith("section-title-")) setActiveTarget(target.id);
          }}
          className={cn(
            "editor-pane relative overflow-y-auto border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:px-6 lg:pb-6 lg:pt-0",
            mobileWorkspaceView !== "editor" && "mobile-workspace-hidden",
            editorCollapsed && "lg:hidden",
          )}
        >
          {/* The section nav sits flush at the top of the pane (lg:pt-0) so it
              can stick cleanly while scrolling. Everything that can appear
              above it instead — the start panel, or a pre-nav banner — needs a
              desktop-only inset so it is not flush against the header. A flow
              spacer (not pane padding) keeps the sticky nav flush once
              scrolled. The one case with no inset is the bare editor, where the
              sticky nav is meant to sit against the header. */}
          {!workspaceHasStarted || storageIssue || externalDraft || recoveryPoint || importReview || visibleRestoredVersionSummary ? (
            <div aria-hidden className="hidden lg:block lg:h-6" />
          ) : null}

          {!workspaceHasStarted ? (
            <StartPanel
              isImporting={isImporting}
              storageIssue={storageIssue}
              onImportDocx={() => docxInputRef.current?.click()}
              onImportPdf={() => pdfInputRef.current?.click()}
              onImportText={() => setTextImportOpen(true)}
              onLoadSample={loadSample}
              onOpenJson={() => jsonInputRef.current?.click()}
              onOpenCheckpointBackup={() => historyBackupInputRef.current?.click()}
              onStartBlank={startBlankResume}
              onChooseTemplate={startBlankResume}
            />
          ) : null}

          {storageIssue ? (
            <Alert className="mb-6 border-amber-300 bg-amber-50/70">
              <AlertCircle className="h-4 w-4 text-amber-900" />
              <AlertTitle className="text-amber-950">Browser autosave is unavailable</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                <span>Your edits remain open here, but may not survive a refresh. Save a JSON copy before closing this tab.</span>
                <Button type="button" variant="outline" size="sm" className="w-fit border-amber-400 bg-background" onClick={saveJson}>
                  <Download /> Save JSON copy
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {externalDraft ? (
            <Alert className="mb-6 border-sky-300 bg-sky-50/70">
              <AlertCircle className="h-4 w-4 text-sky-900" />
              <AlertTitle className="text-sky-950">A different resume was saved in another tab</AlertTitle>
              <AlertDescription className="grid gap-3 text-sky-950">
                <span>Autosave is paused here so this tab does not overwrite the other draft. Review the changed areas, then choose which one to keep. If it was imported, its matching review checklist comes with it.</span>
                {externalDraftChanges.length ? (
                  <ChangeSummaryGrid changes={externalDraftChanges} beforeLabel="This tab" afterLabel="Saved tab" />
                ) : null}
                <span className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="border-sky-300 bg-background" onClick={useExternalDraft}>
                    Use saved draft
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="border-sky-300 bg-background" onClick={keepCurrentDraft}>
                    Keep this draft
                  </Button>
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          {recoveryPoint ? (
            <Card className="mb-6 border-sky-200 bg-sky-50/60">
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-900">
                    Restore point saved
                  </CardDescription>
                  <CardTitle className="text-base">You can go back to the previous resume.</CardTitle>
                  <CardDescription>
                    {recoveryPoint.label}. This recovery point stays in this browser tab until you dismiss or restore it.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={restoreRecoveryPoint}>
                    <Undo2 /> Restore previous
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={dismissRecoveryPoint}>
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : null}

          {importReview ? (
            <Card id="import-review-panel" className="mb-6 border-amber-200 bg-amber-50/60">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                      Import review
                    </CardDescription>
                    <CardTitle className="text-base">Review the imported fields</CardTitle>
                    <CardDescription>
                      Imported from {importReview.fileName}. Step through each suggested field, edit anything that looks off, and confirm it.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-amber-300 bg-background tabular-nums text-amber-950">
                    {importReviewStatus?.reviewedCount ?? 0}/{importReview.items.length}
                  </Badge>
                </div>
                {importSkippedCoverage.length ? (
                  <CardDescription className="text-amber-900">
                    {importSkippedCoverage.length} source {importSkippedCoverage.length === 1 ? "section was" : "sections were"} found but not imported — the walkthrough flags {importSkippedCoverage.length === 1 ? "it" : "them"} so you can add {importSkippedCoverage.length === 1 ? "it" : "them"} back.
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => startImportTour()}>
                  <ArrowRight /> {(importReviewStatus?.reviewedCount ?? 0) > 0 ? "Continue walkthrough" : "Start walkthrough"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={confirmAllImportReviewItems}
                  disabled={importReviewStatus?.isComplete}
                >
                  <Check /> I reviewed all imported fields
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={completeImportReview} disabled={!importReviewStatus?.isComplete}>
                  <Check /> Finish review
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {visibleRestoredVersionSummary ? (
            <RestoredVersionCard
              summary={visibleRestoredVersionSummary}
              onDismiss={dismissRestoredVersionSummary}
              onFocus={focusEditorTarget}
            />
          ) : null}

          {workspaceHasStarted ? <SectionNav items={navItems} /> : null}

          {workspaceHasStarted ? (
            <div className="-mt-2 mb-1 flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => setShortcutsOpen(true)}
              >
                <Keyboard /> Shortcuts
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => setCollapsedGroups(allCollapsed ? new Set() : new Set(editorGroupIds))}
              >
                {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />} {allCollapsed ? "Expand all" : "Collapse all"}
              </Button>
            </div>
          ) : null}

          {workspaceHasStarted ? (
            <div className="space-y-6">
              <FieldGroup id="edit-layout" title="Design" {...groupProps("design")}>
                <p className="text-xs leading-snug text-muted-foreground">
                  Start from a preset, then fine-tune font, color, and layout. Every option stays clean and ATS-readable.
                </p>
                <div className="grid gap-2 sm:grid-cols-2" aria-label="Resume templates">
                  {RESUME_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={state.template === template.id}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        state.template === template.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-background",
                      )}
                      onClick={() => applyTemplate(template.id)}
                    >
                      <span className="block text-sm font-semibold">{template.label}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">{template.description}</span>
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 rounded-md border bg-muted/20 p-3">
                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Font</span>
                    <select
                      value={state.theme.font}
                      onChange={(event) => updateTheme({ font: event.target.value })}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{ fontFamily: resolveFontStack(state.theme.font) }}
                      aria-label="Resume font"
                    >
                      {RESUME_FONTS.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.label} · {font.kind}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Accent color</span>
                    <div className="flex flex-wrap items-center gap-1.5" aria-label="Accent color">
                      {ACCENT_PRESETS.map((accent) => {
                        const selected = normalizeAccent(state.theme.accent).toLowerCase() === accent.value.toLowerCase();
                        return (
                          <button
                            key={accent.id}
                            type="button"
                            aria-pressed={selected}
                            aria-label={accent.label}
                            title={accent.label}
                            onClick={() => updateTheme({ accent: accent.value })}
                            className={cn(
                              "size-7 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                              selected ? "ring-2 ring-ring ring-offset-1" : "hover:scale-110",
                            )}
                            style={{ backgroundColor: accent.value, borderColor: "rgb(0 0 0 / 12%)" }}
                          />
                        );
                      })}
                      <label className="ml-1 inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">
                        Custom
                        <input
                          type="color"
                          value={normalizeAccent(state.theme.accent)}
                          onChange={(event) => updateTheme({ accent: event.target.value })}
                          className="size-5 cursor-pointer rounded border-0 bg-transparent p-0"
                          aria-label="Custom accent color"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <ThemeSegment
                      label="Header"
                      value={state.theme.headerAlign}
                      options={[
                        { value: "left", label: "Left" },
                        { value: "center", label: "Center" },
                      ]}
                      onChange={(headerAlign) => updateTheme({ headerAlign })}
                    />
                    <ThemeSegment
                      label="Density"
                      value={state.theme.density}
                      options={DENSITIES.map((density) => ({ value: density as Density, label: DENSITY_LABELS[density] }))}
                      onChange={(density) => updateTheme({ density })}
                    />
                  </div>

                  <ThemeSegment
                    label="Section headings"
                    value={state.theme.headingStyle}
                    options={HEADING_STYLES.map((style) => ({ value: style as HeadingStyle, label: HEADING_STYLE_LABELS[style] }))}
                    onChange={(headingStyle) => updateTheme({ headingStyle })}
                  />

                  <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
                    <span className="text-xs font-medium">Divider under header</span>
                    <input
                      type="checkbox"
                      checked={state.theme.headerDivider}
                      onChange={(event) => updateTheme({ headerDivider: event.target.checked })}
                      className="size-4 accent-foreground"
                      aria-label="Divider under header"
                    />
                  </label>
                </div>
              </FieldGroup>
              <FieldGroup title="Arrange sections" {...groupProps("arrange")}>
                <p className="text-xs leading-snug text-muted-foreground">
                  Drag sections into the order you want, from top to bottom. The preview updates immediately.
                </p>
                <div className="mt-3 space-y-2" id="section-order-controls" tabIndex={-1}>
                  {state.sectionOrder.map((section, sectionIndex) => {
                    const title = getSectionTitle(state, section);
                    const displayTitle = title.trim() || "Untitled section";
                    return (
                      <div
                        key={section}
                        data-arrange-section={section}
                        data-dragging={draggedSection === section || undefined}
                        data-drop-target={dropTargetSection === section && draggedSection !== section || undefined}
                        className={cn(
                          "flex items-center gap-2 rounded-md border bg-background p-2 transition-[background-color,border-color,box-shadow,opacity] hover:bg-muted/30",
                          draggedSection === section && "opacity-45 ring-2 ring-muted-foreground/20",
                          dropTargetSection === section && draggedSection !== section && "border-primary bg-primary/5 ring-2 ring-primary/25",
                        )}
                        onDragEnter={(event) => {
                          if (draggedSection && (event.dataTransfer.types.includes("application/x-resume-section") || event.dataTransfer.types.includes("text/plain"))) {
                            setDropTargetSection(section);
                          }
                        }}
                        onDragOver={(event) => {
                          if (draggedSection && (event.dataTransfer.types.includes("application/x-resume-section") || event.dataTransfer.types.includes("text/plain"))) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDropTargetSection(section);
                          }
                        }}
                        onDrop={(event) => {
                          const customData = event.dataTransfer.getData("application/x-resume-section");
                          const plainData = event.dataTransfer.getData("text/plain");
                          if (!customData && !plainData.startsWith("section:")) return;
                          const draggedSection = customData || plainData.replace(/^section:/, "");
                          if (draggedSection === section) return;
                          event.preventDefault();
                          reorderSection(draggedSection, sectionIndex);
                          finishSectionDrag();
                        }}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                          {sectionIndex + 1}
                        </span>
                        <span
                          draggable
                          aria-hidden="true"
                          title="Drag to reorder; use the section move buttons for keyboard reordering"
                          className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing"
                          onDragStart={(event) => startSectionDrag(event, section, title)}
                          onDragEnd={finishSectionDrag}
                        >
                          <GripVertical className="size-4" />
                        </span>
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                          onClick={() => focusEditorTarget(`section-title-${section}`)}
                        >
                          {displayTitle}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </FieldGroup>
              <FieldGroup id="edit-header" title="Header" reviewRegion {...groupProps("header")}>
                <TextField
                  id="field-name"
                  label="Full Name"
                  value={state.name}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  spellCheck={false}
                  onChange={(value) => updateField("name", value)}
                />
                <TextField
                  id="field-title"
                  label="Title / Role"
                  value={state.title}
                  placeholder="Senior Software Engineer"
                  autoComplete="organization-title"
                  spellCheck
                  onChange={(value) => updateField("title", value)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    id="field-email"
                    label="Email"
                    value={state.email}
                    placeholder="jane@example.com"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    spellCheck={false}
                    onChange={(value) => updateField("email", value)}
                  />
                  <TextField
                    id="field-phone"
                    label="Phone"
                    value={state.phone}
                    placeholder="(555) 123-4567"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    spellCheck={false}
                    onChange={(value) => updateField("phone", value)}
                  />
                </div>
                <TextField
                  id="field-location"
                  label="Location"
                  value={state.location}
                  placeholder="San Francisco, CA"
                  autoComplete="address-level2"
                  spellCheck={false}
                  onChange={(value) => updateField("location", value)}
                />
                <TextField
                  id="field-website"
                  label="Website / LinkedIn"
                  value={state.website}
                  placeholder="linkedin.com/in/janedoe"
                  type="url"
                  autoComplete="url"
                  inputMode="url"
                  spellCheck={false}
                  onChange={(value) => updateField("website", value)}
                />
              </FieldGroup>

              <FieldGroup id="edit-summary" title="Summary" reviewRegion {...groupProps("summary")}>
                <TextAreaField
                  id="field-summary"
                  label="Professional Summary"
                  value={state.summary}
                  placeholder="Brief overview of your experience and strengths."
                  onChange={(value) => updateField("summary", value)}
                />
              </FieldGroup>

              {state.sectionOrder.map((section, sectionIndex) => {
                const sectionTitle = getSectionTitle(state, section);
                const sectionDisplayTitle = sectionTitle.trim() || "Untitled section";
                const sectionTitleLabel = sectionTitle.trim() ? `${sectionTitle} section title` : "Untitled section title";
                const entries = getSectionEntries(state, section);
                const custom = !isBuiltinSection(section);
                const sectionIsActive =
                  activeTarget === `section-title-${section}` ||
                  activeTarget === `field-${section}` ||
                  activeTarget?.startsWith(`field-${section}-`);
                return (
                <div
                  key={section}
                  id={`edit-section-${section}`}
                  data-editor-section={section}
                  className="scroll-mt-32 lg:scroll-mt-16"
                  data-dragging={draggedSection === section || undefined}
                  data-drop-target={dropTargetSection === section && draggedSection !== section || undefined}
                  onDragEnter={(event) => {
                    if (draggedSection && (event.dataTransfer.types.includes("application/x-resume-section") || event.dataTransfer.types.includes("text/plain"))) {
                      setDropTargetSection(section);
                    }
                  }}
                  onDragOver={(event) => {
                    if (draggedSection && (event.dataTransfer.types.includes("application/x-resume-section") || event.dataTransfer.types.includes("text/plain"))) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropTargetSection(section);
                    }
                  }}
                  onDrop={(event) => {
                    const customData = event.dataTransfer.getData("application/x-resume-section");
                    const plainData = event.dataTransfer.getData("text/plain");
                    if (!customData && !plainData.startsWith("section:")) return;
                    const draggedSection = customData || plainData.replace(/^section:/, "");
                    if (!draggedSection || draggedSection === section) return;
                    event.preventDefault();
                    reorderSection(draggedSection, sectionIndex);
                    finishSectionDrag();
                  }}
                >
                <FieldGroup
                  {...groupProps(section)}
                  reviewRegion={section === "skills"}
                  className={cn(
                    sectionIsActive && "rounded-md bg-sky-50/70 px-3 pt-3 ring-1 ring-sky-200",
                    draggedSection === section && "rounded-md opacity-45",
                    dropTargetSection === section && draggedSection !== section && "rounded-md bg-primary/5 px-3 pt-3 ring-2 ring-primary/25",
                  )}
                  title={
                    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Section title
                      <Input
                        id={`section-title-${section}`}
                        value={sectionTitle}
                        className="h-8 min-w-0 normal-case tracking-normal text-foreground"
                        aria-label={sectionTitleLabel}
                        onChange={(event) => updateSectionTitle(section, event.target.value)}
                      />
                    </label>
                  }
                  actions={
                    <div
                      className="flex items-center gap-1 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <span
                        draggable
                        aria-hidden="true"
                        title="Drag to reorder; use the move buttons for keyboard reordering"
                        className="inline-flex size-9 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                        onDragStart={(event) => startSectionDrag(event, section, sectionTitle)}
                        onDragEnd={finishSectionDrag}
                      >
                        <GripVertical className="size-4" />
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Move ${sectionDisplayTitle} up`}
                        aria-keyshortcuts="Alt+Shift+ArrowUp"
                        title="Move section up (Alt+Shift+Up when focused in this section)"
                        disabled={sectionIndex === 0}
                        onClick={() => moveSection(section, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Move ${sectionDisplayTitle} down`}
                        aria-keyshortcuts="Alt+Shift+ArrowDown"
                        title="Move section down (Alt+Shift+Down when focused in this section)"
                        disabled={sectionIndex === state.sectionOrder.length - 1}
                        onClick={() => moveSection(section, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      {section !== "skills" ? (
                        <Button
                          id={`add-${section}-entry`}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-keyshortcuts="Alt+Shift+N"
                          title="Add entry (Alt+Shift+N when focused in this section)"
                          onClick={() => addEntry(section)}
                        >
                          Add
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${sectionDisplayTitle} section`}
                        title="Remove section (Undo available)"
                        onClick={() => custom ? removeCustomSection(section) : removeBuiltinSection(section)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  }
                >
                  {section === "skills" ? (
                    <TextAreaField
                      id="field-skills"
                      label={'Skills (one group per line, e.g. "Languages: Python, Go")'}
                      value={state.skills}
                      placeholder={"Languages: Python, JavaScript, Go\nTools: Docker, Kubernetes, AWS"}
                      onChange={(value) => updateField("skills", value)}
                    />
                  ) : (
                    <EntryList
                      section={section}
                      sectionLabel={sectionTitle}
                      entries={entries}
                      onUpdate={updateEntry}
                      onMove={moveEntry}
                      onReorder={reorderEntry}
                      onRemove={removeEntry}
                      onSwapTitleAndSubtitle={swapExperienceTitleAndCompany}
                      onToggleBullet={toggleEntryBullet}
                    />
                  )}
                </FieldGroup>
                </div>
              );})}
              <div className="rounded-md border border-dashed bg-muted/20 p-3">
                <p className="text-sm font-medium">Add a relevant section</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Choose a familiar heading or make your own. Keep only details that strengthen this application.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {removedBuiltinSections.map((section) => (
                    <Button
                      key={section}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        addBuiltinSection(section);
                        focusEditorTarget(`section-title-${section}`);
                      }}
                    >
                      <Plus /> {SECTION_LABELS[section]}
                    </Button>
                  ))}
                  {CUSTOM_SECTION_PRESETS.map((title) => (
                    <Button
                      key={title}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const id = addCustomSection(title);
                        focusEditorTarget(`section-title-${id}`);
                      }}
                    >
                      <Plus /> {title}
                    </Button>
                  ))}
                  <Button
                    id="add-custom-section"
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const id = addCustomSection();
                      focusEditorTarget(`section-title-${id}`);
                    }}
                  >
                    <Plus /> Add custom section
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section
          id="resume-preview-pane"
          className={cn(
            "preview-pane overflow-y-auto bg-muted/70 p-4 lg:max-h-[calc(100vh-73px)] lg:p-7",
            mobileWorkspaceView !== "preview" && "mobile-workspace-hidden",
          )}
          aria-label="Resume preview"
        >
          <div ref={previewWrapRef} className="mx-auto flex w-full max-w-[8.5in] flex-col items-center gap-3">
            <div className="app-chrome flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex min-w-0 items-center gap-3">
                <label className="hidden items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                  <span className="whitespace-nowrap">Text size</span>
                  <input
                    id="resume-text-scale"
                    className="min-w-24 accent-foreground"
                    type="range"
                    min={MIN_TEXT_SCALE}
                    max={MAX_TEXT_SCALE}
                    step="0.02"
                    value={state.textScale}
                    onChange={(event) => updateField("textScale", clampTextScale(Number(event.target.value)))}
                    aria-label="Resume text size"
                  />
                  <output className="w-10 text-right tabular-nums">{Math.round(state.textScale * 100)}%</output>
                </label>
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {pageCount} {pageCount === 1 ? "page" : "pages"} in preview
                  </p>
                  {pageCount > 1 && canTightenLayout ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-xs"
                      onClick={tightenLayout}
                      title="Uses compact spacing first, then reduces text size by 2%. Your resume content stays unchanged."
                    >
                      {state.theme.density === "compact" ? "Reduce text 2%" : "Try compact spacing"}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant={inlineEdit ? "secondary" : "outline"}
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-pressed={inlineEdit}
                  aria-label={inlineEdit ? "Editing on sheet" : "Edit on sheet"}
                  onClick={() => setInlineEdit((value) => !value)}
                  title={inlineEdit ? "Inline editing is on — click resume text to edit it" : "Turn on inline editing (click resume text to edit)"}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden lg:inline-flex"
                  aria-pressed={editorCollapsed}
                  aria-label={editorCollapsed ? "Show editor" : "Hide editor"}
                  title={editorCollapsed ? "Show the editor panel" : "Hide the editor panel for a focused canvas"}
                  onClick={() => setEditorCollapsed((value) => !value)}
                >
                  {editorCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
                <Button type="button" variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileWorkspaceView("editor")}>
                  <FileText /> Edit resume
                </Button>
              </div>
            </div>
            <div className="resume-preview-sheet-frame" style={previewFrameStyle}>
              <ResumePreview
                state={state}
                pageCount={pageCount}
                pageGuides={pageGuides}
                printBreaks={printBreaks}
                ref={resumeRef}
                activeTarget={activeTarget}
                onTargetSelect={focusEditorTarget}
                editable={inlineEdit && workspaceHasStarted && !printing}
                onEditField={(field, value) => updateField(field as Parameters<typeof updateField>[0], value)}
                onEditSectionTitle={updateSectionTitle}
                onEditEntry={updateEntry}
              />
            </div>
          </div>
        </section>
      </main>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              Use these while focus is in the form editor. The visible buttons remain available for every action.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2">
              <dt>Add an entry in this section</dt>
              <dd><kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-medium">Alt + Shift + N</kbd></dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2">
              <dt>Move the focused entry</dt>
              <dd><kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-medium">Alt + Shift + ↑ / ↓</kbd></dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2">
              <dt>Move the current section</dt>
              <dd><kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-medium">Alt + Shift + ↑ / ↓</kbd></dd>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-2">
              <dt>Review and export PDF</dt>
              <dd><kbd className="rounded border bg-background px-1.5 py-0.5 text-xs font-medium">Cmd / Ctrl + P</kbd></dd>
            </div>
          </dl>
        </DialogContent>
      </Dialog>

      <ReviewDrawer
        editor={editor}
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        onFocusTarget={focusEditorTarget}
        onStartChecksReview={startChecksTour}
      />

      <VersionHistoryCard
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        hasContent={hasContent}
        versions={editor.versionHistory}
        currentFingerprint={editor.exportFingerprint}
        deletedVersion={editor.deletedVersion}
        onSave={editor.openVersionSave}
        onSaveBackup={editor.saveVersionHistoryBackup}
        onOpenBackup={() => editor.historyBackupInputRef.current?.click()}
        onCompareCurrent={(item) => {
          setVersionsOpen(false);
          editor.setVersionCompareTarget({ baseId: item.id, targetId: "current" });
        }}
        onRestore={(item) => {
          editor.restoreVersion(item);
          setVersionsOpen(false);
        }}
        onDelete={editor.deleteVersion}
        onUndoDelete={editor.undoDeleteVersion}
        onDismissDeleted={() => editor.setDeletedVersion(null)}
      />

      <GuidedReview
        open={Boolean(reviewTour) && tourSteps.length > 0}
        title={reviewTour?.kind === "import" ? "Import review" : "Resume check"}
        steps={tourSteps}
        index={reviewTour?.index ?? 0}
        onIndexChange={(nextIndex) => setReviewTour((current) => (current ? { ...current, index: nextIndex } : current))}
        onClose={() => setReviewTour(null)}
        onFinish={() => {
          if (reviewTour?.kind === "import") completeImportReview();
          setReviewTour(null);
        }}
        finishLabel={reviewTour?.kind === "import" ? "Finish review" : "Done"}
        finishDisabled={reviewTour?.kind === "import" && !importReviewStatus?.isComplete}
      />

      <ResumeEditorOverlays
        editor={{
          ...editor,
          focusFromExportCheck: focusEditorFromExportCheck,
          focusFromVersionCompare: focusEditorFromVersionCompare,
        }}
        jobMatchOpen={jobMatchOpen}
        setJobMatchOpen={setJobMatchOpen}
      />
    </>
  );
}
