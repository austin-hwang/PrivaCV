"use client";

import dynamic from "next/dynamic";
import {
  DestructiveResumeDialog,
  ResumeChecksDialog,
} from "@/features/resume/components/review-dialogs";
import { ResumeEditorOverlays } from "@/features/resume/components/resume-editor-overlays";
import { ReviewDrawer } from "@/features/resume/components/review-drawer";
import { ResumeLibraryCard } from "@/features/resume/components/resume-library-card";
import { GuidedReview, type GuidedReviewStep } from "@/features/resume/components/guided-review";
import {
  ResumeNavigator,
  type ResumeNavigatorItem,
} from "@/features/resume/components/resume-navigator";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import type { useResumeWorkspaceUI } from "@/features/resume/hooks/use-resume-workspace-ui";
import { WebRTCHandoffDialog } from "@/features/resume/components/webrtc-handoff-dialog";

const LocalAIDialog = dynamic(
  () =>
    import("@/features/resume/components/local-ai-dialog").then((module) => module.LocalAIDialog),
  { ssr: false },
);

type ResumeEditorController = ReturnType<typeof useResumeEditor>;
type ResumeWorkspaceUI = ReturnType<typeof useResumeWorkspaceUI>;

export function ResumeWorkspaceDialogs({
  editor,
  ui,
  navigatorItems,
  tourSteps,
  feedbackUrl,
  deleteSavedBrowserData,
  clearEditor,
  focusEditorTarget,
  focusEditorFromExportCheck,
  focusTourTarget,
  startChecksTour,
  openChecksReview,
}: {
  editor: ResumeEditorController;
  ui: ResumeWorkspaceUI;
  navigatorItems: ResumeNavigatorItem[];
  tourSteps: GuidedReviewStep[];
  feedbackUrl: string;
  deleteSavedBrowserData: () => Promise<void>;
  clearEditor: () => void;
  focusEditorTarget: (targetId: string) => void;
  focusEditorFromExportCheck: (targetId: string) => void;
  focusTourTarget: (targetId: string) => void;
  startChecksTour: () => void;
  openChecksReview: () => void;
}) {
  const {
    checks,
    completeImportReview,
    importReviewStatus,
    passedChecks,
    setApplicationCopyOpen,
    state,
  } = editor;
  const {
    checksReviewOpen,
    destructiveAction,
    libraryOpen,
    handoffOpen,
    handoffInvitation,
    localAIEnabled,
    localAIOpen,
    navigatorOpen,
    navigatorQuery,
    reviewTour,
    toolsOpen,
    setBlankWorkspaceOpen,
    setChecksReviewOpen,
    setDestructiveAction,
    setHistoryPreviewItem,
    setLibraryOpen,
    setHandoffOpen,
    setHandoffInvitation,
    setLocalAIOpen,
    setNavigatorOpen,
    setNavigatorQuery,
    setReviewTour,
    setToolsOpen,
  } = ui;

  return (
    <>
      <DestructiveResumeDialog
        action={destructiveAction}
        onActionChange={setDestructiveAction}
        onConfirm={(action) => {
          setDestructiveAction(null);
          if (action === "delete-all") {
            setBlankWorkspaceOpen(false);
            void deleteSavedBrowserData();
          } else if (action === "clear-checkpoints") {
            setHistoryPreviewItem(null);
            editor.clearVersionHistory();
          } else {
            clearEditor();
          }
        }}
      />

      <ResumeNavigator
        open={navigatorOpen}
        onOpenChange={setNavigatorOpen}
        items={navigatorItems}
        query={navigatorQuery}
        onQueryChange={setNavigatorQuery}
        onSelect={focusEditorTarget}
      />

      <ResumeChecksDialog
        open={checksReviewOpen}
        checks={checks}
        passedChecks={passedChecks}
        onOpenChange={setChecksReviewOpen}
        onStartWalkthrough={startChecksTour}
      />

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
        feedbackUrl={feedbackUrl}
      />

      {localAIEnabled ? <LocalAIDialog open={localAIOpen} onOpenChange={setLocalAIOpen} /> : null}

      <ResumeLibraryCard
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        items={editor.resumeLibrary.map((item) =>
          item.id === editor.activeResumeId ? { ...item, state } : item,
        )}
        activeResumeId={editor.activeResumeId}
        onCreate={editor.createResume}
        onOpen={editor.switchResume}
        onDuplicate={editor.duplicateResume}
        onRename={editor.renameResume}
        onDelete={editor.deleteResume}
      />

      <WebRTCHandoffDialog
        open={handoffOpen}
        onOpenChange={setHandoffOpen}
        invitation={handoffInvitation}
        onInvitationConsumed={() => setHandoffInvitation(null)}
        state={state}
        onOpenReceivedResume={editor.openTransferredResume}
      />

      <GuidedReview
        open={Boolean(reviewTour) && tourSteps.length > 0}
        title={reviewTour?.kind === "import" ? "Import review" : "Resume review"}
        steps={tourSteps}
        index={reviewTour?.index ?? 0}
        onIndexChange={(nextIndex) =>
          setReviewTour((current) => (current ? { ...current, index: nextIndex } : current))
        }
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
