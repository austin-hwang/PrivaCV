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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPreviewItem, setHistoryPreviewItem] = useState<VersionHistoryItem | null>(null);
  const [reviewTour, setReviewTour] = useState<ReviewTourState | null>(null);
  const [inlineEdit, setInlineEdit] = useState(true);
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [editorPanePercent, setEditorPanePercent] = useState(50);
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
  const workspaceRef = useRef<HTMLElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const workspaceHasStarted = hasContent || blankWorkspaceOpen;

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

  useEffect(() => {
    setHistoryPreviewItem(null);
    setHistoryOpen(false);
  }, [activeResumeId]);

  useEffect(() => {
    document.documentElement.dataset.resumeWorkspace = workspaceHasStarted ? "active" : "";
    return () => {
      delete document.documentElement.dataset.resumeWorkspace;
    };
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

  const sheetWidthPx = 8.5 * 96;
  useEffect(() => {
    const wrap = previewWrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const available = wrap.clientWidth;
      if (available > 0) setPreviewScale(Math.min(1, Math.max(0.2, available / sheetWidthPx)));
      const sheet = resumeRef.current;
      if (sheet) setSheetHeight(sheet.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    if (resumeRef.current) observer.observe(resumeRef.current);
    return () => observer.disconnect();
  }, [loaded, resumeRef, sheetWidthPx]);

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
    editorPanePercent,
    historyOpen,
    historyPreviewItem,
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
    setDesignOpen,
    setDestructiveAction,
    setDraggedSection,
    setDropTargetSection,
    setEditorCollapsed,
    setEditorPanePercent,
    setHistoryOpen,
    setHistoryPreviewItem,
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
