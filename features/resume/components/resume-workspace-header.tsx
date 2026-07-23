"use client";

import { useEffect, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import {
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  FileCode,
  FileDown,
  FileJson,
  FileText,
  Library,
  Moon,
  MoreHorizontal,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { ApplicationHeader } from "@/features/shared/components/application-header";
import type { DestructiveResumeAction } from "@/features/resume/components/review-dialogs";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleTheme } from "@/components/theme-toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  setHandoffOpen: Dispatch<SetStateAction<boolean>>;
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
  setHandoffOpen,
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
    exportingPdf,
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

  // The Applications shortcut only belongs in this menu on compact screens (it
  // has its own spot in the desktop nav). Render it conditionally rather than
  // CSS-hiding it, so React Aria's keyboard navigation doesn't stop on a
  // display:none item.
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <ApplicationHeader
      active="resume"
      saveState={storageIssue || autosaveStatus === "conflict" ? "conflict" : autosaveStatus}
      context={
        resumeLibrary.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLibraryOpen(true)}
            aria-label={`Open resume library: ${activeResumeLabel}`}
            title="Open resume library"
            className="hidden max-w-52 gap-1.5 px-2 lg:inline-flex"
          >
            <Library data-icon="inline-start" aria-hidden="true" />
            <span className="truncate">{activeResumeLabel}</span>
            <ChevronDown data-icon="inline-end" aria-hidden="true" />
          </Button>
        ) : null
      }
      actions={
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
            <SlidersHorizontal data-icon="inline-start" />
            <span className="hidden sm:inline">Tools</span>
            {hasContent ? (
              <span
                className={cn(
                  "hidden h-5 min-w-8 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums sm:inline-flex",
                  checksReady ? "bg-success/15 text-success" : "bg-warning/15 text-foreground",
                )}
              >
                {editor.passedChecks}/{checksLength}
              </span>
            ) : null}
          </Button>
          <DropdownMenuTrigger>
            <Button type="button" aria-label="Export">
              <Download data-icon="inline-start" /> <span className="hidden sm:inline">Export</span>
              <ChevronDown data-icon="inline-end" className="hidden sm:block" />
            </Button>
            <DropdownMenu>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Export resume</DropdownMenuLabel>
                <DropdownMenuItem onAction={requestExport} isDisabled={exportingPdf}>
                  <FileDown /> {exportingPdf ? "Generating PDF…" : "Export PDF"}
                </DropdownMenuItem>
                <DropdownMenuItem onAction={requestDocxExport} isDisabled={!hasContent}>
                  <FileText /> Export Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onAction={saveMarkdown} isDisabled={!hasContent}>
                  <FileCode /> Export Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onAction={saveJson}>
                  <FileJson /> Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onAction={() => setTextReviewOpen(true)} isDisabled={!hasContent}>
                  <ClipboardCopy /> Copy resume text
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenu>
          </DropdownMenuTrigger>
          <DropdownMenuTrigger>
            <Button type="button" variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal data-icon="inline-start" />
            </Button>
            <DropdownMenu>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                <DropdownMenuItem onAction={() => setIsDarkTheme(toggleTheme())}>
                  {isDarkTheme ? <Sun /> : <Moon />}{" "}
                  {isDarkTheme ? "Use light mode" : "Use dark mode"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Resume</DropdownMenuLabel>
                {resumeLibrary.length ? (
                  <DropdownMenuItem onAction={() => setLibraryOpen(true)}>
                    <Library /> Resume library
                    {resumeLibrary.length > 1 ? ` (${resumeLibrary.length})` : ""}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onAction={() => setHandoffOpen(true)}>
                  <Smartphone /> Continue on another device
                </DropdownMenuItem>
                {isCompact ? (
                  <DropdownMenuItem onAction={() => window.location.assign("/applications")}>
                    <BriefcaseBusiness /> Applications
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Import resume</DropdownMenuLabel>
                <DropdownMenuItem
                  onAction={() => importFileInputRef.current?.click()}
                  isDisabled={isImporting}
                >
                  <Upload /> {isImporting ? "Importing" : "Upload PDF or Word"}
                </DropdownMenuItem>
                <DropdownMenuItem onAction={() => setTextImportOpen(true)}>
                  <ClipboardPaste /> Paste resume text
                </DropdownMenuItem>
                <DropdownMenuItem onAction={() => jsonInputRef.current?.click()}>
                  <FileJson /> Open saved JSON
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Workspace data</DropdownMenuLabel>
                <DropdownMenuItem onAction={loadSample}>
                  <FileText /> Sample
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onAction={() => setDestructiveAction("clear")}
                >
                  <RotateCcw /> Clear resume
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onAction={() => setDestructiveAction("delete-all")}
                >
                  <Trash2 /> Delete all data
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </>
      }
      secondary={
        <div className="border-t px-4 py-2 lg:hidden">
          <ToggleGroup
            aria-label="Resume workspace view"
            variant="outline"
            spacing={0}
            selectionMode="single"
            selectedKeys={[mobileWorkspaceView]}
            onSelectionChange={(keys) => {
              const selected = [...keys][0];
              if (selected === "editor" || selected === "preview") {
                setMobileWorkspaceView(selected);
              }
            }}
            className="grid w-full grid-cols-2"
          >
            <ToggleGroupItem id="editor" size="sm" aria-controls="resume-editor-pane">
              <FileText data-icon="inline-start" /> Edit resume
            </ToggleGroupItem>
            <ToggleGroupItem id="preview" size="sm" aria-controls="resume-preview-pane">
              <Eye data-icon="inline-start" /> Preview
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      }
    />
  );
}
