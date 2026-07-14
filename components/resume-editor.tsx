"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCopy,
  ClipboardPaste,
  Cpu,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  GripVertical,
  Keyboard,
  Loader2,
  MessageSquarePlus,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
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
import { ThemeToggle, toggleTheme } from "@/components/theme-toggle";
import { APP_STAGE, FEEDBACK_URL } from "@/lib/site";
import { Input } from "@/components/ui/input";
import { EntryList, FieldGroup, TextAreaField, TextField } from "@/components/resume-editor/editor-fields";
import { ResumeEditorOverlays } from "@/components/resume-editor/resume-editor-overlays";
import { ResumePreview } from "@/components/resume-editor/resume-preview";
import { ReviewDrawer } from "@/components/resume-editor/review-drawer";
import { VersionHistoryCard } from "@/components/resume-editor/version-history-card";
import { GuidedReview, type GuidedReviewStep } from "@/components/resume-editor/guided-review";
import { BlankResumeGuide, type BlankResumeGuideStep } from "@/components/resume-editor/blank-resume-guide";
import { SectionNav, type SectionNavItem } from "@/components/resume-editor/section-nav";
import { StartPanel } from "@/components/resume-editor/start-panel";
import { ChangeSummaryGrid, RestoredVersionCard } from "@/components/resume-editor/version-changes";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import {
  ACCENT_PRESETS,
  clampTextScale,
  entryHasContent,
  BULLET_STYLE_LABELS,
  BULLET_STYLES,
  CUSTOM_SECTION_PRESETS,
  DENSITIES,
  DENSITY_LABELS,
  exportChangeSummary,
  getSectionEntries,
  getSectionTitle,
  isSectionHidden,
  sectionItemCount,
  HEADING_STYLE_LABELS,
  HEADING_STYLES,
  isBuiltinSection,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  normalizeAccent,
  RESUME_FONTS,
  RESUME_TEMPLATES,
  resumePlainText,
  resolveFontStack,
  SECTION_KEYS,
  SECTION_LABELS,
  TEMPLATE_THEMES,
  type BulletStyle,
  type Density,
  type HeadingStyle,
  type ResumeTemplateId,
  type ResumeTheme,
} from "@/lib/resume";
import { clearAllLocalAIData } from "@/lib/local-ai-engine";
import { buildImportCoverage, type VersionHistoryItem } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

// WebLLM is a browser-only runtime (WebGPU, Cache API, and Web Workers). Keeping
// this dialog out of the server graph prevents its large client runtime from
// being bundled into the Cloudflare Worker while preserving on-demand use.
const LocalAIDialog = dynamic(
  () => import("@/components/resume-editor/local-ai-dialog").then((module) => module.LocalAIDialog),
  { ssr: false },
);
const LocalAIInlineEdit = dynamic(
  () => import("@/components/resume-editor/local-ai-inline-edit").then((module) => module.LocalAIInlineEdit),
  { ssr: false },
);
const LocalAIImportFix = dynamic(
  () => import("@/components/resume-editor/local-ai-import-fix").then((module) => module.LocalAIImportFix),
  { ssr: false },
);
const LocalAIBackgroundLoader = dynamic(
  () => import("@/components/resume-editor/local-ai-background-loader").then((module) => module.LocalAIBackgroundLoader),
  { ssr: false },
);

// Structured import repair is too inconsistent on the small local models.
// Keep the implementation available, but hide its entry points until quality improves.
const LOCAL_AI_IMPORT_FIX_ENABLED = false;

type LocalAIInlineTarget = {
  id: string;
  label: string;
  value: string;
  field?: "summary" | "skills";
  section?: string;
  index?: number;
};

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

// Applied to whichever editor group holds the field currently being edited, so
// the section you're working in is highlighted (header and summary included).
const ACTIVE_SECTION_CLASS =
  "rounded-md bg-sky-50/70 px-3 pt-3 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:ring-sky-500/40";
const HEADER_FIELD_IDS = ["field-name", "field-title", "field-email", "field-phone", "field-location", "field-website"];

