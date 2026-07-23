"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { ResumeTemplateId } from "@/lib/resume";
import type { VersionHistoryItem } from "@/lib/resume-workspace";
import type { DestructiveResumeAction } from "@/features/resume/components/review-dialogs";
import { readWebRTCHandoffInvitationFromHash } from "@/lib/webrtc-handoff-signaling";

export type LocalAIInlineTarget = {
  id: string;
  label: string;
  value: string;
  field?: "summary" | "skills";
  section?: string;
  index?: number;
};

export type ReviewTourState = { kind: "import" | "checks"; index: number };

export function useResumeWorkspaceUI({
  activeResumeId,
  hasContent,
  loaded,
  resumeRef,
}: {
  activeResumeId: string | null;
  hasContent: boolean;
  loaded: boolean;
  resumeRef: RefObject<HTMLDivElement | null>;
}) {
  const [mobileWorkspaceView, setMobileWorkspaceView] = useState<"editor" | "preview">("editor");
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [checksReviewOpen, setChecksReviewOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffInvitation, setHandoffInvitation] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPreviewItem, setHistoryPreviewItem] = useState<VersionHistoryItem | null>(null);
  const [reviewTour, setReviewTour] = useState<ReviewTourState | null>(null);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [blankWorkspaceOpen, setBlankWorkspaceOpen] = useState(false);
  const [blankTemplatePreview, setBlankTemplatePreview] = useState<ResumeTemplateId | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [dropTargetSection, setDropTargetSection] = useState<string | null>(null);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorQuery, setNavigatorQuery] = useState("");
  const [destructiveAction, setDestructiveAction] = useState<DestructiveResumeAction | null>(null);
  const [localAIOpen, setLocalAIOpen] = useState(false);
  const [localAIInlineTarget, setLocalAIInlineTarget] = useState<LocalAIInlineTarget | null>(null);
  const [localAIImportOpen, setLocalAIImportOpen] = useState(false);
  const [localAIEnabled, setLocalAIEnabled] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [designAdvancedOpen, setDesignAdvancedOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [previewScale, setPreviewScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(11 * 96);
  const [previewWrapNode, setPreviewWrapNode] = useState<HTMLDivElement | null>(null);
  const previewWrapRef = useCallback((node: HTMLDivElement | null) => {
    setPreviewWrapNode(node);
  }, []);
  const workspaceHasStarted = hasContent || blankWorkspaceOpen;

  useEffect(() => setIsDarkTheme(document.documentElement.classList.contains("dark")), []);

  useEffect(() => {
    const openInvitation = () => {
      const invitation = readWebRTCHandoffInvitationFromHash(window.location.hash);
      if (!invitation) return;
      setHandoffInvitation(invitation);
      setHandoffOpen(true);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    };
    openInvitation();
    window.addEventListener("hashchange", openInvitation);
    return () => window.removeEventListener("hashchange", openInvitation);
  }, []);

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

  useEffect(() => {
    setHistoryPreviewItem(null);
    setHistoryOpen(false);
  }, [activeResumeId]);

  useEffect(() => {
    // Once the workspace is active, keep the SEO explainer hidden for the rest of
    // the session. The initial state loads asynchronously, so clearing this on a
    // transient "not started" render (or matching a before-paint marker set in the
    // document head) would reintroduce the layout shift this avoids.
    if (workspaceHasStarted) {
      document.documentElement.dataset.resumeWorkspace = "active";
    }
  }, [workspaceHasStarted]);

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

  useEffect(() => {
    if (!navigatorOpen) setNavigatorQuery("");
  }, [navigatorOpen]);

  const sheetWidthPx = 8.5 * 96;
  useEffect(() => {
    const wrap = previewWrapNode;
    if (!wrap) return;
    const measure = () => {
      const available = wrap.clientWidth;
      if (available > 0) setPreviewScale(Math.min(1, Math.max(0.2, available / sheetWidthPx)));
      const sheet = resumeRef.current;
      // A hidden mobile pane reports zero dimensions. Preserve the last real
      // measurement until its replacement is visible instead of collapsing
      // the frame and leaving a blank preview when the desktop layout returns.
      if (sheet && sheet.offsetHeight > 0) setSheetHeight(sheet.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    if (resumeRef.current) observer.observe(resumeRef.current);
    return () => observer.disconnect();
  }, [loaded, previewWrapNode, resumeRef, sheetWidthPx]);

  const previewFrameStyle = {
    "--resume-preview-scale": previewScale,
    "--resume-preview-frame-width": `${Math.round(sheetWidthPx * previewScale)}px`,
    "--resume-preview-frame-height": `${Math.round(sheetHeight * previewScale)}px`,
  } as CSSProperties;

  return {
    activeTarget,
    blankTemplatePreview,
    blankWorkspaceOpen,
    checksReviewOpen,
    collapsedGroups,
    designAdvancedOpen,
    designOpen,
    destructiveAction,
    draggedSection,
    dropTargetSection,
    editorCollapsed,
    historyOpen,
    historyPreviewItem,
    handoffOpen,
    handoffInvitation,
    inlineEdit,
    isDarkTheme,
    libraryOpen,
    localAIEnabled,
    localAIImportOpen,
    localAIInlineTarget,
    localAIOpen,
    mobileWorkspaceView,
    navigatorOpen,
    navigatorQuery,
    previewFrameStyle,
    previewWrapRef,
    printing,
    reviewTour,
    toolsOpen,
    workspaceHasStarted,
    setActiveTarget,
    setBlankTemplatePreview,
    setBlankWorkspaceOpen,
    setChecksReviewOpen,
    setCollapsedGroups,
    setDesignAdvancedOpen,
    setDesignOpen,
    setDestructiveAction,
    setDraggedSection,
    setDropTargetSection,
    setEditorCollapsed,
    setHistoryOpen,
    setHistoryPreviewItem,
    setHandoffOpen,
    setHandoffInvitation,
    setInlineEdit,
    setIsDarkTheme,
    setLibraryOpen,
    setLocalAIImportOpen,
    setLocalAIInlineTarget,
    setLocalAIOpen,
    setMobileWorkspaceView,
    setNavigatorOpen,
    setNavigatorQuery,
    setReviewTour,
    setToolsOpen,
  };
}
