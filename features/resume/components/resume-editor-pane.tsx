"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/features/resume/components/editor-fields";
import { ResumeHeaderFields } from "@/features/resume/components/header-fields";
import { RichTextEditor } from "@/features/resume/components/rich-text-editor";
import { ResumeSectionList } from "@/features/resume/components/resume-section-list";
import { SectionNav, type SectionNavItem } from "@/features/resume/components/section-nav";
import { StartPanel } from "@/features/resume/components/start-panel";
import { ChangeSummaryGrid } from "@/features/resume/components/version-changes";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import type {
  LocalAIInlineTarget,
  useResumeWorkspaceUI,
} from "@/features/resume/hooks/use-resume-workspace-ui";
import type { ExportChange, HeaderLink, ResumeTemplateId } from "@/lib/resume";
import type { ImportCoverageItem } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

const ACTIVE_SECTION_CLASS = "rounded-md bg-brand-soft/10 px-3 pt-3 ring-1 ring-brand/40";
const HEADER_FIELD_IDS = [
  "field-name",
  "field-title",
  "field-email",
  "field-phone",
  "field-location",
];
const isHeaderTarget = (targetId: string) =>
  HEADER_FIELD_IDS.includes(targetId) ||
  targetId.startsWith("field-header-link-") ||
  targetId === "add-header-link";

type ResumeEditorController = ReturnType<typeof useResumeEditor>;
type ResumeWorkspaceUI = ReturnType<typeof useResumeWorkspaceUI>;