export function ResumeEditor() {
  const editor = useResumeEditor();
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"editor" | "preview">("editor");
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [reviewTour, setReviewTour] = useState<{ kind: "import" | "checks"; index: number } | null>(null);
  // Inline editing on the resume sheet is the primary way to edit; the left
  // form stays available as a fallback (and can be collapsed for a focused
  // canvas).
  const [inlineEdit, setInlineEdit] = useState(true);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [editorPanePercent, setEditorPanePercent] = useState(50);
  const workspaceRef = useRef<HTMLElement>(null);
  // Turn inline editing off while the browser prints so the exported PDF keeps
  // its normal markup (e.g. clickable contact links) and none of the editing
  // affordances.
  const [printing, setPrinting] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [blankWorkspaceOpen, setBlankWorkspaceOpen] = useState(false);
  const [blankResumeGuideVisible, setBlankResumeGuideVisible] = useState(false);
  // Collapsed editor groups (by group id) so a long resume is quick to scan and
  // scroll without hunting through every open section.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [localAIOpen, setLocalAIOpen] = useState(false);
  const [localAIInlineTarget, setLocalAIInlineTarget] = useState<LocalAIInlineTarget | null>(null);
  const [localAIImportOpen, setLocalAIImportOpen] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designAdvancedOpen, setDesignAdvancedOpen] = useState(false);
  // Mirrors the theme so the mobile ⋯ menu item can name the opposite mode.
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  useEffect(() => setIsDarkTheme(document.documentElement.classList.contains("dark")), []);
  const {
    addCustomSection,
    addBuiltinSection,
    addEntry,
    applyAIImportFix,
    autosaveStatus,
    clearSavedBrowserData,
    checks,
    clearResume,
    dismissRecoveryPoint,
    importFileInputRef,
    exportCheckpoint,
    externalDraft,
    exportIsCurrent,
    focusCheckTarget,
    focusFromExportCheck,
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
    pageCount,
    pageGuides,
    printBreaks,
    passedChecks,
    recoveryPoint,
    removeEntry,
    removeCustomSection,
    removeBuiltinSection,
    reorderEntry,
    reorderSection,
    toggleSectionHidden,
    requestExport,
    restoreRecoveryPoint,
    resumeRef,
    saveJson,
    requestDocxExport,
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
    completeImportReview,
    confirmAllImportReviewItems,
    dismissRestoredVersionSummary,
    versionHistory,
    visibleRestoredVersionSummary,
  } = editor;
  const currentImportSourceText = importReview?.sourceText?.trim() || (importReview ? resumePlainText(state).trim() : "");
  const usingCurrentDraftForAIImport = Boolean(importReview && !importReview.sourceText?.trim() && currentImportSourceText);
  const autosaveCopy: VersionHistoryItem | null = hasContent && editor.autosavedAt
    ? {
        id: "autosave-copy",
        savedAt: editor.autosavedAt,
        label: "Autosave copy",
        fingerprint: editor.exportFingerprint,
        state,
        importReview,
      }
    : null;
  const deleteSavedBrowserData = async () => {
    setLocalAIInlineTarget(null);
    setLocalAIImportOpen(false);
    setLocalAIOpen(false);
    await clearAllLocalAIData();
    clearSavedBrowserData();
  };
  const toggleLocalAIInlineEdit = (target: LocalAIInlineTarget) => {
    setLocalAIInlineTarget((current) => current?.id === target.id ? null : target);
  };
  const localAIInlinePanel = localAIInlineTarget ? (
    <LocalAIInlineEdit
      key={localAIInlineTarget.id}
      label={localAIInlineTarget.label}
      text={localAIInlineTarget.value}
      onClose={() => setLocalAIInlineTarget(null)}
      onOpenSetup={() => setLocalAIOpen(true)}
      onApply={(value) => {
        if (localAIInlineTarget.field) updateField(localAIInlineTarget.field, value);
        else if (localAIInlineTarget.section !== undefined && localAIInlineTarget.index !== undefined) {
          updateEntry(localAIInlineTarget.section, localAIInlineTarget.index, "details", value);
        }
        setLocalAIInlineTarget(null);
      }}
    />
  ) : null;
  const workspaceHasStarted = hasContent || blankWorkspaceOpen;
  const blankResumeGuideSteps = useMemo<BlankResumeGuideStep[]>(
    () => [
      {
        id: "contact",
        label: "Add contact details",
        description: "Name, email, phone, and location.",
        actionLabel: "Add details",
        targetId: "field-name",
        done: checks.find((check) => check.id === "contact")?.ok ?? false,
      },
      {
        id: "experience",
        label: "Describe recent work",
        description: "Add a recent role and its key achievements.",
        actionLabel: "Add a role",
        targetId: "field-experience-0-title",
        done: state.experience.some((entry) => entryHasContent(entry) && Boolean(entry.details.trim())),
      },
      {
        id: "skills",
        label: "List relevant skills",
        description: "Group by category, e.g. Languages or Tools.",
        actionLabel: "Add skills",
        targetId: "field-skills",
        done: Boolean(state.skills.trim()),
      },
    ],
    [checks, state.experience, state.skills],
  );
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

  // A person can switch from a blank start to an imported resume at any time.
  // Import review is the relevant guide in that case, so never bring the blank
  // drafting prompts back after it finishes.
  useEffect(() => {
    if (importReview) setBlankResumeGuideVisible(false);
  }, [importReview]);

  const startBlankResume = (template = state.template) => {
    updateField("template", template);
    updateField("theme", TEMPLATE_THEMES[template]);
    setBlankWorkspaceOpen(true);
    setBlankResumeGuideVisible(true);
    window.setTimeout(() => document.getElementById("field-name")?.focus(), 120);
  };

  const updateTheme = (patch: Partial<ResumeTheme>) => updateField("theme", { ...state.theme, ...patch });
  const applyTemplate = (template: ResumeTemplateId) => {
    updateField("template", template);
    updateField("theme", TEMPLATE_THEMES[template]);
  };

  const clearEditor = () => {
    setBlankWorkspaceOpen(false);
    setBlankResumeGuideVisible(false);
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
    const target = document.getElementById(targetId);
    const inferredGroup = targetId === "field-summary"
      ? "summary"
      : HEADER_FIELD_IDS.includes(targetId)
        ? "header"
        : state.sectionOrder.find((section) => targetId === `field-${section}` || targetId.startsWith(`field-${section}-`));
    const group = target?.closest("[data-field-group]")?.getAttribute("data-field-group") ?? inferredGroup;
    if (group) expandGroup(group);
  }, [expandGroup, state.sectionOrder]);
  const focusTourTarget = useCallback((targetId: string) => {
    setActiveTarget(targetId);
    revealTarget(targetId);
  }, [revealTarget]);
  const editorGroupIds = ["arrange", "header", "summary", ...state.sectionOrder];
  const allCollapsed = editorGroupIds.every((groupId) => collapsedGroups.has(groupId));

  // Appearance controls live behind the preview toolbar's "Design" button so
  // the left pane stays purely about content. Preset, font, and accent are the
  // choices people reach for most; the rest sits under Advanced.
  const designControls = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Preset</span>
          <div className="relative">
            <select
              value={state.template}
              onChange={(event) => applyTemplate(event.target.value as ResumeTemplateId)}
              className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Resume preset"
            >
              {RESUME_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Font</span>
          <div className="relative">
            <select
              value={state.theme.font}
              onChange={(event) => updateTheme({ font: event.target.value })}
              className="h-9 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ fontFamily: resolveFontStack(state.theme.font) }}
              aria-label="Resume font"
            >
              {RESUME_FONTS.map((font) => (
                <option key={font.id} value={font.id}>
                  {font.label} · {font.kind}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </label>
      </div>

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

      <button
        type="button"
        aria-expanded={designAdvancedOpen}
        onClick={() => setDesignAdvancedOpen((open) => !open)}
        className="flex w-full items-center gap-1.5 rounded-md text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight className={cn("size-3.5 transition-transform", designAdvancedOpen && "rotate-90")} />
        Advanced
        <span className="font-normal">header, density, headings, bullets, divider</span>
      </button>

      {designAdvancedOpen ? (
        <div className="grid gap-4 rounded-md border bg-muted/20 p-3">
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

          <ThemeSegment
            label="Bullet style"
            value={state.theme.bulletStyle}
            options={BULLET_STYLES.map((style) => ({ value: style as BulletStyle, label: BULLET_STYLE_LABELS[style] }))}
            onChange={(bulletStyle) => updateTheme({ bulletStyle })}
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
      ) : null}
    </div>
  );

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

      // Section titles now live in the Manage sections list, so reorder shortcuts
      // must work from a manage row (data-arrange-section) as well as from inside
      // a section editor (data-editor-section).
      const sectionElement = focused.closest<HTMLElement>("[data-editor-section], [data-arrange-section]");
      const section = sectionElement?.dataset.editorSection ?? sectionElement?.dataset.arrangeSection;
      const inArrangeList = Boolean(sectionElement?.dataset.arrangeSection && !sectionElement?.dataset.editorSection);
      if (!section) return;

      if (event.code === "KeyN") {
        if (section === "skills" || inArrangeList) return;
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
  const headerActive = Boolean(activeTarget && HEADER_FIELD_IDS.includes(activeTarget));
  const summaryActive = activeTarget === "field-summary";
  const navItems: SectionNavItem[] = workspaceHasStarted
    ? [
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

  const resizeWorkspace = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const available = rect.width - 8;
    if (available <= 0) return;
    const minimumEditor = Math.min(340, available / 2);
    const minimumPreview = Math.min(440, available / 2);
    const next = ((clientX - rect.left) / available) * 100;
    const minimum = (minimumEditor / available) * 100;
    const maximum = ((available - minimumPreview) / available) * 100;
    setEditorPanePercent(Math.min(maximum, Math.max(minimum, next)));
  }, []);

  const startWorkspaceResize = (clientX: number) => {
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    resizeWorkspace(clientX);
    const move = (event: PointerEvent) => resizeWorkspace(event.clientX);
    const stop = () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
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
      <LocalAIBackgroundLoader />
      <header className="app-chrome sticky top-0 z-50 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">PrivaCV</h1>
            <Badge
              variant="secondary"
              className="shrink-0 rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase tracking-[0.1em]"
            >
              {APP_STAGE}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Feedback + theme toggle are desktop-only in the bar; on mobile
                they live in the ⋯ menu so the title never gets crowded out. */}
            <span className="hidden sm:inline-flex">
              <ThemeToggle />
            </span>
            {FEEDBACK_URL ? (
              <Button type="button" variant="outline" asChild className="hidden gap-2 sm:inline-flex">
                <a href={FEEDBACK_URL} target="_blank" rel="noreferrer" aria-label="Share feedback or vote on features (opens in a new tab)">
                  <MessageSquarePlus />
                  <span className="hidden sm:inline">Feedback</span>
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocalAIOpen(true)}
              className="hidden gap-2 xl:inline-flex"
            >
              <Cpu /> Local AI
            </Button>
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
                      "hidden h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums sm:inline-flex",
                      checksReady ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300",
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
                data-autosave-status={storageIssue ? "conflict" : autosaveStatus}
                aria-label={
                  storageIssue
                    ? "Version history — browser autosave unavailable"
                    : autosaveStatus === "saving"
                      ? "Version history — saving locally"
                      : autosaveStatus === "conflict"
                        ? "Version history — autosave paused for another tab"
                        : "Version history — saved locally"
                }
                title={
                  storageIssue
                    ? "Autosave unavailable — save a JSON copy to keep your work"
                    : autosaveStatus === "saving"
                      ? "Saving this resume in this browser…"
                      : autosaveStatus === "conflict"
                        ? "Autosave paused until you choose which tab's draft to keep"
                        : "Saved in this browser. Open version history or Save JSON for a portable backup."
                }
                className="gap-2"
              >
                {autosaveStatus === "saving" && !storageIssue ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : storageIssue || autosaveStatus === "conflict" ? (
                  <AlertCircle className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
                ) : (
                  <Check className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                )}
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
                <MenuItem className="sm:hidden" onSelect={() => setIsDarkTheme(toggleTheme())}>
                  <Moon /> {isDarkTheme ? "Switch to light mode" : "Switch to night mode"}
                </MenuItem>
                {FEEDBACK_URL ? (
                  <MenuItem className="sm:hidden" onSelect={() => window.open(FEEDBACK_URL, "_blank", "noopener,noreferrer")}>
                    <MessageSquarePlus /> Feedback
                  </MenuItem>
                ) : null}
                <MenuLabel>Import</MenuLabel>
                <MenuItem onSelect={() => setTextImportOpen(true)}>
                  <ClipboardPaste /> Paste text
                </MenuItem>
                <MenuItem onSelect={() => importFileInputRef.current?.click()} disabled={isImporting}>
                  <Upload /> {isImporting ? "Importing" : "Import a file"}
                </MenuItem>
                <MenuItem onSelect={() => jsonInputRef.current?.click()}>
                  <FileJson /> Open JSON
                </MenuItem>
                <MenuSeparator />
                <MenuLabel>Private assistance</MenuLabel>
                <MenuItem onSelect={() => setLocalAIOpen(true)}>
                  <Cpu /> Local AI (WebLLM)
                </MenuItem>
                <MenuSeparator />
                <MenuLabel>Export & files</MenuLabel>
                <MenuItem onSelect={() => setApplicationCopyOpen(true)} disabled={!hasContent}>
                  <ClipboardCopy /> Copy for applications
                </MenuItem>
                <MenuItem onSelect={() => setTextReviewOpen(true)}>
                  <ClipboardCopy /> Review Text
                </MenuItem>
                <MenuItem onSelect={requestDocxExport} disabled={!hasContent}>
                  <FileText /> Download Word (.docx)
                </MenuItem>
                <MenuItem onSelect={saveJson}>
                  <Download /> Save JSON
                </MenuItem>
                <MenuSeparator />
                <MenuItem onSelect={() => {
                  setBlankResumeGuideVisible(false);
                  loadSample();
                }}>
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
                <MenuItem
                  destructive
                  onSelect={() => {
                    if (
                      window.confirm(
                        "Delete this resume, every saved local checkpoint, and all downloaded Local AI model files in this browser? This also removes Local AI settings, import-review excerpts, and last-export status. Save JSON first if you want to keep a copy.",
                      )
                    ) {
                      setBlankWorkspaceOpen(false);
                      setBlankResumeGuideVisible(false);
                      void deleteSavedBrowserData();
                    }
                  }}
                >
                  <Trash2 /> Delete saved browser data
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

      <main
        ref={workspaceRef}
        className={cn(
          "app-shell grid min-h-[calc(100vh-73px)] grid-cols-1",
          editorCollapsed ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(340px,var(--editor-pane-width))_8px_minmax(440px,1fr)]",
        )}
        style={{ "--editor-pane-width": `${editorPanePercent}%` } as CSSProperties}
      >
        <section
          id="resume-editor-pane"
          aria-label="Resume editor"
          onFocusCapture={(event) => {
            const target = event.target as HTMLElement;
            if (target.id?.startsWith("field-") || target.id?.startsWith("section-title-")) setActiveTarget(target.id);
          }}
          className={cn(
            "editor-pane relative overflow-y-auto border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:border-b-0 lg:px-6 lg:pb-6 lg:pt-0",
            mobileWorkspaceView !== "editor" && "mobile-workspace-hidden",
            editorCollapsed && "lg:hidden",
          )}
        >
          {/* Everything that can render above the sticky section nav lives in
              this wrapper. On desktop it adds a header gap whenever it holds
              anything (`:not(:empty)`), and collapses to nothing when empty so
              the nav still hugs the header. Using `:empty` (not a hand-kept list
              of conditions) means any new banner/guide added here is spaced
              correctly for free — this bug kept recurring with the old list. */}
          <div className="lg:[&:not(:empty)]:pt-6">
          {!workspaceHasStarted ? (
            <StartPanel
              isImporting={isImporting}
              storageIssue={storageIssue}
              onImportFile={() => importFileInputRef.current?.click()}
              onImportText={() => setTextImportOpen(true)}
              onLoadSample={loadSample}
              onOpenJson={() => jsonInputRef.current?.click()}
              onOpenCheckpointBackup={() => historyBackupInputRef.current?.click()}
              onStartBlank={startBlankResume}
              onChooseTemplate={startBlankResume}
            />
          ) : null}

          {storageIssue ? (
            <Alert className="mb-6 border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/40">
              <AlertCircle className="h-4 w-4 text-amber-900 dark:text-amber-300" />
              <AlertTitle className="text-amber-950 dark:text-amber-100">Browser autosave is unavailable</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 text-amber-950 dark:text-amber-100/90 sm:flex-row sm:items-center sm:justify-between">
                <span>Your edits remain open here, but may not survive a refresh. Save a JSON copy before closing this tab.</span>
                <Button type="button" variant="outline" size="sm" className="w-fit border-amber-400 bg-background dark:border-amber-500/50" onClick={saveJson}>
                  <Download /> Save JSON copy
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {externalDraft ? (
            <Alert className="mb-6 border-sky-300 bg-sky-50/70 dark:border-sky-500/40 dark:bg-sky-950/40">
              <AlertCircle className="h-4 w-4 text-sky-900 dark:text-sky-300" />
              <AlertTitle className="text-sky-950 dark:text-sky-100">A different resume was saved in another tab</AlertTitle>
              <AlertDescription className="grid gap-3 text-sky-950 dark:text-sky-100/90">
                <span>Autosave is paused here so this tab does not overwrite the other draft. Review the changed areas, then choose which one to keep. If it was imported, its matching review checklist comes with it.</span>
                {externalDraftChanges.length ? (
                  <ChangeSummaryGrid changes={externalDraftChanges} beforeLabel="This tab" afterLabel="Saved tab" />
                ) : null}
                <span className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="border-sky-300 bg-background dark:border-sky-500/50" onClick={useExternalDraft}>
                    Use saved draft
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="border-sky-300 bg-background dark:border-sky-500/50" onClick={keepCurrentDraft}>
                    Keep this draft
                  </Button>
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          {recoveryPoint ? (
            <Card className="mb-6 border-sky-200 bg-sky-50/60 dark:border-sky-500/40 dark:bg-sky-950/40">
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Previous resume available</CardTitle>
                  <CardDescription>
                    {recoveryPoint.label}. Stays until you restore or dismiss it.
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
            <Card id="import-review-panel" className="mb-6 border-amber-200 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-950/40">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">Review the imported fields</CardTitle>
                    <CardDescription>
                      Imported from {importReview.fileName}. Check each field and confirm.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-amber-300 bg-background tabular-nums text-amber-950 dark:border-amber-500/50 dark:text-amber-200">
                    {importReviewStatus?.reviewedCount ?? 0}/{importReview.items.length}
                  </Badge>
                </div>
                {importSkippedCoverage.length ? (
                  <CardDescription className="text-amber-900 dark:text-amber-300">
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

          {blankWorkspaceOpen && blankResumeGuideVisible && !importReview ? (
            <BlankResumeGuide
              steps={blankResumeGuideSteps}
              onFocus={focusEditorTarget}
              onDismiss={() => setBlankResumeGuideVisible(false)}
            />
          ) : null}
          </div>

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
              <FieldGroup title="Manage sections" {...groupProps("arrange")}>
                <p className="text-xs leading-snug text-muted-foreground">
                  Reorder, add, or remove sections. The preview updates immediately.
                </p>
                <div className="mt-3 space-y-2" id="section-order-controls" tabIndex={-1}>
                  {state.sectionOrder.map((section, sectionIndex) => {
                    const title = getSectionTitle(state, section);
                    const displayTitle = title.trim() || "Untitled section";
                    const custom = !isBuiltinSection(section);
                    const hidden = isSectionHidden(state, section);
                    const count = sectionItemCount(state, section);
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
                        <button
                          type="button"
                          onClick={() => focusEditorTarget(`edit-section-${section}`)}
                          title={`Jump to ${displayTitle}`}
                          aria-label={`Jump to ${displayTitle}`}
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {sectionIndex + 1}
                        </button>
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
                        <Input
                          id={`section-title-${section}`}
                          value={title}
                          aria-label={title.trim() ? `${title} section title` : "Untitled section title"}
                          onChange={(event) => updateSectionTitle(section, event.target.value)}
                          className={cn(
                            "h-8 min-w-0 flex-1 border-transparent bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted/60 focus-visible:border-input focus-visible:bg-background",
                            hidden && "text-muted-foreground line-through",
                          )}
                        />
                        {count > 0 ? (
                          <span
                            className={cn("shrink-0 tabular-nums text-xs text-muted-foreground", hidden && "opacity-60")}
                            title={`${count} ${count === 1 ? "item" : "items"}`}
                          >
                            ({count})
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Move ${displayTitle} up`}
                          disabled={sectionIndex === 0}
                          onClick={() => moveSection(section, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Move ${displayTitle} down`}
                          disabled={sectionIndex === state.sectionOrder.length - 1}
                          onClick={() => moveSection(section, 1)}
                        >
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={hidden ? `Show ${displayTitle} section in resume` : `Hide ${displayTitle} section from resume`}
                          aria-pressed={hidden}
                          title={hidden ? "Show in resume" : "Hide from resume"}
                          onClick={() => toggleSectionHidden(section)}
                        >
                          {hidden ? <EyeOff /> : <Eye />}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${displayTitle} section`}
                          title="Remove section (Undo available)"
                          onClick={() => (custom ? removeCustomSection(section) : removeBuiltinSection(section))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-md border border-dashed bg-muted/20 p-3">
                  <p className="text-sm font-medium">Add a section</p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    Choose a familiar heading or make your own.
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
              </FieldGroup>
              <FieldGroup id="edit-header" title="Header" reviewRegion className={cn(headerActive && ACTIVE_SECTION_CLASS)} {...groupProps("header")}>
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

              <FieldGroup id="edit-summary" title="Summary" reviewRegion className={cn(summaryActive && ACTIVE_SECTION_CLASS)} {...groupProps("summary")}>
                <TextAreaField
                  id="field-summary"
                  label="Professional Summary"
                  value={state.summary}
                  placeholder="Brief overview of your experience and strengths."
                  onChange={(value) => updateField("summary", value)}
                  aiAssist={{
                    expanded: localAIInlineTarget?.id === "summary",
                    onClick: () => toggleLocalAIInlineEdit({ id: "summary", label: "Professional summary", value: state.summary, field: "summary" }),
                    content: localAIInlineTarget?.id === "summary" ? localAIInlinePanel : undefined,
                  }}
                />
              </FieldGroup>

              {state.sectionOrder.map((section, sectionIndex) => {
                const sectionTitle = getSectionTitle(state, section);
                const sectionDisplayTitle = sectionTitle.trim() || "Untitled section";
                const entries = getSectionEntries(state, section);
                const sectionHidden = isSectionHidden(state, section);
                const sectionIsActive =
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
                    sectionIsActive && ACTIVE_SECTION_CLASS,
                    sectionHidden && "opacity-60",
                    draggedSection === section && "rounded-md opacity-45",
                    dropTargetSection === section && draggedSection !== section && "rounded-md bg-primary/5 px-3 pt-3 ring-2 ring-primary/25",
                  )}
                  title={sectionDisplayTitle}
                  actions={
                    sectionHidden || section !== "skills" ? (
                      <div className="flex items-center gap-2">
                        {sectionHidden ? (
                          <button
                            type="button"
                            onClick={() => toggleSectionHidden(section)}
                            title="Show in resume"
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <EyeOff className="size-3" /> Hidden
                          </button>
                        ) : null}
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
                            <Plus /> Add
                          </Button>
                        ) : null}
                      </div>
                    ) : undefined
                  }
                >
                  {section === "skills" ? (
                    <TextAreaField
                      id="field-skills"
                      label={'Skills (one group per line, e.g. "Languages: Python, Go")'}
                      value={state.skills}
                      placeholder={"Languages: Python, JavaScript, Go\nTools: Docker, Kubernetes, AWS"}
                      onChange={(value) => updateField("skills", value)}
                      aiAssist={{
                        expanded: localAIInlineTarget?.id === "skills",
                        onClick: () => toggleLocalAIInlineEdit({ id: "skills", label: "Skills", value: state.skills, field: "skills" }),
                        content: localAIInlineTarget?.id === "skills" ? localAIInlinePanel : undefined,
                      }}
                    />
                  ) : (
                    <EntryList
                      section={section}
                      sectionLabel={sectionTitle}
                      entries={entries}
                      activeTarget={activeTarget}
                      onUpdate={updateEntry}
                      onMove={moveEntry}
                      onReorder={reorderEntry}
                      onRemove={removeEntry}
                      onSwapTitleAndSubtitle={swapExperienceTitleAndCompany}
                      aiTargetId={localAIInlineTarget?.section ? localAIInlineTarget.id : null}
                      aiPanel={localAIInlinePanel}
                      onAIEdit={toggleLocalAIInlineEdit}
                      onEntryCollapse={() => setActiveTarget(null)}
                    />
                  )}
                </FieldGroup>
                </div>
              );})}
            </div>
          ) : null}
        </section>

        {!editorCollapsed ? (
          <div
            role="separator"
            aria-label="Resize editor and preview"
            aria-orientation="vertical"
            aria-valuemin={34}
            aria-valuemax={57}
            aria-valuenow={Math.round(editorPanePercent)}
            tabIndex={0}
            className="group relative hidden cursor-col-resize touch-none items-center justify-center border-x bg-border/50 outline-none transition-colors hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:flex"
            onPointerDown={(event) => {
              event.preventDefault();
              startWorkspaceResize(event.clientX);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              setEditorPanePercent((value) => Math.min(57, Math.max(34, value + (event.key === "ArrowLeft" ? -2 : 2))));
            }}
          >
            <GripVertical className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </div>
        ) : null}

        <section
          id="resume-preview-pane"
          className={cn(
            "preview-pane overflow-y-auto bg-muted/70 p-4 lg:max-h-[calc(100vh-73px)] lg:p-7",
            mobileWorkspaceView !== "preview" && "mobile-workspace-hidden",
          )}
          aria-label="Resume preview"
        >
          <div ref={previewWrapRef} className="mx-auto flex w-full max-w-[8.5in] flex-col items-center gap-3">
            <div className="app-chrome flex w-full items-center gap-2 overflow-x-auto pb-1">
              {workspaceHasStarted ? (
                <Button
                  type="button"
                  variant={designOpen ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2"
                  aria-label="Design"
                  aria-expanded={designOpen}
                  aria-controls="design-panel"
                  onClick={() => setDesignOpen((open) => !open)}
                >
                  <SlidersHorizontal /> <span className="hidden 2xl:inline">Design</span>
                </Button>
              ) : null}
              <label className="hidden h-8 shrink-0 items-center gap-2 rounded-md border bg-background px-2 text-xs text-muted-foreground sm:flex">
                <span className="sr-only">Text size</span>
                <input
                  id="resume-text-scale"
                  className="w-20 accent-foreground 2xl:w-24"
                  type="range"
                  min={MIN_TEXT_SCALE}
                  max={MAX_TEXT_SCALE}
                  step="0.02"
                  value={state.textScale}
                  onChange={(event) => updateField("textScale", clampTextScale(Number(event.target.value)))}
                  aria-label="Resume text size"
                />
                <output className="w-9 text-right tabular-nums">{Math.round(state.textScale * 100)}%</output>
              </label>
              <p className="shrink-0 text-xs text-muted-foreground">
                {pageCount} {pageCount === 1 ? "page" : "pages"} in preview
              </p>
              {pageCount > 1 && canTightenLayout ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2 text-xs"
                  onClick={tightenLayout}
                  aria-label={state.theme.density === "compact" ? "Reduce text 2%" : "Try compact spacing"}
                  title="Uses compact spacing first, then reduces text size by 2%. Your resume content stays unchanged."
                >
                  <ChevronsDownUp />
                  <span className="hidden 2xl:inline">{state.theme.density === "compact" ? "Reduce text 2%" : "Compact spacing"}</span>
                </Button>
              ) : null}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {LOCAL_AI_IMPORT_FIX_ENABLED && importReview ? (
                  <Button
                    type="button"
                    variant={localAIImportOpen ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 gap-1.5 px-2"
                    aria-label="Fix import with AI"
                    disabled={!currentImportSourceText}
                    onClick={() => setLocalAIImportOpen(true)}
                    title={importReview.sourceText ? "Remap the original extracted text with local AI" : "Reorganize the current parsed draft with local AI; re-import first to recover omitted source text"}
                  >
                    <Sparkles /> <span className="hidden 2xl:inline">Fix import with AI</span>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant={inlineEdit ? "default" : "outline"}
                  size="sm"
                  className="hidden h-8 gap-1.5 px-2 lg:inline-flex"
                  aria-pressed={inlineEdit}
                  aria-label={inlineEdit ? "Editing on sheet (click to turn off)" : "Edit on sheet (click to turn on)"}
                  onClick={() => setInlineEdit((value) => !value)}
                  title={inlineEdit ? "Inline editing is on — click any text on the resume to edit it" : "Turn on inline editing (click resume text to edit)"}
                >
                  <Pencil />
                  {inlineEdit ? (
                    <>
                      <span aria-hidden className="size-1.5 rounded-full bg-current" /> <span className="hidden 2xl:inline">Editing</span>
                    </>
                  ) : (
                    <span className="hidden 2xl:inline">Edit</span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden size-8 lg:inline-flex"
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
            {workspaceHasStarted && designOpen ? (
              <div id="design-panel" className="w-full rounded-lg border bg-card p-4 shadow-sm">
                {designControls}
              </div>
            ) : null}
            {LOCAL_AI_IMPORT_FIX_ENABLED && localAIImportOpen && importReview && currentImportSourceText ? (
              <LocalAIImportFix
                sourceText={currentImportSourceText}
                currentState={state}
                usingCurrentDraft={usingCurrentDraftForAIImport}
                onClose={() => setLocalAIImportOpen(false)}
                onOpenSetup={() => setLocalAIOpen(true)}
                onApply={(proposal) => {
                  if (applyAIImportFix(proposal)) setLocalAIImportOpen(false);
                }}
              />
            ) : null}
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

      <LocalAIDialog
        open={localAIOpen}
        onOpenChange={setLocalAIOpen}
      />

      <VersionHistoryCard
        open={versionsOpen}
        onOpenChange={setVersionsOpen}
        hasContent={hasContent}
        versions={editor.versionHistory}
        autosave={autosaveCopy}
        currentFingerprint={editor.exportFingerprint}
        storageIssue={storageIssue}
        deletedVersion={editor.deletedVersion}
        onSave={editor.openVersionSave}
        onSaveBackup={editor.saveVersionHistoryBackup}
        onOpenBackup={() => editor.historyBackupInputRef.current?.click()}
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
        onFocusStep={focusTourTarget}
        onFinish={() => {
          if (reviewTour?.kind === "import") completeImportReview();
          setReviewTour(null);
        }}
        finishLabel={reviewTour?.kind === "import" ? "Finish review" : "Done"}
        finishDisabled={reviewTour?.kind === "import" && !importReviewStatus?.isComplete}
        modal={reviewTour?.kind === "import"}
        scrollLockSelector="#resume-editor-pane"
      />

      <ResumeEditorOverlays
        editor={{
          ...editor,
          focusFromExportCheck: focusEditorFromExportCheck,
        }}
      />
    </>
  );
}
