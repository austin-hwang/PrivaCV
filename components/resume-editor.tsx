"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertCircle,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardCheck,
  ClipboardCopy,
  ClipboardPaste,
  Code,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FileText,
  Github,
  Gitlab,
  Globe2,
  GripVertical,
  History,
  Import as ImportIcon,
  Linkedin,
  Link as LinkIcon,
  Library,
  Loader2,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { toggleTheme } from "@/components/theme-toggle";
import { APP_STAGE, FEEDBACK_URL } from "@/lib/site";
import { Input } from "@/components/ui/input";
import { EntryList, FieldGroup, TagGroupEditor, TextAreaField, TextField } from "@/components/resume-editor/editor-fields";
import { ResumeEditorOverlays } from "@/components/resume-editor/resume-editor-overlays";
import { ResumePreview } from "@/components/resume-editor/resume-preview";
import { ReviewDrawer } from "@/components/resume-editor/review-drawer";
import { VersionHistoryCard } from "@/components/resume-editor/version-history-card";
import { ResumeLibraryCard } from "@/components/resume-editor/resume-library-card";
import { GuidedReview, type GuidedReviewStep } from "@/components/resume-editor/guided-review";
import { BlankResumeGuide, type BlankResumeGuideStep } from "@/components/resume-editor/blank-resume-guide";
import { SectionNav, type SectionNavItem } from "@/components/resume-editor/section-nav";
import { ResumeNavigator, type ResumeNavigatorItem } from "@/components/resume-editor/resume-navigator";
import { StartPanel } from "@/components/resume-editor/start-panel";
import { ChangeSummaryGrid } from "@/components/resume-editor/version-changes";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import {
  ACCENT_PRESETS,
  clampTextScale,
  entryFieldSchema,
  entryHasContent,
  BULLET_STYLE_LABELS,
  BULLET_STYLES,
  CUSTOM_SECTION_PRESETS,
  CUSTOM_SECTION_PRESET_FORMATS,
  DENSITIES,
  DENSITY_LABELS,
  exportChangeSummary,
  getSectionEntries,
  getSectionFormat,
  getSectionTagGroups,
  getSectionText,
  getSectionTitle,
  inferHeaderLinkIcon,
  inferHeaderLinkLabel,
  isSectionHidden,
  sectionItemCount,
  HEADING_STYLE_LABELS,
  HEADING_STYLES,
  HEADER_LINK_ICON_OPTIONS,
  isBuiltinSection,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  normalizeAccent,
  resumeExportFingerprint,
  RESUME_FONTS,
  RESUME_TEMPLATES,
  resumePlainText,
  resolveHeaderLinkIcon,
  resolveFontStack,
  SECTION_KEYS,
  SECTION_FORMAT_LABELS,
  SECTION_FORMATS,
  SECTION_LABELS,
  TEMPLATE_THEMES,
  type BulletStyle,
  type Density,
  type HeadingStyle,
  type HeaderLink,
  type HeaderLinkIconId,
  type ResumeTemplateId,
  type ResumeTheme,
  type SectionFormat,
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

const SECTION_FORMAT_SHORT_LABELS: Record<SectionFormat, string> = {
  entries: "Entries",
  "tag-groups": "Tags",
  bullets: "Bullets",
  paragraphs: "Paragraphs",
  "labeled-rows": "Rows",
};

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
  "rounded-md bg-brand-soft/10 px-3 pt-3 ring-1 ring-brand/40";
const HEADER_FIELD_IDS = ["field-name", "field-title", "field-email", "field-phone", "field-location"];
const isHeaderTarget = (targetId: string) =>
  HEADER_FIELD_IDS.includes(targetId) || targetId.startsWith("field-header-link-") || targetId === "add-header-link";

function HeaderLinkEditorIcon({ link }: { link: Pick<HeaderLink, "icon" | "label" | "url"> }) {
  const icon = resolveHeaderLinkIcon(link);
  const Icon = icon === "linkedin"
    ? Linkedin
    : icon === "github"
      ? Github
      : icon === "gitlab"
        ? Gitlab
        : icon === "portfolio"
          ? BriefcaseBusiness
          : icon === "code"
            ? Code
            : icon === "link"
              ? LinkIcon
              : Globe2;
  return <Icon aria-hidden="true" className="size-4" />;
}

// Skills can render as grouped tags, bullets, paragraphs, or rows, so its old
// textarea target is not guaranteed to exist. Keep review tours anchored to the
// stable section card while accepting reviews saved with the legacy field id.
const reviewTourTargetId = (targetId: string) => targetId === "field-skills" ? "review-region-skills" : targetId;

export function ResumeEditor() {
  const editor = useResumeEditor();
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"editor" | "preview">("editor");
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [checksReviewOpen, setChecksReviewOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPreviewItem, setHistoryPreviewItem] = useState<VersionHistoryItem | null>(null);
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
  const [blankTemplatePreview, setBlankTemplatePreview] = useState<ResumeTemplateId | null>(null);
  const [blankResumeGuideVisible, setBlankResumeGuideVisible] = useState(false);
  // Collapsed editor groups (by group id) so a long resume is quick to scan and
  // scroll without hunting through every open section.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<string | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorQuery, setNavigatorQuery] = useState("");
  const [destructiveAction, setDestructiveAction] = useState<"clear" | "clear-checkpoints" | "delete-all" | null>(null);
  const [localAIOpen, setLocalAIOpen] = useState(false);
  const [localAIInlineTarget, setLocalAIInlineTarget] = useState<LocalAIInlineTarget | null>(null);
  const [localAIImportOpen, setLocalAIImportOpen] = useState(false);
  const [localAIEnabled, setLocalAIEnabled] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designAdvancedOpen, setDesignAdvancedOpen] = useState(false);
  // Mirrors the theme so the Tools drawer can name the opposite mode.
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  useEffect(() => setIsDarkTheme(document.documentElement.classList.contains("dark")), []);
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 640px)");
    const syncLocalAIAvailability = () => {
      const enabled = desktopQuery.matches;
      setLocalAIEnabled(enabled);
      if (!enabled) {
        setLocalAIOpen(false);
        setLocalAIInlineTarget(null);
        setLocalAIImportOpen(false);
      }
    };
    syncLocalAIAvailability();
    desktopQuery.addEventListener("change", syncLocalAIAvailability);
    return () => desktopQuery.removeEventListener("change", syncLocalAIAvailability);
  }, []);
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
    externalDraft,
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
    updateSectionFormat,
    updateSectionTagGroups,
    updateSectionText,
    updateSectionTitle,
    useExternalDraft,
    toggleImportReviewItem,
    completeImportReview,
    versionHistory,
  } = editor;
  const currentImportSourceText = importReview?.sourceText?.trim() || (importReview ? resumePlainText(state).trim() : "");
  const usingCurrentDraftForAIImport = Boolean(importReview && !importReview.sourceText?.trim() && currentImportSourceText);
  const autosaveCopy: VersionHistoryItem | null = editor.autosavedAt && editor.autosavedState
    ? {
        id: "autosave-copy",
        savedAt: editor.autosavedAt,
        label: "Autosave copy",
        fingerprint: resumeExportFingerprint(editor.autosavedState),
        state: editor.autosavedState,
        importReview,
      }
    : null;
  const currentHistoryPoint = useMemo<VersionHistoryItem>(() => ({
    id: "current-draft",
    savedAt: editor.autosavedAt ?? new Date().toISOString(),
    label: "Current draft",
    fingerprint: editor.exportFingerprint,
    state,
    importReview,
  }), [editor.autosavedAt, editor.exportFingerprint, importReview, state]);
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
        } else if (localAIInlineTarget.section !== undefined) {
          updateSectionText(localAIInlineTarget.section, value);
        }
        setLocalAIInlineTarget(null);
      }}
    />
  ) : null;
  const workspaceHasStarted = hasContent || blankWorkspaceOpen;
  const timelinePreviewState = historyPreviewItem && !printing ? historyPreviewItem.state : state;
  const previewState = blankTemplatePreview
    ? { ...timelinePreviewState, template: blankTemplatePreview, theme: TEMPLATE_THEMES[blankTemplatePreview] }
    : timelinePreviewState;
  useEffect(() => {
    setHistoryPreviewItem(null);
    setHistoryOpen(false);
  }, [editor.activeResumeId]);
  // Mark the document while the editor is active so app-only layout rules can
  // respond without coupling the public footer to editor state.
  useEffect(() => {
    document.documentElement.dataset.resumeWorkspace = workspaceHasStarted ? "active" : "";
    return () => { delete document.documentElement.dataset.resumeWorkspace; };
  }, [workspaceHasStarted]);
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
        targetId: getSectionFormat(state, "skills") === "tag-groups"
          ? state.sectionTagGroups.skills?.[0]
            ? `field-skills-group-${state.sectionTagGroups.skills[0].id}`
            : "add-skills-group"
          : getSectionFormat(state, "skills") === "entries"
            ? state.skillEntries.length
              ? "field-skills-0-title"
              : "add-skills-entry"
            : "field-skills-content",
        done: sectionItemCount(state, "skills") > 0,
      },
    ],
    [checks, state],
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
    setBlankTemplatePreview(null);
    updateField("template", template);
    updateField("theme", TEMPLATE_THEMES[template]);
    setBlankWorkspaceOpen(true);
    setBlankResumeGuideVisible(true);
    window.setTimeout(() => document.getElementById("field-name")?.focus(), 120);
  };

  const updateTheme = (patch: Partial<ResumeTheme>) => updateField("theme", { ...state.theme, ...patch });
  const updateHeaderLink = (id: string, patch: Partial<Pick<HeaderLink, "label" | "url" | "icon">>) =>
    updateField("headerLinks", state.headerLinks.map((link) => {
      if (link.id !== id) return link;
      const wasInferred = link.icon === inferHeaderLinkIcon(`${link.label} ${link.url}`);
      const next = { ...link, ...patch };
      if (patch.url !== undefined) next.label = inferHeaderLinkLabel(patch.url);
      if (patch.icon === undefined && wasInferred && (patch.url !== undefined || patch.label !== undefined)) {
        next.icon = inferHeaderLinkIcon(`${next.label} ${next.url}`);
      }
      return next;
    }));
  const addHeaderLink = () => {
    const id = `header-link-${Date.now().toString(36)}`;
    updateField("headerLinks", [...state.headerLinks, { id, label: "", url: "", icon: "website" }]);
    setActiveTarget(`field-header-link-${id}-url`);
    window.setTimeout(() => document.getElementById(`field-header-link-${id}-url`)?.focus(), 0);
  };
  const removeHeaderLink = (id: string) =>
    updateField("headerLinks", state.headerLinks.filter((link) => link.id !== id));
  const moveHeaderLink = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= state.headerLinks.length) return;
    const links = [...state.headerLinks];
    [links[index], links[nextIndex]] = [links[nextIndex], links[index]];
    updateField("headerLinks", links);
  };
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
      : isHeaderTarget(targetId)
        ? "header"
        : state.sectionOrder.find((section) => targetId === `field-${section}` || targetId.startsWith(`field-${section}-`));
    const group = target?.closest("[data-field-group]")?.getAttribute("data-field-group") ?? inferredGroup;
    if (group) expandGroup(group);
  }, [expandGroup, state.sectionOrder]);
  const focusTourTarget = useCallback((targetId: string) => {
    setActiveTarget(targetId);
    revealTarget(targetId);
  }, [revealTarget]);
  const editorGroupIds = ["header", "summary", ...state.sectionOrder];
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
  const toggleNavigator = useCallback(() => setNavigatorOpen((current) => !current), []);

  useEffect(() => {
    if (!navigatorOpen) setNavigatorQuery("");
  }, [navigatorOpen]);

  useEffect(() => {
    const handleNavigateShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLocaleLowerCase() !== "k" ||
        !workspaceHasStarted
      ) {
        return;
      }
      event.preventDefault();
      toggleNavigator();
    };

    window.addEventListener("keydown", handleNavigateShortcut);
    return () => window.removeEventListener("keydown", handleNavigateShortcut);
  }, [toggleNavigator, workspaceHasStarted]);

  const importCoverage = importReview?.coverage ?? (importReview ? buildImportCoverage(state, importReview.sourceText) : []);
  const importSkippedCoverage = importCoverage.filter((item) => item.sourceDetected && !item.detected);

  // Guided-review tour steps. Import: confirm each imported field, then flag any
  // source section the importer skipped. Checks: walk each readiness check.
  const importTourSteps: GuidedReviewStep[] = importReview
    ? [
        ...importReview.items.map((item, itemIndex) => {
          const confirmed = Boolean(importReview.reviewedItemIds?.includes(item.id));
          const targetId = reviewTourTargetId(item.targetId);
          return {
            id: `item-${item.id}`,
            targetId,
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
          targetId: reviewTourTargetId(item.targetId),
          eyebrow: "Possible skipped section",
          title: item.label,
          description: item.detail,
          excerpt: item.sourceExcerpt,
          tone: "warn" as GuidedReviewStep["tone"],
          action: {
            label: "Go to this section",
            run: () => {
              setReviewTour(null);
              focusEditorTarget(reviewTourTargetId(item.targetId));
            },
          },
        } satisfies GuidedReviewStep)),
      ]
    : [];

  const checksTourSteps: GuidedReviewStep[] = checks.map((check) => ({
      id: check.id,
      targetId: check.targetId,
      eyebrow: "Resume review",
      title: check.label,
      description: check.ok && !check.advisory ? check.detail : `${check.detail} ${check.guidance}`,
      tone: (check.advisory ? "info" : check.ok ? "ok" : "warn") as GuidedReviewStep["tone"],
      done: check.ok && !check.advisory,
      action: check.ok && !check.advisory ? undefined : {
        label: check.actionLabel,
        run: () => {
          // A check action is an exit into editing, not another review-tour
          // navigation step. Close the card so the focused field is visible
          // and the action has an immediate, unambiguous result.
          setReviewTour(null);
          focusEditorTarget(check.targetId);
        },
      },
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
    setChecksReviewOpen(false);
    setMobileWorkspaceView("editor");
    setReviewTour({ kind: "checks", index: 0 });
  };
  const openChecksReview = () => {
    setToolsOpen(false);
    setChecksReviewOpen(true);
  };
  const tourSteps = reviewTour?.kind === "import" ? importTourSteps : reviewTour?.kind === "checks" ? checksTourSteps : [];

  const checksReady = passedChecks === checks.length;
  const canTightenLayout = state.theme.density !== "compact" || state.textScale > MIN_TEXT_SCALE;
  const removedBuiltinSections = SECTION_KEYS.filter((section) => !state.sectionOrder.includes(section));
  const headerActive = Boolean(activeTarget && isHeaderTarget(activeTarget));
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
  const navigatorItems = useMemo<ResumeNavigatorItem[]>(() => {
    if (!workspaceHasStarted) return [];
    const items: ResumeNavigatorItem[] = [
      { id: "field-name", label: "Full name", context: "Header", keywords: state.name },
      { id: "field-title", label: "Title / role", context: "Header", keywords: state.title },
      { id: "field-email", label: "Email", context: "Header", keywords: state.email },
      { id: "field-phone", label: "Phone", context: "Header", keywords: state.phone },
      { id: "field-location", label: "Location", context: "Header", keywords: state.location },
      ...state.headerLinks.map((link) => ({
        id: `field-header-link-${link.id}-url`,
        label: link.label || "Website",
        context: "Header link",
        keywords: link.url,
      })),
      { id: "field-summary", label: "Professional summary", context: "Summary", keywords: state.summary },
    ];

    for (const section of state.sectionOrder) {
      const sectionTitle = getSectionTitle(state, section).trim() || "Untitled section";
      const format = getSectionFormat(state, section);
      items.push({
        id: `section-title-${section}`,
        label: `${sectionTitle} section title`,
        context: "Section heading",
      });

      if (format === "tag-groups") {
        getSectionTagGroups(state, section).forEach((group, index) => {
          items.push({
            id: `field-${section}-group-${group.id}`,
            label: group.label.trim() || `Group ${index + 1}`,
            context: `${sectionTitle} · Group`,
            keywords: group.tags.join(" "),
          });
        });
        continue;
      }

      if (format !== "entries") {
        items.push({
          id: `field-${section}-content`,
          label: `${sectionTitle} content`,
          context: `${sectionTitle} · ${SECTION_FORMAT_LABELS[format]}`,
          keywords: getSectionText(state, section),
        });
        continue;
      }

      const schema = entryFieldSchema(section, sectionTitle);
      getSectionEntries(state, section).forEach((entry, index) => {
        const entryLabel = entry.title.trim() || entry.subtitle.trim() || `Entry ${index + 1}`;
        const context = `${sectionTitle} · ${entryLabel}`;
        const keywords = `${entry.title} ${entry.subtitle} ${entry.meta} ${entry.details}`;
        (Object.keys(schema) as (keyof typeof schema)[]).forEach((field) => {
          items.push({
            id: `field-${section}-${index}-${field}`,
            label: schema[field],
            context,
            keywords,
          });
        });
      });
    }
    return items;
  }, [state, workspaceHasStarted]);

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
      {localAIEnabled ? <LocalAIBackgroundLoader /> : null}
      <header className="app-chrome sticky top-0 z-50 border-b bg-card/95 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <BrandMark className="size-8" />
            <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">PrivaCV</h1>
            <Badge
              variant="secondary"
              className="shrink-0 rounded-full px-1.5 py-0 text-[10px] font-semibold uppercase tracking-[0.1em]"
            >
              {APP_STAGE}
            </Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant={toolsOpen ? "secondary" : "outline"}
              onClick={() => setToolsOpen((open) => !open)}
              aria-label={toolsOpen ? "Collapse tools panel" : "Open tools"}
              aria-expanded={toolsOpen}
              aria-controls="tools-panel"
              className="gap-2"
            >
              <SlidersHorizontal />
              <span className="hidden sm:inline">Tools</span>
              {hasContent ? (
                <span
                  className={cn(
                    "hidden h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums sm:inline-flex",
                    checksReady ? "bg-success/15 text-success" : "bg-warning/15 text-foreground",
                  )}
                >
                  {passedChecks}/{checks.length}
                </span>
              ) : null}
            </Button>
            {editor.resumeLibrary.length ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setLibraryOpen(true)}
                aria-label="Resume library"
                title="Open resume library"
                className="gap-2"
              >
                <Library aria-hidden="true" />
                <span className="hidden sm:inline">Library</span>
                {editor.resumeLibrary.length > 1 ? (
                  <span className="hidden h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold leading-none tabular-nums sm:inline-flex">
                    {editor.resumeLibrary.length}
                  </span>
                ) : null}
              </Button>
            ) : null}
            <Menu>
              <MenuTrigger>
                <Button type="button" variant="outline" aria-label="Import">
                  <ImportIcon /> <span className="hidden sm:inline">Import</span>
                  <ChevronDown className="hidden size-3.5 sm:block" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Import resume</MenuLabel>
                <MenuItem onSelect={() => importFileInputRef.current?.click()} disabled={isImporting}>
                  <Upload /> {isImporting ? "Importing" : "Upload PDF or Word"}
                </MenuItem>
                <MenuItem onSelect={() => setTextImportOpen(true)}>
                  <ClipboardPaste /> Paste resume text
                </MenuItem>
                <MenuItem onSelect={() => jsonInputRef.current?.click()}>
                  <FileJson /> Open saved JSON
                </MenuItem>
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger>
                <Button type="button" aria-label="Export">
                  <Download /> <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="hidden size-3.5 sm:block" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Export resume</MenuLabel>
                <MenuItem onSelect={requestExport}>
                  <Printer /> Export PDF
                </MenuItem>
                <MenuItem onSelect={requestDocxExport} disabled={!hasContent}>
                  <FileText /> Export Word (.docx)
                </MenuItem>
                <MenuItem onSelect={() => setTextReviewOpen(true)} disabled={!hasContent}>
                  <ClipboardCopy /> Copy resume text
                </MenuItem>
                <MenuItem onSelect={saveJson}>
                  <FileJson /> Export JSON
                </MenuItem>
              </MenuContent>
            </Menu>
            <Menu>
              <MenuTrigger>
                <Button type="button" variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>Workspace data</MenuLabel>
                <MenuItem onSelect={() => {
                  setBlankResumeGuideVisible(false);
                  loadSample();
                }}>
                  <FileText /> Sample
                </MenuItem>
                <MenuItem
                  destructive
                  onSelect={() => setDestructiveAction("clear")}
                >
                  <RotateCcw /> Clear resume
                </MenuItem>
                <MenuItem
                  destructive
                  onSelect={() => setDestructiveAction("delete-all")}
                >
                  <Trash2 /> Delete all data
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
            const tagGroup = target.closest<HTMLElement>("[data-editor-tag-group]");
            if (tagGroup?.id) setActiveTarget(tagGroup.id);
            else if (target.id?.startsWith("field-") || target.id?.startsWith("section-title-")) setActiveTarget(target.id);
          }}
          className={cn(
            "editor-pane relative overflow-visible border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:overflow-y-auto lg:border-b-0 lg:px-6 lg:pb-6 lg:pt-0",
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
              onPreviewBlank={setBlankTemplatePreview}
            />
          ) : null}

          {storageIssue ? (
            <Alert className="mb-6 border-warning/40 bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertTitle>Browser autosave is unavailable</AlertTitle>
              <AlertDescription className="editor-pane-row-center flex gap-3">
                <span>Your edits remain open here, but may not survive a refresh. Save a JSON copy before closing this tab.</span>
                <Button type="button" variant="outline" size="sm" className="w-fit border-warning/50 bg-background" onClick={saveJson}>
                  <Download /> Save JSON copy
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {externalDraft ? (
            <Alert className="mb-6 border-brand/40 bg-brand/10">
              <AlertCircle className="h-4 w-4 text-brand" />
              <AlertTitle>A different resume was saved in another tab</AlertTitle>
              <AlertDescription className="grid gap-3">
                <span>Autosave is paused here so this tab does not overwrite the other draft. Review the changed areas, then choose which one to keep. If it was imported, its matching review checklist comes with it.</span>
                {externalDraftChanges.length ? (
                  <ChangeSummaryGrid changes={externalDraftChanges} beforeLabel="This tab" afterLabel="Saved tab" />
                ) : null}
                <span className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="border-brand/40 bg-background" onClick={useExternalDraft}>
                    Use saved draft
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="border-brand/40 bg-background" onClick={keepCurrentDraft}>
                    Keep this draft
                  </Button>
                </span>
              </AlertDescription>
            </Alert>
          ) : null}

          {recoveryPoint ? (
            <Card className="mb-6 border-brand/30 bg-brand/10">
              <CardHeader data-recovery-header className="editor-pane-row flex gap-3 space-y-0">
                <div>
                  <CardTitle className="text-base">Previous resume available</CardTitle>
                  <CardDescription>
                    {recoveryPoint.label}. Stays until you restore or dismiss it.
                  </CardDescription>
                </div>
                <div className="editor-pane-actions flex shrink-0 gap-2">
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
            <Card id="import-review-panel" className="mb-6 border-warning/30 bg-warning/10">
              <CardHeader className="space-y-2">
                <div className="editor-pane-row flex gap-3">
                  <div>
                    <CardTitle className="text-base">Review the imported fields</CardTitle>
                    <CardDescription>
                      Imported from {importReview.fileName}. Check each field and confirm.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-warning/40 bg-background tabular-nums text-foreground">
                    {importReviewStatus?.reviewedCount ?? 0}/{importReview.items.length}
                  </Badge>
                </div>
                {importSkippedCoverage.length ? (
                  <CardDescription className="text-foreground">
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
                  onClick={() => completeImportReview(true)}
                >
                  <Check /> Finish review
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {blankWorkspaceOpen && blankResumeGuideVisible && !importReview ? (
            <BlankResumeGuide
              steps={blankResumeGuideSteps}
              onFocus={focusEditorTarget}
              onDismiss={() => setBlankResumeGuideVisible(false)}
            />
          ) : null}
          </div>

          {workspaceHasStarted ? (
            <SectionNav
              items={navItems}
              onJump={(targetId) => {
                if (targetId === "edit-header") expandGroup("header");
                else if (targetId === "edit-summary") expandGroup("summary");
                else if (targetId.startsWith("edit-section-")) expandGroup(targetId.slice("edit-section-".length));
              }}
            />
          ) : null}

          {workspaceHasStarted ? (
            <div className="-mt-2 mb-1 flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={toggleNavigator}
              >
                <Search /> Navigate
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
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDestructiveAction("clear")}
              >
                <RotateCcw /> Clear
              </Button>
            </div>
          ) : null}

          {workspaceHasStarted ? (
            <div className="space-y-6">
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
                <div className="editor-pane-grid grid gap-3">
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
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Links</p>
                      <p className="text-[11px] text-muted-foreground">Website, LinkedIn, GitHub, portfolio, or another profile.</p>
                    </div>
                    <Button id="add-header-link" type="button" variant="outline" size="sm" className="h-8" onClick={addHeaderLink}>
                      <Plus /> Add link
                    </Button>
                  </div>
                  {state.headerLinks.length ? (
                    <div className="overflow-hidden rounded-md border bg-muted/10">
                      {state.headerLinks.map((link, index) => {
                        const fieldLabel = link.label.trim() || `Link ${index + 1}`;
                        return (
                          <div key={link.id} data-header-link={link.id} className="flex items-center gap-2 border-b p-2 last:border-b-0">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <HeaderLinkEditorIcon link={link} />
                            </span>
                            <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_8rem] gap-2">
                              <label className="sr-only" htmlFor={`field-header-link-${link.id}-url`}>{fieldLabel} URL</label>
                              <Input
                                id={`field-header-link-${link.id}-url`}
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                spellCheck={false}
                                value={link.url}
                                placeholder="github.com/janedoe"
                                aria-label={`${fieldLabel} URL`}
                                onChange={(event) => updateHeaderLink(link.id, { url: event.target.value })}
                              />
                              <label className="sr-only" htmlFor={`field-header-link-${link.id}-icon`}>{fieldLabel} icon</label>
                              <select
                                id={`field-header-link-${link.id}-icon`}
                                value={link.icon}
                                aria-label={`${fieldLabel} icon`}
                                onChange={(event) => updateHeaderLink(link.id, { icon: event.target.value as HeaderLinkIconId })}
                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                {HEADER_LINK_ICON_OPTIONS.map((option) => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex shrink-0 items-center">
                              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === 0} aria-label={`Move ${fieldLabel} up`} onClick={() => moveHeaderLink(index, -1)}>
                                <ArrowUp />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="size-7" disabled={index === state.headerLinks.length - 1} aria-label={`Move ${fieldLabel} down`} onClick={() => moveHeaderLink(index, 1)}>
                                <ArrowDown />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${fieldLabel}`} onClick={() => removeHeaderLink(link.id)}>
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">No profile links added.</p>
                  )}
                </div>
              </FieldGroup>

              <FieldGroup id="edit-summary" title="Summary" reviewRegion className={cn(summaryActive && ACTIVE_SECTION_CLASS)} {...groupProps("summary")}>
                <TextAreaField
                  id="field-summary"
                  label="Professional Summary"
                  value={state.summary}
                  placeholder="Brief overview of your experience and strengths."
                  onChange={(value) => updateField("summary", value)}
                  aiAssist={localAIEnabled ? {
                    expanded: localAIInlineTarget?.id === "summary",
                    onClick: () => toggleLocalAIInlineEdit({ id: "summary", label: "Professional summary", value: state.summary, field: "summary" }),
                    content: localAIInlineTarget?.id === "summary" ? localAIInlinePanel : undefined,
                  } : undefined}
                />
              </FieldGroup>

              <section id="section-order-controls" tabIndex={-1} className="scroll-mt-44 space-y-3 lg:scroll-mt-16">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resume sections</h2>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">Drag to reorder. Expand a section to edit it.</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {state.sectionOrder.length} {state.sectionOrder.length === 1 ? "section" : "sections"}
                  </span>
                </div>

              {state.sectionOrder.map((section, sectionIndex) => {
                const sectionTitle = getSectionTitle(state, section);
                const sectionDisplayTitle = sectionTitle.trim() || "Untitled section";
                const customSection = !isBuiltinSection(section);
                const entries = getSectionEntries(state, section);
                const sectionFormat = getSectionFormat(state, section);
                const tagGroups = getSectionTagGroups(state, section);
                const sectionText = getSectionText(state, section);
                const sectionHidden = isSectionHidden(state, section);
                const sectionCount = sectionItemCount(state, section);
                const sectionCollapsed = collapsedGroups.has(section);
                const sectionTextAITargetId = `section-text:${section}`;
                const sectionTextAIAssist = localAIEnabled ? {
                  expanded: localAIInlineTarget?.id === sectionTextAITargetId,
                  onClick: () => toggleLocalAIInlineEdit({
                    id: sectionTextAITargetId,
                    label: `${sectionDisplayTitle} · ${SECTION_FORMAT_LABELS[sectionFormat]}`,
                    value: sectionText,
                    section,
                  }),
                  content: localAIInlineTarget?.id === sectionTextAITargetId ? localAIInlinePanel : undefined,
                } : undefined;
                const sectionIsActive =
                  activeTarget === `section-title-${section}` ||
                  activeTarget === `field-${section}` ||
                  activeTarget?.startsWith(`field-${section}-`) ||
                  activeTarget === `add-${section}-group` ||
                  activeTarget === `add-${section}-entry`;
                return (
                <div
                  key={section}
                  id={`edit-section-${section}`}
                  data-editor-section={section}
                  data-arrange-section={section}
                  className="scroll-mt-44 lg:scroll-mt-16"
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
                  id={`review-region-${section}`}
                  card
                  reviewRegion={section === "skills"}
                  className={cn(
                    sectionIsActive && ACTIVE_SECTION_CLASS,
                    sectionHidden && "opacity-60",
                    draggedSection === section && "opacity-45 ring-2 ring-muted-foreground/20",
                    dropTargetSection === section && draggedSection !== section && "border-primary bg-primary/5 ring-2 ring-primary/25",
                  )}
                  title={sectionDisplayTitle}
                  header={
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        draggable
                        aria-hidden="true"
                        title="Drag to reorder; keyboard move actions are in the section menu"
                        className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
                        onDragStart={(event) => startSectionDrag(event, section, sectionTitle)}
                        onDragEnd={finishSectionDrag}
                      >
                        <GripVertical className="size-4" />
                      </span>
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {sectionIndex + 1}
                      </span>
                      <Input
                        id={`section-title-${section}`}
                        value={sectionTitle}
                        aria-label={sectionTitle.trim() ? `${sectionTitle} section title` : "Untitled section title"}
                        onChange={(event) => updateSectionTitle(section, event.target.value)}
                        className={cn(
                          "h-8 min-w-20 flex-1 border-transparent bg-transparent px-2 text-sm font-semibold shadow-none hover:bg-muted/60 focus-visible:border-input focus-visible:bg-background",
                          sectionHidden && "text-muted-foreground line-through",
                        )}
                      />
                      {sectionCount > 0 ? (
                        <span
                          className="editor-pane-wide shrink-0 tabular-nums text-xs text-muted-foreground"
                          title={`${sectionCount} ${sectionCount === 1 ? "item" : "items"}`}
                        >
                          ({sectionCount})
                        </span>
                      ) : null}
                      {sectionFormat === "tag-groups" ? (
                        <Button
                          id={`add-${section}-group`}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 px-2"
                          aria-label={`Add group to ${sectionDisplayTitle}`}
                          onClick={() => {
                            const groupId = `group-${Date.now().toString(36)}`;
                            expandGroup(section);
                            updateSectionTagGroups(section, [
                              ...tagGroups,
                              { id: groupId, label: "", tags: [] },
                            ]);
                            window.setTimeout(() => document.getElementById(`tag-group-${groupId}-label`)?.focus(), 0);
                          }}
                        >
                          <Plus /> <span className="editor-pane-wide">Add group</span>
                        </Button>
                      ) : sectionFormat === "entries" ? (
                        <Button
                          id={`add-${section}-entry`}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 shrink-0 px-2"
                          onClick={() => {
                            expandGroup(section);
                            addEntry(section);
                          }}
                        >
                          <Plus /> <span className="editor-pane-wide">Add</span>
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={sectionHidden ? `Show ${sectionDisplayTitle} section in resume` : `Hide ${sectionDisplayTitle} section from resume`}
                        aria-pressed={sectionHidden}
                        title={sectionHidden ? "Show in resume" : "Hide from resume"}
                        onClick={() => toggleSectionHidden(section)}
                      >
                        {sectionHidden ? <EyeOff /> : <Eye />}
                      </Button>
                      <Menu>
                        <MenuTrigger>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 shrink-0"
                            aria-label={`More actions for ${sectionDisplayTitle}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </MenuTrigger>
                        <MenuContent>
                          <MenuItem disabled={sectionIndex === 0} onSelect={() => moveSection(section, -1)}>
                            <ArrowUp /> Move section up
                          </MenuItem>
                          <MenuItem disabled={sectionIndex === state.sectionOrder.length - 1} onSelect={() => moveSection(section, 1)}>
                            <ArrowDown /> Move section down
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem
                            destructive
                            onSelect={() => (customSection ? removeCustomSection(section) : removeBuiltinSection(section))}
                          >
                            <Trash2 /> Remove section
                          </MenuItem>
                        </MenuContent>
                      </Menu>
                      <button
                        type="button"
                        onClick={() => toggleGroup(section)}
                        aria-expanded={!sectionCollapsed}
                        aria-label={sectionCollapsed ? `Expand ${sectionDisplayTitle}` : `Collapse ${sectionDisplayTitle}`}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <ChevronRight className={cn("size-4 transition-transform", !sectionCollapsed && "rotate-90")} />
                      </button>
                    </div>
                  }
                >
                  <div className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                    <span id={`section-format-${section}`}>Content format</span>
                    <div
                      role="group"
                      aria-labelledby={`section-format-${section}`}
                      className="flex w-full overflow-x-auto rounded-md border border-input bg-background shadow-sm"
                    >
                      {SECTION_FORMATS.map((format, index) => (
                        <button
                          key={format}
                          type="button"
                          aria-pressed={sectionFormat === format}
                          aria-label={`${SECTION_FORMAT_LABELS[format]} format`}
                          title={SECTION_FORMAT_LABELS[format]}
                          onClick={() => updateSectionFormat(section, format)}
                          className={cn(
                            "min-w-fit flex-1 border-l px-2 py-2 text-xs font-medium transition-colors first:border-l-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            index === 0 && "border-l-0",
                            sectionFormat === format
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {SECTION_FORMAT_SHORT_LABELS[format]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] font-normal leading-snug text-muted-foreground">
                      {sectionFormat === "tag-groups"
                        ? "Use labeled groups and removable tags for concise skills, tools, languages, or competencies."
                        : sectionFormat === "entries"
                          ? "Use a heading, supporting details, and optional bullets for each item."
                          : sectionFormat === "bullets"
                            ? "Use one concise bullet per line."
                            : sectionFormat === "paragraphs"
                              ? "Use plain paragraphs for narrative or additional information."
                              : "Use one concise labeled row per line, such as Credential — Issuer, Year."}
                    </p>
                  </div>
                  {sectionFormat === "tag-groups" ? (
                    <TagGroupEditor
                      section={section}
                      groups={tagGroups}
                      activeTarget={activeTarget}
                      onChange={(groups) => updateSectionTagGroups(section, groups)}
                      onGroupCollapse={() => setActiveTarget(null)}
                    />
                  ) : sectionFormat === "bullets" ? (
                    <TextAreaField
                      id={`field-${section}-content`}
                      label={`${sectionDisplayTitle} (one bullet per line)`}
                      value={sectionText}
                      placeholder="One concise item per line"
                      onChange={(value) => updateSectionText(section, value)}
                      aiAssist={sectionTextAIAssist}
                    />
                  ) : sectionFormat === "paragraphs" ? (
                    <TextAreaField
                      id={`field-${section}-content`}
                      label={`${sectionDisplayTitle} paragraphs`}
                      value={sectionText}
                      placeholder="Write one or more concise paragraphs."
                      onChange={(value) => updateSectionText(section, value)}
                      aiAssist={sectionTextAIAssist}
                    />
                  ) : sectionFormat === "labeled-rows" ? (
                    <TextAreaField
                      id={`field-${section}-content`}
                      label={`${sectionDisplayTitle} (one labeled row per line)`}
                      value={sectionText}
                      placeholder="Certification — Issuer, 2025"
                      onChange={(value) => updateSectionText(section, value)}
                      aiAssist={sectionTextAIAssist}
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
                      aiTargetId={localAIEnabled && localAIInlineTarget?.section ? localAIInlineTarget.id : null}
                      aiPanel={localAIInlinePanel}
                      onAIEdit={localAIEnabled ? toggleLocalAIInlineEdit : undefined}
                      onEntryCollapse={() => setActiveTarget(null)}
                    />
                  )}
                </FieldGroup>
                </div>
              );})}

                <div className="rounded-lg border border-dashed bg-muted/20 p-3">
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
                          const id = addCustomSection(title, CUSTOM_SECTION_PRESET_FORMATS[title]);
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
              </section>
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
            "preview-pane overflow-y-auto bg-stage p-4 lg:max-h-[calc(100vh-73px)] lg:p-7",
            mobileWorkspaceView !== "preview" && "mobile-workspace-hidden",
          )}
          aria-label="Resume preview"
        >
          <div className={cn(
            "mx-auto flex w-full items-start gap-3",
            historyOpen ? "max-w-[calc(8.5in+17rem)] flex-col lg:flex-row" : "max-w-[8.5in]",
          )}>
          <div ref={previewWrapRef} className="flex w-full min-w-0 max-w-[8.5in] flex-1 flex-col items-center gap-3">
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
                  <Palette /> <span className="hidden 2xl:inline">Design</span>
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
                  aria-label={inlineEdit ? "Editing mode — switch to view only" : "View only mode — switch to editing"}
                  onClick={() => setInlineEdit((value) => !value)}
                  title={inlineEdit ? "Editing is on — switch to view only" : "View only — switch to editing"}
                >
                  {inlineEdit ? (
                    <>
                      <Pencil />
                      <span>Editing</span>
                    </>
                  ) : (
                    <><Eye /> <span>View only</span></>
                  )}
                </Button>
                <div
                  aria-live="polite"
                  data-autosave-status={storageIssue ? "conflict" : autosaveStatus}
                  aria-label={
                    storageIssue
                      ? "Browser autosave unavailable"
                      : autosaveStatus === "saving"
                        ? "Saving locally"
                        : autosaveStatus === "conflict"
                          ? "Autosave paused for another tab"
                          : "Saved locally"
                  }
                  title={
                    storageIssue
                      ? "Autosave unavailable — save a JSON copy to keep your work"
                      : autosaveStatus === "saving"
                        ? "Saving this resume in this browser…"
                        : autosaveStatus === "conflict"
                          ? "Autosave paused until you choose which tab's draft to keep"
                          : "Saved in this browser"
                  }
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-xs text-muted-foreground"
                >
                  {autosaveStatus === "saving" && !storageIssue ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : storageIssue || autosaveStatus === "conflict" ? (
                    <AlertCircle className="size-3.5 text-warning" aria-hidden="true" />
                  ) : (
                    <Check className="size-3.5 text-success" aria-hidden="true" />
                  )}
                  <span>{storageIssue || autosaveStatus === "conflict" ? "Not saved" : autosaveStatus === "saving" ? "Saving" : "Saved"}</span>
                </div>
                <Button
                  type="button"
                  variant={historyOpen ? "secondary" : "outline"}
                  size="icon"
                  className="hidden size-8 lg:inline-flex"
                  aria-label="Edit history"
                  aria-expanded={historyOpen}
                  aria-controls="edit-history-panel"
                  title={historyOpen ? "Close this resume's checkpoint timeline" : "Open this resume's checkpoint timeline"}
                  onClick={() => setHistoryOpen((open) => !open)}
                >
                  <History />
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
                <Button type="button" variant={historyOpen ? "secondary" : "outline"} size="sm" className="lg:hidden" aria-expanded={historyOpen} aria-controls="edit-history-panel" onClick={() => setHistoryOpen((open) => !open)}>
                  <History /> History
                </Button>
              </div>
            </div>
            {workspaceHasStarted && designOpen ? (
              <div id="design-panel" data-print-exclude="" className="w-full rounded-lg border bg-card p-4 shadow-sm">
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
                  state={previewState}
                pageCount={pageCount}
                pageGuides={pageGuides}
                printBreaks={printBreaks}
                ref={resumeRef}
                activeTarget={historyPreviewItem ? null : activeTarget}
                onTargetSelect={historyPreviewItem ? undefined : focusEditorTarget}
                editable={inlineEdit && workspaceHasStarted && !printing && !historyPreviewItem}
                onEditField={(field, value) => updateField(field as Parameters<typeof updateField>[0], value)}
                onEditHeaderLink={updateHeaderLink}
                onEditSectionTitle={updateSectionTitle}
                onEditEntry={updateEntry}
                onEditTagGroup={(section, groupId, patch) => updateSectionTagGroups(
                  section,
                  getSectionTagGroups(state, section).map((group) => group.id === groupId ? { ...group, ...patch } : group),
                )}
              />
            </div>
          </div>
          <VersionHistoryCard
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            hasContent={hasContent}
            versions={editor.versionHistory}
            current={currentHistoryPoint}
            autosave={autosaveCopy}
            currentFingerprint={editor.exportFingerprint}
            storageIssue={storageIssue}
            deletedVersion={editor.deletedVersion}
            onSave={editor.openVersionSave}
            onSaveBackup={editor.saveVersionHistoryBackup}
            onOpenBackup={() => editor.historyBackupInputRef.current?.click()}
            onClear={() => setDestructiveAction("clear-checkpoints")}
            onRestore={editor.restoreVersion}
            onDelete={editor.deleteVersion}
            onUndoDelete={editor.undoDeleteVersion}
            onDismissDeleted={() => editor.setDeletedVersion(null)}
            onPreview={setHistoryPreviewItem}
          />
          </div>
        </section>
      </main>

      <Dialog
        open={destructiveAction !== null}
        onOpenChange={(open) => {
          if (!open) setDestructiveAction(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {destructiveAction === "delete-all"
                ? "Delete all browser data?"
                : destructiveAction === "clear-checkpoints"
                  ? "Clear all checkpoints?"
                  : "Clear this resume?"}
            </DialogTitle>
            <DialogDescription>
              {destructiveAction === "delete-all"
                ? "This removes the resume library, edit history, imported text, Local AI settings, and downloaded model files from this browser. This cannot be undone. Export JSON first if you want to keep a copy."
                : destructiveAction === "clear-checkpoints"
                  ? "This removes every saved checkpoint for the current resume. Your live draft and autosave stay intact. This cannot be undone."
                  : "This clears every resume field. You can restore the current version from the recovery card."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDestructiveAction(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const action = destructiveAction;
                setDestructiveAction(null);
                if (action === "delete-all") {
                  setBlankWorkspaceOpen(false);
                  setBlankResumeGuideVisible(false);
                  void deleteSavedBrowserData();
                } else if (action === "clear-checkpoints") {
                  setHistoryPreviewItem(null);
                  editor.clearVersionHistory();
                } else if (action === "clear") {
                  clearEditor();
                }
              }}
            >
              {destructiveAction === "delete-all"
                ? "Delete all data"
                : destructiveAction === "clear-checkpoints"
                  ? "Clear checkpoints"
                  : "Clear resume"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ResumeNavigator
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        items={navigatorItems}
        query={navigatorQuery}
        onQueryChange={setNavigatorQuery}
        onSelect={focusEditorTarget}
      />

      <Dialog open={checksReviewOpen} onOpenChange={setChecksReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resume review</DialogTitle>
            <DialogDescription>
              Review every check at a glance, then walk through each one on your resume.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2" aria-label="Resume checks">
            {checks.map((check) => {
              const passed = check.ok && !check.advisory;
              const status = passed ? "Passed" : check.advisory ? "Suggestion" : "Review";
              return (
                <div key={check.id} data-resume-check={check.id} className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                      passed ? "bg-success/15 text-success" : check.advisory ? "bg-brand/10 text-brand" : "bg-warning/20 text-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {passed ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{check.label}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                    {!passed ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p> : null}
                  </div>
                  <Badge variant="outline" className={cn("shrink-0", passed && "border-success/30 text-success", check.advisory && "border-brand/30 text-brand")}>
                    {status}
                  </Badge>
                </div>
              );
            })}
          </div>
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{passedChecks} of {checks.length} checks passed</span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setChecksReviewOpen(false)}>Close</Button>
              <Button type="button" onClick={startChecksTour}>
                <ClipboardCheck /> Start walkthrough
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReviewDrawer
        editor={editor}
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        onOpenChecksReview={openChecksReview}
        onOpenApplicationCopy={() => {
          setToolsOpen(false);
          setApplicationCopyOpen(true);
        }}
        localAIEnabled={localAIEnabled}
        onOpenLocalAI={() => {
          setToolsOpen(false);
          setLocalAIOpen(true);
        }}
        onOpenNavigator={() => {
          setToolsOpen(false);
          setNavigatorOpen(true);
        }}
        isDarkTheme={isDarkTheme}
        onToggleTheme={() => setIsDarkTheme(toggleTheme())}
        feedbackUrl={FEEDBACK_URL}
      />

      {localAIEnabled ? (
        <LocalAIDialog
          open={localAIOpen}
          onOpenChange={setLocalAIOpen}
        />
      ) : null}

      <ResumeLibraryCard
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        items={editor.resumeLibrary.map((item) => item.id === editor.activeResumeId ? { ...item, state } : item)}
        activeResumeId={editor.activeResumeId}
        onCreate={editor.createResume}
        onOpen={editor.switchResume}
        onDuplicate={editor.duplicateResume}
        onRename={editor.renameResume}
        onDelete={editor.deleteResume}
      />

      <GuidedReview
        open={Boolean(reviewTour) && tourSteps.length > 0}
        title={reviewTour?.kind === "import" ? "Import review" : "Resume review"}
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
