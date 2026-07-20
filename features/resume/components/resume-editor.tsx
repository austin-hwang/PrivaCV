"use client";

import { useCallback, useEffect, useMemo, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { GripVertical, Loader2 } from "lucide-react";
import { FEEDBACK_URL } from "@/lib/site";
import { clearStoredJobPipelineData } from "@/lib/job-application-db";
import { ResumeDesignControls } from "@/features/resume/components/design-controls";
import { ResumeWorkspaceHeader } from "@/features/resume/components/resume-workspace-header";
import { ResumePreviewPane } from "@/features/resume/components/resume-preview-pane";
import { ResumeWorkspaceDialogs } from "@/features/resume/components/resume-workspace-dialogs";
import { ResumeEditorPane } from "@/features/resume/components/resume-editor-pane";
import { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import {
  useResumeWorkspaceUI,
  type LocalAIInlineTarget,
} from "@/features/resume/hooks/use-resume-workspace-ui";
import {
  buildCheckTourSteps,
  buildImportTourSteps,
  buildNavigatorItems,
  buildSectionNavItems,
} from "@/features/resume/lib/resume-workspace-builders";
import {
  exportChangeSummary,
  inferHeaderLinkIcon,
  inferHeaderLinkLabel,
  resumeExportFingerprint,
  resumePlainText,
  TEMPLATE_THEMES,
  type HeaderLink,
  type ResumeTemplateId,
  type ResumeTheme,
} from "@/lib/resume";
import { clearAllLocalAIData } from "@/lib/local-ai-engine";
import { buildImportCoverage, type VersionHistoryItem } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

const LocalAIInlineEdit = dynamic(
  () =>
    import("@/features/resume/components/local-ai-inline-edit").then(
      (module) => module.LocalAIInlineEdit,
    ),
  { ssr: false },
);
const LocalAIBackgroundLoader = dynamic(
  () =>
    import("@/features/resume/components/local-ai-background-loader").then(
      (module) => module.LocalAIBackgroundLoader,
    ),
  { ssr: false },
);

// Structured import repair is too inconsistent on the small local models.
// Keep the implementation available, but hide its entry points until quality improves.
const LOCAL_AI_IMPORT_FIX_ENABLED = false;

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

export function ResumeEditor() {
  const editor = useResumeEditor();
  const {
    clearSavedBrowserData,
    checks,
    clearResume,
    importFileInputRef,
    externalDraft,
    focusCheckTarget,
    focusFromExportCheck,
    hasContent,
    importReview,
    jsonInputRef,
    loaded,
    passedChecks,
    resumeRef,
    setTextReviewOpen,
    setTextImportOpen,
    state,
    updateEntry,
    updateField,
    updateSectionText,
    toggleImportReviewItem,
  } = editor;
  const workspaceUI = useResumeWorkspaceUI({
    activeResumeId: editor.activeResumeId,
    hasContent,
    loaded,
    resumeRef,
  });
  const {
    blankTemplatePreview,
    blankWorkspaceOpen,
    designAdvancedOpen,
    editorCollapsed,
    editorPanePercent,
    historyPreviewItem,
    isDarkTheme,
    localAIEnabled,
    localAIInlineTarget,
    mobileWorkspaceView,
    printing,
    reviewTour,
    startWorkspaceResize,
    toolsOpen,
    workspaceHasStarted,
    workspaceRef,
    setActiveTarget,
    setBlankTemplatePreview,
    setBlankWorkspaceOpen,
    setChecksReviewOpen,
    setCollapsedGroups,
    setDesignAdvancedOpen,
    setDestructiveAction,
    setEditorPanePercent,
    setIsDarkTheme,
    setLibraryOpen,
    setLocalAIImportOpen,
    setLocalAIInlineTarget,
    setLocalAIOpen,
    setMobileWorkspaceView,
    setNavigatorOpen,
    setReviewTour,
    setToolsOpen,
  } = workspaceUI;
  const currentImportSourceText =
    importReview?.sourceText?.trim() || (importReview ? resumePlainText(state).trim() : "");
  const usingCurrentDraftForAIImport = Boolean(
    importReview && !importReview.sourceText?.trim() && currentImportSourceText,
  );
  const autosaveCopy: VersionHistoryItem | null =
    editor.autosavedAt && editor.autosavedState
      ? {
          id: "autosave-copy",
          savedAt: editor.autosavedAt,
          label: "Autosave copy",
          fingerprint: resumeExportFingerprint(editor.autosavedState),
          state: editor.autosavedState,
          importReview,
        }
      : null;
  const currentHistoryPoint = useMemo<VersionHistoryItem>(
    () => ({
      id: "current-draft",
      savedAt: editor.autosavedAt ?? new Date().toISOString(),
      label: "Current draft",
      fingerprint: editor.exportFingerprint,
      state,
      importReview,
    }),
    [editor.autosavedAt, editor.exportFingerprint, importReview, state],
  );
  const deleteSavedBrowserData = async () => {
    setLocalAIInlineTarget(null);
    setLocalAIImportOpen(false);
    setLocalAIOpen(false);
    await clearAllLocalAIData();
    await clearStoredJobPipelineData().catch(() => undefined);
    await clearSavedBrowserData();
  };
  const toggleLocalAIInlineEdit = (target: LocalAIInlineTarget) => {
    setLocalAIInlineTarget((current) => (current?.id === target.id ? null : target));
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
        else if (
          localAIInlineTarget.section !== undefined &&
          localAIInlineTarget.index !== undefined
        ) {
          updateEntry(localAIInlineTarget.section, localAIInlineTarget.index, "details", value);
        } else if (localAIInlineTarget.section !== undefined) {
          updateSectionText(localAIInlineTarget.section, value);
        }
        setLocalAIInlineTarget(null);
      }}
    />
  ) : null;
  const timelinePreviewState = historyPreviewItem && !printing ? historyPreviewItem.state : state;
  const previewState = blankTemplatePreview
    ? {
        ...timelinePreviewState,
        template: blankTemplatePreview,
        theme: TEMPLATE_THEMES[blankTemplatePreview],
      }
    : timelinePreviewState;
  const externalDraftChanges = useMemo(
    () => (externalDraft ? exportChangeSummary(state, externalDraft) : []),
    [externalDraft, state],
  );

  const startBlankResume = (template = state.template) => {
    setBlankTemplatePreview(null);
    updateField("template", template);
    updateField("theme", TEMPLATE_THEMES[template]);
    setBlankWorkspaceOpen(true);
    window.setTimeout(() => document.getElementById("field-name")?.focus(), 120);
  };

  const updateTheme = (patch: Partial<ResumeTheme>) =>
    updateField("theme", { ...state.theme, ...patch });
  const updateHeaderLink = (
    id: string,
    patch: Partial<Pick<HeaderLink, "label" | "url" | "icon">>,
  ) =>
    updateField(
      "headerLinks",
      state.headerLinks.map((link) => {
        if (link.id !== id) return link;
        const wasInferred = link.icon === inferHeaderLinkIcon(`${link.label} ${link.url}`);
        const next = { ...link, ...patch };
        if (patch.url !== undefined) next.label = inferHeaderLinkLabel(patch.url);
        if (
          patch.icon === undefined &&
          wasInferred &&
          (patch.url !== undefined || patch.label !== undefined)
        ) {
          next.icon = inferHeaderLinkIcon(`${next.label} ${next.url}`);
        }
        return next;
      }),
    );
  const addHeaderLink = () => {
    const id = `header-link-${Date.now().toString(36)}`;
    updateField("headerLinks", [...state.headerLinks, { id, label: "", url: "", icon: "website" }]);
    setActiveTarget(`field-header-link-${id}-url`);
    window.setTimeout(() => document.getElementById(`field-header-link-${id}-url`)?.focus(), 0);
  };
  const removeHeaderLink = (id: string) =>
    updateField(
      "headerLinks",
      state.headerLinks.filter((link) => link.id !== id),
    );
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
    clearResume();
  };

  const expandGroup = useCallback(
    (groupId: string) =>
      setCollapsedGroups((prev) => {
        if (!prev.has(groupId)) return prev;
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      }),
    [setCollapsedGroups],
  );
  // Expand whichever collapsed group holds a jump target before focusing it.
  const revealTarget = useCallback(
    (targetId: string) => {
      const target = document.getElementById(targetId);
      const inferredGroup =
        targetId === "field-summary"
          ? "summary"
          : isHeaderTarget(targetId)
            ? "header"
            : state.sectionOrder.find(
                (section) =>
                  targetId === `field-${section}` || targetId.startsWith(`field-${section}-`),
              );
      const group =
        target?.closest("[data-field-group]")?.getAttribute("data-field-group") ?? inferredGroup;
      if (group) expandGroup(group);
    },
    [expandGroup, state.sectionOrder],
  );
  const focusTourTarget = useCallback(
    (targetId: string) => {
      setActiveTarget(targetId);
      revealTarget(targetId);
    },
    [revealTarget, setActiveTarget],
  );

  // Appearance controls live behind the preview toolbar's "Design" button so
  // the left pane stays purely about content. Preset, font, and accent are the
  // choices people reach for most; the rest sits under Advanced.
  const designControls = (
    <ResumeDesignControls
      state={state}
      advancedOpen={designAdvancedOpen}
      onAdvancedOpenChange={setDesignAdvancedOpen}
      onTemplateChange={applyTemplate}
      onThemeChange={updateTheme}
    />
  );

  const focusEditorTarget = useCallback(
    (targetId: string) => {
      setActiveTarget(targetId);
      setMobileWorkspaceView("editor");
      setToolsOpen(false);
      revealTarget(targetId);
      window.setTimeout(() => focusCheckTarget(targetId), 120);
    },
    [revealTarget, focusCheckTarget, setActiveTarget, setMobileWorkspaceView, setToolsOpen],
  );
  const focusEditorFromExportCheck = (targetId: string) => {
    setMobileWorkspaceView("editor");
    setToolsOpen(false);
    revealTarget(targetId);
    window.setTimeout(() => focusFromExportCheck(targetId), 0);
  };
  const toggleNavigator = useCallback(
    () => setNavigatorOpen((current) => !current),
    [setNavigatorOpen],
  );

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

  const importCoverage =
    importReview?.coverage ??
    (importReview ? buildImportCoverage(state, importReview.sourceText) : []);
  const importSkippedCoverage = importCoverage.filter(
    (item) => item.sourceDetected && !item.detected,
  );

  const importTourSteps = buildImportTourSteps({
    importReview,
    skippedCoverage: importSkippedCoverage,
    onToggleItem: toggleImportReviewItem,
    onFocusTarget: (targetId) => {
      setReviewTour(null);
      focusEditorTarget(targetId);
    },
  });
  const checksTourSteps = buildCheckTourSteps(checks, (targetId) => {
    setReviewTour(null);
    focusEditorTarget(targetId);
  });

  const startImportTour = () => {
    if (!importReview) return;
    const firstUnconfirmed = importReview.items.findIndex(
      (item) => !importReview.reviewedItemIds?.includes(item.id),
    );
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
  const tourSteps =
    reviewTour?.kind === "import"
      ? importTourSteps
      : reviewTour?.kind === "checks"
        ? checksTourSteps
        : [];

  const checksReady = passedChecks === checks.length;
  const navItems = buildSectionNavItems(state, workspaceHasStarted);
  const navigatorItems = useMemo(
    () => buildNavigatorItems(state, workspaceHasStarted),
    [state, workspaceHasStarted],
  );

  const activeResumeLabel =
    editor.resumeLibrary.find((item) => item.id === editor.activeResumeId)?.label ||
    state.name.trim() ||
    "Untitled resume";

  if (!loaded) {
    return (
      <div
        className="flex min-h-36 items-center justify-center gap-2 border-b bg-card text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="animate-spin" /> Loading your private workspace
      </div>
    );
  }

  return (
    <>
      {localAIEnabled ? <LocalAIBackgroundLoader /> : null}
      <ResumeWorkspaceHeader
        editor={editor}
        activeResumeLabel={activeResumeLabel}
        isDarkTheme={isDarkTheme}
        setIsDarkTheme={setIsDarkTheme}
        toolsOpen={toolsOpen}
        setToolsOpen={setToolsOpen}
        checksReady={checksReady}
        checksLength={checks.length}
        setLibraryOpen={setLibraryOpen}
        setTextReviewOpen={setTextReviewOpen}
        setTextImportOpen={setTextImportOpen}
        setDestructiveAction={setDestructiveAction}
        importFileInputRef={importFileInputRef}
        jsonInputRef={jsonInputRef}
        mobileWorkspaceView={mobileWorkspaceView}
        setMobileWorkspaceView={setMobileWorkspaceView}
      />
      <main
        ref={workspaceRef}
        className={cn(
          "app-shell grid min-h-[calc(100vh-73px)] grid-cols-1",
          editorCollapsed
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[minmax(340px,var(--editor-pane-width))_8px_minmax(440px,1fr)]",
        )}
        style={{ "--editor-pane-width": `${editorPanePercent}%` } as CSSProperties}
      >
        <ResumeEditorPane
          editor={editor}
          ui={workspaceUI}
          navItems={navItems}
          externalDraftChanges={externalDraftChanges}
          importSkippedCoverage={importSkippedCoverage}
          localAIInlinePanel={localAIInlinePanel}
          headerActions={{
            update: updateHeaderLink,
            add: addHeaderLink,
            remove: removeHeaderLink,
            move: moveHeaderLink,
          }}
          startBlankResume={startBlankResume}
          startImportTour={startImportTour}
          toggleNavigator={toggleNavigator}
          expandGroup={expandGroup}
          toggleLocalAIInlineEdit={toggleLocalAIInlineEdit}
          focusEditorTarget={focusEditorTarget}
        />

        {!editorCollapsed ? (
          <div
            role="separator"
            aria-label="Resize editor and preview"
            aria-orientation="vertical"
            aria-valuemin={34}
            aria-valuemax={57}
            aria-valuenow={Math.round(editorPanePercent)}
            tabIndex={0}
            className="group relative hidden cursor-col-resize touch-none items-center justify-center border-x bg-border/50 outline-hidden transition-colors hover:bg-primary/15 focus-visible:bg-primary/15 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:flex"
            onPointerDown={(event) => {
              event.preventDefault();
              startWorkspaceResize(event.clientX);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              setEditorPanePercent((value) =>
                Math.min(57, Math.max(34, value + (event.key === "ArrowLeft" ? -2 : 2))),
              );
            }}
          >
            <GripVertical
              className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden="true"
            />
          </div>
        ) : null}

        <ResumePreviewPane
          editor={editor}
          ui={workspaceUI}
          previewState={previewState}
          currentHistoryPoint={currentHistoryPoint}
          autosaveCopy={autosaveCopy}
          designControls={designControls}
          aiImportFixEnabled={LOCAL_AI_IMPORT_FIX_ENABLED}
          currentImportSourceText={currentImportSourceText}
          usingCurrentDraftForAIImport={usingCurrentDraftForAIImport}
          focusEditorTarget={focusEditorTarget}
          updateHeaderLink={updateHeaderLink}
        />
      </main>

      <ResumeWorkspaceDialogs
        editor={editor}
        ui={workspaceUI}
        navigatorItems={navigatorItems}
        tourSteps={tourSteps}
        feedbackUrl={FEEDBACK_URL}
        deleteSavedBrowserData={deleteSavedBrowserData}
        clearEditor={clearEditor}
        focusEditorTarget={focusEditorTarget}
        focusEditorFromExportCheck={focusEditorFromExportCheck}
        focusTourTarget={focusTourTarget}
        startChecksTour={startChecksTour}
        openChecksReview={openChecksReview}
      />
    </>
  );
}
