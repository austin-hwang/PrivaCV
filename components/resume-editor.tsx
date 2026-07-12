"use client";

import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertCircle,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  FileJson,
  FileText,
  GripVertical,
  MoreHorizontal,
  Plus,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EntryList, FieldGroup, TextAreaField, TextField } from "@/components/resume-editor/editor-fields";
import { ResumeEditorOverlays } from "@/components/resume-editor/resume-editor-overlays";
import { ResumePreview } from "@/components/resume-editor/resume-preview";
import { ReviewDrawer } from "@/components/resume-editor/review-drawer";
import { SectionNav, type SectionNavItem } from "@/components/resume-editor/section-nav";
import { StartPanel } from "@/components/resume-editor/start-panel";
import { RestoredVersionCard } from "@/components/resume-editor/version-changes";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import {
  ACCENT_PRESETS,
  clampTextScale,
  CUSTOM_SECTION_PRESETS,
  DENSITIES,
  DENSITY_LABELS,
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
  const [importChecklistOpen, setImportChecklistOpen] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [blankWorkspaceOpen, setBlankWorkspaceOpen] = useState(false);
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<string | null>(null);
  const {
    addCustomSection,
    addBuiltinSection,
    addEntry,
    checks,
    clearResume,
    dismissRecoveryPoint,
    exportCheckpoint,
    exportIsCurrent,
    focusCheckTarget,
    focusFromExportCheck,
    focusFromVersionCompare,
    hasContent,
    historyBackupInputRef,
    importReview,
    importReviewItemsByTarget,
    importReviewStatus,
    importReviewTargets,
    isImporting,
    jsonInputRef,
    loadSample,
    moveEntry,
    moveSection,
    pageCount,
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
    setTextImportOpen,
    state,
    storageIssue,
    swapExperienceTitleAndCompany,
    updateEntry,
    updateField,
    updateSectionTitle,
    toggleImportReviewItem,
    completeImportReview,
    dismissRestoredVersionSummary,
    versionHistory,
    visibleRestoredVersionSummary,
  } = editor;
  const workspaceHasStarted = hasContent || blankWorkspaceOpen;

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

  const focusEditorTarget = (targetId: string) => {
    setActiveTarget(targetId);
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  };
  const focusEditorFromExportCheck = (targetId: string) => {
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    focusFromExportCheck(targetId);
  };
  const focusEditorFromVersionCompare = (targetId: string) => {
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    focusFromVersionCompare(targetId);
  };

  const nextImportReviewItem = importReview?.items.find(
    (item) => !importReview.reviewedItemIds?.includes(item.id),
  );
  const importCoverage = importReview?.coverage ?? (importReview ? buildImportCoverage(state, importReview.sourceText) : []);

  const checksReady = passedChecks === checks.length;
  const exportStale = Boolean(exportCheckpoint) && !exportIsCurrent;
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
            <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">Resume Editor</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
                <MenuSeparator />
                <MenuLabel>Export & files</MenuLabel>
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

      <main className="app-shell grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[minmax(390px,1fr)_minmax(440px,1fr)]">
        <section
          id="resume-editor-pane"
          aria-label="Resume editor"
          onFocusCapture={(event) => {
            const target = event.target as HTMLElement;
            if (target.id?.startsWith("field-") || target.id?.startsWith("section-title-")) setActiveTarget(target.id);
          }}
          className={cn(
            "editor-pane overflow-y-auto border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:px-6 lg:pb-6 lg:pt-0",
            mobileWorkspaceView !== "editor" && "mobile-workspace-hidden",
          )}
        >
          {!workspaceHasStarted ? (
            <StartPanel
              isImporting={isImporting}
              storageIssue={storageIssue}
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
            <Card className="mb-5 border-amber-200 bg-amber-50/60 lg:hidden">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                      Imported resume
                    </CardDescription>
                    <CardTitle className="text-base">Keep editing; confirm each imported field.</CardTitle>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-amber-300 bg-background tabular-nums text-amber-950">
                    {importReviewStatus?.reviewedCount ?? 0}/{importReview.items.length}
                  </Badge>
                </div>
                <CardDescription>
                  {nextImportReviewItem
                    ? `Next: ${nextImportReviewItem.label}. Edit it if needed, then confirm it beside the field.`
                    : "Every suggested field is confirmed. Open the checklist to finish this review."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {nextImportReviewItem ? (
                  <Button type="button" size="sm" onClick={() => focusEditorTarget(nextImportReviewItem.targetId)}>
                    <ArrowRight /> Review next imported field
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => setImportChecklistOpen(true)}>
                  {nextImportReviewItem ? "Open checklist" : "Finish checklist"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {importReview ? (
            <Card
              id="import-review-panel"
              className={cn("mb-6 border-amber-200 bg-amber-50/60", !importChecklistOpen && "hidden", "lg:block")}
            >
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                      Import review
                    </CardDescription>
                    <CardTitle className="text-base">Confirm the fields the importer can misread.</CardTitle>
                    <CardDescription>
                      Imported from {importReview.fileName}. Review each suggested field, then explicitly confirm it before exporting.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="w-fit border-amber-300 bg-background tabular-nums text-amber-950">
                    {importReviewStatus?.reviewedCount ?? 0} of {importReview.items.length} confirmed
                  </Badge>
                </div>
                <Button type="button" variant="ghost" size="sm" className="w-fit lg:hidden" onClick={() => setImportChecklistOpen(false)}>
                  Back to editing
                </Button>
                <div className="flex flex-wrap gap-2">
                  {importReview.sections.map((section) => (
                    <Badge key={section} variant="secondary">
                      {section}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-amber-200 bg-background p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                    <p className="text-sm font-semibold text-amber-950">What the importer detected</p>
                    <p className="text-xs text-muted-foreground">A quick coverage check before you confirm.</p>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    “Not detected” means the importer did not place content there. When a source heading is found, it is called out so you can correct a skipped section quickly.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {importCoverage.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex min-h-16 items-start gap-2 rounded-md border p-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          item.detected ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50",
                        )}
                        onClick={() => focusEditorTarget(item.targetId)}
                      >
                        {item.detected ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-800" /> : <Eye className="mt-0.5 size-4 shrink-0 text-amber-800" />}
                        <span>
                          <span className="block text-sm font-medium text-foreground">{item.label}</span>
                          <span className="block text-xs leading-snug text-muted-foreground">{item.detail}</span>
                          {item.sourceDetected && !item.detected ? (
                            <span className="mt-1 block text-xs font-medium text-amber-950">Source section needs review</span>
                          ) : null}
                          {item.sourceExcerpt ? (
                            <span className="mt-2 block whitespace-pre-line rounded border border-current/15 bg-background/70 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-foreground">
                              <span className="font-sans font-semibold">Source excerpt: </span>{item.sourceExcerpt}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {nextImportReviewItem ? (
                  <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium">Next: review {nextImportReviewItem.label.toLocaleLowerCase()} where it appears in the editor.</p>
                    <Button type="button" size="sm" className="shrink-0" onClick={() => focusEditorTarget(nextImportReviewItem.targetId)}>
                      <ArrowRight /> Review next field
                    </Button>
                  </div>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2">
                  {importReview.items.map((item) => {
                    const confirmed = Boolean(importReview.reviewedItemIds?.includes(item.id));
                    return (
                      <div key={item.id} className={cn("min-h-24 rounded-md border bg-background p-3", confirmed && "border-emerald-200 bg-emerald-50/50")}>
                        <div className="flex gap-2">
                          {confirmed ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-800" /> : <Eye className="mt-0.5 size-4 shrink-0 text-amber-800" />}
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                            <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => focusEditorTarget(item.targetId)}>
                            <ArrowRight /> Review field
                          </Button>
                          <Button
                            type="button"
                            variant={confirmed ? "secondary" : "outline"}
                            size="sm"
                            className="h-7 px-2"
                            aria-pressed={confirmed}
                            onClick={() => toggleImportReviewItem(item.id)}
                          >
                            <Check /> {confirmed ? "Confirmed" : "Mark reviewed"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {importReview.sourceText ? (
                  <details className="rounded-md border border-amber-200 bg-background p-3">
                    <summary className="cursor-pointer text-sm font-medium text-amber-950 marker:text-amber-800">
                      View the text used for this import
                    </summary>
                    <p className="mt-2 text-xs leading-snug text-muted-foreground">
                      Compare this extracted text with the editable fields above as you correct them. It stays in this browser during this review.
                    </p>
                    <Textarea
                      className="mt-3 min-h-40 resize-y font-mono text-xs leading-relaxed"
                      value={importReview.sourceText}
                      readOnly
                      aria-label="Imported source text"
                    />
                  </details>
                ) : null}
                <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-snug text-muted-foreground">
                    {importReviewStatus?.isComplete
                      ? "All suggested fields are confirmed. Finish this review to clear the export reminder."
                      : `${importReviewStatus?.remainingCount ?? importReview.items.length} suggested ${importReviewStatus?.remainingCount === 1 ? "field still needs" : "fields still need"} your confirmation.`}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={completeImportReview} disabled={!importReviewStatus?.isComplete}>
                    <Check /> Finish review
                  </Button>
                </div>
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
            <div className="space-y-6">
              <FieldGroup id="edit-layout" title="Design">
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
                            title={accent.label}
                            onClick={() => updateTheme({ accent: accent.value })}
                            className={cn(
                              "size-7 rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                              selected ? "ring-2 ring-ring ring-offset-1" : "hover:scale-110",
                            )}
                            style={{ backgroundColor: accent.value, borderColor: "rgb(0 0 0 / 12%)" }}
                          >
                            <span className="sr-only">{accent.label}</span>
                          </button>
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
              <FieldGroup title="Arrange sections">
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
              <FieldGroup id="edit-header" title="Header">
                <TextField
                  id="field-name"
                  label="Full Name"
                  value={state.name}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  spellCheck={false}
                  reviewTarget={importReviewTargets.has("field-name")}
                  reviewItem={importReviewItemsByTarget.get("field-name")}
                  onToggleReview={toggleImportReviewItem}
                  onChange={(value) => updateField("name", value)}
                />
                <TextField
                  id="field-title"
                  label="Title / Role"
                  value={state.title}
                  placeholder="Senior Software Engineer"
                  autoComplete="organization-title"
                  spellCheck
                  reviewTarget={importReviewTargets.has("field-title")}
                  reviewItem={importReviewItemsByTarget.get("field-title")}
                  onToggleReview={toggleImportReviewItem}
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
                    reviewTarget={importReviewTargets.has("field-email")}
                    reviewItem={importReviewItemsByTarget.get("field-email")}
                    onToggleReview={toggleImportReviewItem}
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
                    reviewTarget={importReviewTargets.has("field-phone")}
                    reviewItem={importReviewItemsByTarget.get("field-phone")}
                    onToggleReview={toggleImportReviewItem}
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
                  reviewTarget={importReviewTargets.has("field-location")}
                  reviewItem={importReviewItemsByTarget.get("field-location")}
                  onToggleReview={toggleImportReviewItem}
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
                  reviewTarget={importReviewTargets.has("field-website")}
                  reviewItem={importReviewItemsByTarget.get("field-website")}
                  onToggleReview={toggleImportReviewItem}
                  onChange={(value) => updateField("website", value)}
                />
              </FieldGroup>

              <FieldGroup id="edit-summary" title="Summary">
                <TextAreaField
                  id="field-summary"
                  label="Professional Summary"
                  value={state.summary}
                  placeholder="Brief overview of your experience and strengths."
                  reviewTarget={importReviewTargets.has("field-summary")}
                  reviewItem={importReviewItemsByTarget.get("field-summary")}
                  onToggleReview={toggleImportReviewItem}
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
                        disabled={sectionIndex === state.sectionOrder.length - 1}
                        onClick={() => moveSection(section, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      {section !== "skills" ? (
                        <Button id={`add-${section}-entry`} type="button" variant="outline" size="sm" onClick={() => addEntry(section)}>
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
                      reviewTarget={importReviewTargets.has("field-skills")}
                      onChange={(value) => updateField("skills", value)}
                    />
                  ) : (
                    <EntryList
                      section={section}
                      sectionLabel={sectionTitle}
                      entries={entries}
                      reviewTargets={importReviewTargets}
                      reviewItemsByTarget={importReviewItemsByTarget}
                      onUpdate={updateEntry}
                      onMove={moveEntry}
                      onReorder={reorderEntry}
                      onRemove={removeEntry}
                      onSwapTitleAndSubtitle={swapExperienceTitleAndCompany}
                      onToggleReview={toggleImportReviewItem}
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
            <div className="app-chrome flex w-full items-center justify-between gap-3">
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
                <p className="truncate text-xs text-muted-foreground">
                  {pageCount} {pageCount === 1 ? "page" : "pages"} in preview
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0 lg:hidden" onClick={() => setMobileWorkspaceView("editor")}>
                <FileText /> Edit resume
              </Button>
            </div>
            <div className="resume-preview-sheet-frame" style={previewFrameStyle}>
              <ResumePreview
                state={state}
                pageCount={pageCount}
                ref={resumeRef}
                activeTarget={activeTarget}
                onTargetSelect={focusEditorTarget}
              />
            </div>
          </div>
        </section>
      </main>

      <ReviewDrawer
        editor={editor}
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        onFocusTarget={focusEditorTarget}
      />

      <ResumeEditorOverlays
        editor={{
          ...editor,
          focusFromExportCheck: focusEditorFromExportCheck,
          focusFromVersionCompare: focusEditorFromVersionCompare,
        }}
      />
    </>
  );
}