export function ResumeEditorPane({
  editor,
  ui,
  navItems,
  externalDraftChanges,
  importSkippedCoverage,
  localAIInlinePanel,
  headerActions,
  startBlankResume,
  startImportTour,
  toggleNavigator,
  expandGroup,
  toggleLocalAIInlineEdit,
  focusEditorTarget,
}: {
  editor: ResumeEditorController;
  ui: ResumeWorkspaceUI;
  navItems: SectionNavItem[];
  externalDraftChanges: ExportChange[];
  importSkippedCoverage: ImportCoverageItem[];
  localAIInlinePanel: ReactNode;
  headerActions: {
    update: (id: string, patch: Partial<Pick<HeaderLink, "label" | "url" | "icon">>) => void;
    add: () => void;
    remove: (id: string) => void;
    move: (index: number, direction: -1 | 1) => void;
  };
  startBlankResume: (template?: ResumeTemplateId) => void;
  startImportTour: () => void;
  toggleNavigator: () => void;
  expandGroup: (groupId: string) => void;
  toggleLocalAIInlineEdit: (target: LocalAIInlineTarget) => void;
  focusEditorTarget: (targetId: string) => void;
}) {
  const {
    completeImportReview,
    dismissRecoveryPoint,
    externalDraft,
    historyBackupInputRef,
    importFileInputRef,
    importReview,
    importReviewStatus,
    isImporting,
    jsonInputRef,
    keepCurrentDraft,
    loadSample,
    recoveryPoint,
    restoreRecoveryPoint,
    saveJson,
    setTextImportOpen,
    state,
    storageIssue,
    updateField,
    useExternalDraft,
  } = editor;
  const {
    activeTarget,
    collapsedGroups,
    editorCollapsed,
    localAIEnabled,
    localAIInlineTarget,
    mobileWorkspaceView,
    workspaceHasStarted,
    setActiveTarget,
    setBlankTemplatePreview,
    setCollapsedGroups,
    setDestructiveAction,
  } = ui;
  const toggleGroup = (groupId: string) =>
    setCollapsedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  const editorGroupIds = ["header", "summary", ...state.sectionOrder];
  const allCollapsed = editorGroupIds.every((groupId) => collapsedGroups.has(groupId));
  const headerActive = Boolean(activeTarget && isHeaderTarget(activeTarget));
  const summaryActive = activeTarget === "field-summary";

  return (
    <section
      id="resume-editor-pane"
      aria-label="Resume editor"
      onFocusCapture={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("[data-tag-group-toggle]")) return;
        const tagGroup = target.closest<HTMLElement>("[data-editor-tag-group]");
        if (tagGroup?.id) setActiveTarget(tagGroup.id);
        else if (target.id?.startsWith("field-") || target.id?.startsWith("section-title-"))
          setActiveTarget(target.id);
      }}
      className={cn(
        "editor-pane relative overflow-visible border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:overflow-y-auto lg:border-b-0 lg:px-6 lg:pb-6 lg:pt-0",
        mobileWorkspaceView !== "editor" && "mobile-workspace-hidden",
        editorCollapsed && "lg:hidden",
      )}
    >
      <div className="lg:not-empty:pt-6">
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
              <span>
                Your edits remain open here, but may not survive a refresh. Save a JSON copy before
                closing this tab.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit border-warning/50 bg-background"
                onClick={saveJson}
              >
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
              <span>
                Autosave is paused here so this tab does not overwrite the other draft. Review the
                changed areas, then choose which one to keep. If it was imported, its matching
                review checklist comes with it.
              </span>
              {externalDraftChanges.length ? (
                <ChangeSummaryGrid
                  changes={externalDraftChanges}
                  beforeLabel="This tab"
                  afterLabel="Saved tab"
                />
              ) : null}
              <span className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-brand/40 bg-background"
                  onClick={useExternalDraft}
                >
                  Use saved draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-brand/40 bg-background"
                  onClick={keepCurrentDraft}
                >
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
                <Badge
                  variant="outline"
                  className="shrink-0 border-warning/40 bg-background tabular-nums text-foreground"
                >
                  {importReviewStatus?.reviewedCount ?? 0}/{importReview.items.length}
                </Badge>
              </div>
              {importSkippedCoverage.length ? (
                <CardDescription className="text-foreground">
                  {importSkippedCoverage.length} source{" "}
                  {importSkippedCoverage.length === 1 ? "section was" : "sections were"} found but
                  not imported — the walkthrough flags{" "}
                  {importSkippedCoverage.length === 1 ? "it" : "them"} so you can add{" "}
                  {importSkippedCoverage.length === 1 ? "it" : "them"} back.
                </CardDescription>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={startImportTour}>
                <ArrowRight />{" "}
                {(importReviewStatus?.reviewedCount ?? 0) > 0
                  ? "Continue walkthrough"
                  : "Start walkthrough"}
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
      </div>

      {workspaceHasStarted ? (
        <SectionNav
          items={navItems}
          onJump={(targetId) => {
            if (targetId === "edit-header") expandGroup("header");
            else if (targetId === "edit-summary") expandGroup("summary");
            else if (targetId.startsWith("edit-section-"))
              expandGroup(targetId.slice("edit-section-".length));
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
            {allCollapsed ? <ChevronsUpDown /> : <ChevronsDownUp />}{" "}
            {allCollapsed ? "Expand all" : "Collapse all"}
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
          <ResumeHeaderFields
            state={state}
            active={headerActive}
            collapsed={collapsedGroups.has("header")}
            onToggleCollapsed={() => toggleGroup("header")}
            onUpdateField={updateField}
            onUpdateLink={headerActions.update}
            onAddLink={headerActions.add}
            onRemoveLink={headerActions.remove}
            onMoveLink={headerActions.move}
          />

          <FieldGroup
            id="edit-summary"
            title="Summary"
            reviewRegion
            className={cn(summaryActive && ACTIVE_SECTION_CLASS)}
            groupId="summary"
            collapsible
            collapsed={collapsedGroups.has("summary")}
            onToggleCollapsed={() => toggleGroup("summary")}
          >
            <RichTextEditor
              id="field-summary"
              label="Professional Summary"
              value={state.summary}
              legacyFormat="paragraph"
              placeholder="Brief overview of your experience and strengths."
              onChange={(value) => updateField("summary", value)}
              aiAssist={
                localAIEnabled
                  ? {
                      expanded: localAIInlineTarget?.id === "summary",
                      onClick: () =>
                        toggleLocalAIInlineEdit({
                          id: "summary",
                          label: "Professional summary",
                          value: state.summary,
                          field: "summary",
                        }),
                      content:
                        localAIInlineTarget?.id === "summary" ? localAIInlinePanel : undefined,
                    }
                  : undefined
              }
            />
          </FieldGroup>

          <ResumeSectionList
            editor={editor}
            ui={ui}
            localAIInlinePanel={localAIInlinePanel}
            toggleLocalAIInlineEdit={toggleLocalAIInlineEdit}
            expandGroup={expandGroup}
            focusEditorTarget={focusEditorTarget}
          />
        </div>
      ) : null}
    </section>
  );
}
