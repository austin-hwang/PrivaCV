"use client";

import dynamic from "next/dynamic";
import {
  ChevronsDownUp,
  Eye,
  FileText,
  History,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { ResumePreview } from "@/features/resume/components/resume-preview";
import { VersionHistoryCard } from "@/features/resume/components/version-history-card";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import type { useResumeWorkspaceUI } from "@/features/resume/hooks/use-resume-workspace-ui";
import {
  clampTextScale,
  getSectionTagGroups,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  type HeaderLink,
  type ResumeState,
} from "@/lib/resume";
import type { VersionHistoryItem } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

const LocalAIImportFix = dynamic(
  () =>
    import("@/features/resume/components/local-ai-import-fix").then(
      (module) => module.LocalAIImportFix,
    ),
  { ssr: false },
);

type ResumeEditorController = ReturnType<typeof useResumeEditor>;
type ResumeWorkspaceUI = ReturnType<typeof useResumeWorkspaceUI>;

export function ResumePreviewPane({
  editor,
  ui,
  previewState,
  currentHistoryPoint,
  autosaveCopy,
  designControls,
  aiImportFixEnabled,
  currentImportSourceText,
  usingCurrentDraftForAIImport,
  focusEditorTarget,
  updateHeaderLink,
}: {
  editor: ResumeEditorController;
  ui: ResumeWorkspaceUI;
  previewState: ResumeState;
  currentHistoryPoint: VersionHistoryItem;
  autosaveCopy: VersionHistoryItem | null;
  designControls: ReactNode;
  aiImportFixEnabled: boolean;
  currentImportSourceText: string;
  usingCurrentDraftForAIImport: boolean;
  focusEditorTarget: (targetId: string) => void;
  updateHeaderLink: (
    id: string,
    patch: Partial<Pick<HeaderLink, "label" | "url" | "icon">>,
  ) => void;
}) {
  const {
    activeTarget,
    designOpen,
    editorCollapsed,
    historyOpen,
    historyPreviewItem,
    inlineEdit,
    localAIImportOpen,
    mobileWorkspaceView,
    previewFrameStyle,
    previewWrapRef,
    printing,
    workspaceHasStarted,
    setDesignOpen,
    setDestructiveAction,
    setEditorCollapsed,
    setHistoryOpen,
    setHistoryPreviewItem,
    setInlineEdit,
    setLocalAIImportOpen,
    setLocalAIOpen,
    setMobileWorkspaceView,
  } = ui;
  const {
    applyAIImportFix,
    hasContent,
    importReview,
    pageCount,
    pageGuides,
    printBreaks,
    resumeRef,
    state,
    storageIssue,
    tightenLayout,
    updateEntry,
    updateField,
    updateSectionTagGroups,
    updateSectionTitle,
  } = editor;
  const canTightenLayout = state.theme.density !== "compact" || state.textScale > MIN_TEXT_SCALE;

  return (
    <section
      id="resume-preview-pane"
      className={cn(
        "preview-pane overflow-y-auto bg-stage p-4 lg:max-h-[calc(100vh-73px)] lg:p-7",
        mobileWorkspaceView !== "preview" && "mobile-workspace-hidden",
      )}
      aria-label="Resume preview"
    >
      <div
        className={cn(
          "mx-auto flex w-full items-start gap-3",
          historyOpen ? "max-w-[calc(8.5in+17rem)] flex-col lg:flex-row" : "max-w-[8.5in]",
        )}
      >
        <div
          ref={previewWrapRef}
          className="flex w-full min-w-0 max-w-[8.5in] flex-1 flex-col items-center gap-3"
        >
          <div className="app-chrome preview-toolbar flex w-full items-center gap-2 overflow-x-auto pb-1">
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
                <Palette data-icon="inline-start" />{" "}
                <span className="preview-toolbar-label">Design</span>
              </Button>
            ) : null}
            <Field
              orientation="horizontal"
              className="preview-toolbar-optional h-8 w-auto shrink-0 items-center gap-2 rounded-md border bg-background px-2 text-xs text-muted-foreground"
            >
              <FieldLabel className="sr-only" htmlFor="resume-text-scale">
                Resume text size
              </FieldLabel>
              <Slider
                id="resume-text-scale"
                aria-label="Resume text size"
                className="w-20 2xl:w-24"
                minValue={MIN_TEXT_SCALE}
                maxValue={MAX_TEXT_SCALE}
                step={0.02}
                value={state.textScale}
                onChange={(value) =>
                  updateField(
                    "textScale",
                    clampTextScale(Number(Array.isArray(value) ? value[0] : value)),
                  )
                }
              />
              <output className="w-9 text-right tabular-nums">
                {Math.round(state.textScale * 100)}%
              </output>
            </Field>
            <p className="shrink-0 text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"}
              <span className="preview-toolbar-label"> in preview</span>
            </p>
            {pageCount > 1 && canTightenLayout ? (
              <TooltipTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1.5 px-2 text-xs"
                  onClick={tightenLayout}
                  aria-label={
                    state.theme.density === "compact" ? "Reduce text 2%" : "Try compact spacing"
                  }
                >
                  <ChevronsDownUp data-icon="inline-start" />
                  <span className="preview-toolbar-label">
                    {state.theme.density === "compact" ? "Reduce text 2%" : "Compact spacing"}
                  </span>
                </Button>
                <Tooltip>
                  Uses compact spacing first, then reduces text size by 2%. Your resume content
                  stays unchanged.
                </Tooltip>
              </TooltipTrigger>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {aiImportFixEnabled && importReview ? (
                <TooltipTrigger>
                  <Button
                    type="button"
                    variant={localAIImportOpen ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 gap-1.5 px-2"
                    aria-label="Fix import with AI"
                    isDisabled={!currentImportSourceText}
                    onClick={() => setLocalAIImportOpen(true)}
                  >
                    <Sparkles data-icon="inline-start" />{" "}
                    <span className="preview-toolbar-label">Fix import with AI</span>
                  </Button>
                  <Tooltip>
                    {importReview.sourceText
                      ? "Remap the original extracted text with local AI"
                      : "Reorganize the current parsed draft with local AI; re-import first to recover omitted source text"}
                  </Tooltip>
                </TooltipTrigger>
              ) : null}
              <TooltipTrigger>
                <Button
                  type="button"
                  variant={inlineEdit ? "default" : "outline"}
                  size="sm"
                  className="hidden h-8 gap-1.5 px-2 lg:inline-flex"
                  aria-pressed={inlineEdit}
                  aria-label={
                    inlineEdit
                      ? "Editing mode — switch to view only"
                      : "View only mode — switch to editing"
                  }
                  onClick={() => setInlineEdit((value) => !value)}
                >
                  {inlineEdit ? (
                    <>
                      <Pencil data-icon="inline-start" />
                      <span className="preview-toolbar-label">Editing</span>
                    </>
                  ) : (
                    <>
                      <Eye data-icon="inline-start" />
                      <span className="preview-toolbar-label">View only</span>
                    </>
                  )}
                </Button>
                <Tooltip>
                  {inlineEdit
                    ? "Editing is on — switch to view only"
                    : "View only — switch to editing"}
                </Tooltip>
              </TooltipTrigger>
              <TooltipTrigger>
                <Button
                  type="button"
                  variant={historyOpen ? "secondary" : "outline"}
                  size="icon"
                  className="hidden size-8 lg:inline-flex"
                  aria-label="Edit history"
                  aria-expanded={historyOpen}
                  aria-controls="edit-history-panel"
                  onClick={() => setHistoryOpen((open) => !open)}
                >
                  <History data-icon="inline-start" />
                </Button>
                <Tooltip>
                  {historyOpen
                    ? "Close this resume's checkpoint timeline"
                    : "Open this resume's checkpoint timeline"}
                </Tooltip>
              </TooltipTrigger>
              <TooltipTrigger>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden size-8 lg:inline-flex"
                  aria-pressed={editorCollapsed}
                  aria-label={editorCollapsed ? "Show editor" : "Hide editor"}
                  onClick={() => setEditorCollapsed((value) => !value)}
                >
                  {editorCollapsed ? (
                    <PanelLeftOpen data-icon="inline-start" />
                  ) : (
                    <PanelLeftClose data-icon="inline-start" />
                  )}
                </Button>
                <Tooltip>
                  {editorCollapsed
                    ? "Show the editor panel"
                    : "Hide the editor panel for a focused canvas"}
                </Tooltip>
              </TooltipTrigger>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileWorkspaceView("editor")}
              >
                <FileText data-icon="inline-start" /> Edit resume
              </Button>
              <Button
                type="button"
                variant={historyOpen ? "secondary" : "outline"}
                size="sm"
                className="lg:hidden"
                aria-label="Edit history"
                aria-expanded={historyOpen}
                aria-controls="edit-history-panel"
                onClick={() => setHistoryOpen((open) => !open)}
              >
                <History data-icon="inline-start" />{" "}
                <span className="preview-toolbar-label">History</span>
              </Button>
            </div>
          </div>
          {workspaceHasStarted && designOpen ? (
            <div
              id="design-panel"
              data-print-exclude=""
              className="w-full rounded-lg border bg-card p-4 shadow-xs"
            >
              {designControls}
            </div>
          ) : null}
          {aiImportFixEnabled && localAIImportOpen && importReview && currentImportSourceText ? (
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
              onEditField={(field, value) =>
                updateField(field as Parameters<typeof updateField>[0], value)
              }
              onEditHeaderLink={updateHeaderLink}
              onEditSectionTitle={updateSectionTitle}
              onEditEntry={updateEntry}
              onEditTagGroup={(section, groupId, patch) =>
                updateSectionTagGroups(
                  section,
                  getSectionTagGroups(state, section).map((group) =>
                    group.id === groupId ? { ...group, ...patch } : group,
                  ),
                )
              }
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
  );
}
