"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  FileCode,
  FileJson,
  FileText,
  Library,
  Moon,
  MoreHorizontal,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { ApplicationHeader } from "@/features/shared/components/application-header";
import type { DestructiveResumeAction } from "@/features/resume/components/review-dialogs";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { toggleTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type ResumeWorkspaceHeaderProps = {
  editor: ReturnType<typeof useResumeEditor>;
  activeResumeLabel: string;
  isDarkTheme: boolean;
  setIsDarkTheme: Dispatch<SetStateAction<boolean>>;
  toolsOpen: boolean;
  setToolsOpen: Dispatch<SetStateAction<boolean>>;
  checksReady: boolean;
  checksLength: number;
  setLibraryOpen: Dispatch<SetStateAction<boolean>>;
  setTextReviewOpen: Dispatch<SetStateAction<boolean>>;
  setTextImportOpen: Dispatch<SetStateAction<boolean>>;
  setDestructiveAction: Dispatch<SetStateAction<DestructiveResumeAction | null>>;
  importFileInputRef: RefObject<HTMLInputElement | null>;
  jsonInputRef: RefObject<HTMLInputElement | null>;
  mobileWorkspaceView: "editor" | "preview";
  setMobileWorkspaceView: Dispatch<SetStateAction<"editor" | "preview">>;
};

export function ResumeWorkspaceHeader({
  editor,
  activeResumeLabel,
  isDarkTheme,
  setIsDarkTheme,
  toolsOpen,
  setToolsOpen,
  checksReady,
  checksLength,
  setLibraryOpen,
  setTextReviewOpen,
  setTextImportOpen,
  setDestructiveAction,
  importFileInputRef,
  jsonInputRef,
  mobileWorkspaceView,
  setMobileWorkspaceView,
}: ResumeWorkspaceHeaderProps) {
  const {
    autosaveStatus,
    hasContent,
    isImporting,
    loadSample,
    requestDocxExport,
    requestExport,
    resumeLibrary,
    saveJson,
    saveMarkdown,
    storageIssue,
  } = editor;

  return (
    <ApplicationHeader
      active="resume"
      saveState={storageIssue || autosaveStatus === "conflict" ? "conflict" : autosaveStatus}
      context={resumeLibrary.length ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setLibraryOpen(true)}
          aria-label={`Open resume library: ${activeResumeLabel}`}
          title="Open resume library"
          className="hidden max-w-52 gap-1.5 px-2 lg:inline-flex"
        >
          <Library aria-hidden="true" />
          <span className="truncate">{activeResumeLabel}</span>
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      actions={(
        <>
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
              <span className={cn(
                "hidden h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums sm:inline-flex",
                checksReady ? "bg-success/15 text-success" : "bg-warning/15 text-foreground",
              )}>
                {editor.passedChecks}/{checksLength}
              </span>
            ) : null}
          </Button>
          <Menu>
            <MenuTrigger>
              <Button type="button" aria-label="Export">
                <Download /> <span className="hidden sm:inline">Export</span>
                <ChevronDown className="hidden size-3.5 sm:block" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Export resume</MenuLabel>
              <MenuItem onSelect={requestExport}><Printer /> Export PDF</MenuItem>
              <MenuItem onSelect={requestDocxExport} disabled={!hasContent}><FileText /> Export Word (.docx)</MenuItem>
              <MenuItem onSelect={saveMarkdown} disabled={!hasContent}><FileCode /> Export Markdown (.md)</MenuItem>
              <MenuItem onSelect={saveJson}><FileJson /> Export JSON</MenuItem>
              <MenuItem onSelect={() => setTextReviewOpen(true)} disabled={!hasContent}>
                <ClipboardCopy /> Copy resume text
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
              <MenuLabel>Appearance</MenuLabel>
              <MenuItem onSelect={() => setIsDarkTheme(toggleTheme())}>
                {isDarkTheme ? <Sun /> : <Moon />} {isDarkTheme ? "Use light mode" : "Use dark mode"}
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Resume</MenuLabel>
              {resumeLibrary.length ? (
                <MenuItem onSelect={() => setLibraryOpen(true)}>
                  <Library /> Resume library{resumeLibrary.length > 1 ? ` (${resumeLibrary.length})` : ""}
                </MenuItem>
              ) : null}
              <MenuItem className="lg:hidden" onSelect={() => window.location.assign("/applications")}>
                <BriefcaseBusiness /> Applications
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>Import resume</MenuLabel>
              <MenuItem onSelect={() => importFileInputRef.current?.click()} disabled={isImporting}>
                <Upload /> {isImporting ? "Importing" : "Upload PDF or Word"}
              </MenuItem>
              <MenuItem onSelect={() => setTextImportOpen(true)}><ClipboardPaste /> Paste resume text</MenuItem>
              <MenuItem onSelect={() => jsonInputRef.current?.click()}><FileJson /> Open saved JSON</MenuItem>
              <MenuSeparator />
              <MenuLabel>Workspace data</MenuLabel>
              <MenuItem onSelect={loadSample}><FileText /> Sample</MenuItem>
              <MenuItem destructive onSelect={() => setDestructiveAction("clear")}><RotateCcw /> Clear resume</MenuItem>
              <MenuItem destructive onSelect={() => setDestructiveAction("delete-all")}><Trash2 /> Delete all data</MenuItem>
            </MenuContent>
          </Menu>
        </>
      )}
      secondary={(
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
      )}
    />
  );
}
