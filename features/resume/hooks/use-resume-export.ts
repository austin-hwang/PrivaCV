"use client";

import { useEffect, useRef, useState } from "react";
import {
  copyText,
  downloadFile,
  downloadJsonFile,
  downloadMarkdownFile,
  downloadTextFile,
} from "@/lib/browser-files";
import { resumeDocxBlob } from "@/lib/docx-export";
import { trackResumeExport } from "@/lib/export-metrics";
import {
  hasAnyContent,
  resumeMarkdown,
  type ResumeCheck,
  type ResumeState,
} from "@/lib/resume";
import type { ImportReviewState } from "@/lib/resume-workspace";
import { pdfDocumentTitle, safeResumeFilename } from "@/features/resume/lib/resume-file-name";

type UseResumeExportOptions = {
  state: ResumeState;
  plainText: string;
  failedChecks: ResumeCheck[];
  importReview: ImportReviewState | null;
  flash: (message: string) => unknown;
  focusCheckTarget: (targetId: string) => void;
};

export function useResumeExport({
  state,
  plainText,
  failedChecks,
  importReview,
  flash,
  focusCheckTarget,
}: UseResumeExportOptions) {
  const [exportCheckOpen, setExportCheckOpen] = useState(false);
  const [pendingExportFormat, setPendingExportFormat] = useState<"pdf" | "docx">("pdf");
  const requestExportRef = useRef<() => void>(() => undefined);

  const saveJson = () => {
    downloadJsonFile(state, `${safeResumeFilename(state.name || "resume")}.json`);
    if (hasAnyContent(state)) trackResumeExport("json");
    flash("Saved JSON to downloads");
  };

  const saveMarkdown = () => {
    if (!hasAnyContent(state)) return;
    downloadMarkdownFile(resumeMarkdown(state), `${safeResumeFilename(state.name || "resume")}.md`);
    trackResumeExport("md");
    flash("Saved Markdown to downloads");
  };

  const copyPlainText = async () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    if (await copyText(plainText)) {
      trackResumeExport("copy");
      flash("Copied plain text");
    } else flash("Could not copy text");
  };

  const copyApplicationField = async (text: string, label: string) => {
    if (!text.trim()) {
      flash(`Add ${label.toLocaleLowerCase()} first`);
      return;
    }
    if (await copyText(text)) flash(`Copied ${label.toLocaleLowerCase()}`);
    else flash("Could not copy text");
  };

  const downloadPlainText = () => {
    if (!plainText) {
      flash("Add resume details first");
      return;
    }
    downloadTextFile(plainText, `${safeResumeFilename(state.name || "resume")}.txt`);
    trackResumeExport("txt");
    flash("Saved plain text to downloads");
  };

  const downloadDocxFile = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    downloadFile(resumeDocxBlob(state), `${safeResumeFilename(state.name || "resume")}.docx`);
    trackResumeExport("docx");
    flash("Saved Word document to downloads");
  };

  const requestDocxExport = () => {
    if (!hasAnyContent(state)) {
      flash("Add resume details first");
      return;
    }
    if (failedChecks.length || importReview) {
      setPendingExportFormat("docx");
      setExportCheckOpen(true);
      return;
    }
    downloadDocxFile();
  };

  const startPrintExport = () => {
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
    };
    document.title = pdfDocumentTitle(state.name || "resume");
    window.addEventListener("afterprint", restoreTitle, { once: true });
    if (hasAnyContent(state)) trackResumeExport("pdf");
    window.print();
  };

  const requestExport = () => {
    if (failedChecks.length || importReview) {
      setPendingExportFormat("pdf");
      setExportCheckOpen(true);
      return;
    }
    startPrintExport();
  };

  requestExportRef.current = requestExport;

  useEffect(() => {
    const handlePrintShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLowerCase() !== "p"
      ) return;
      event.preventDefault();
      requestExportRef.current();
    };
    window.addEventListener("keydown", handlePrintShortcut);
    return () => window.removeEventListener("keydown", handlePrintShortcut);
  }, []);

  const exportAnyway = () => {
    setExportCheckOpen(false);
    if (pendingExportFormat === "docx") {
      downloadDocxFile();
      return;
    }
    window.setTimeout(startPrintExport, 120);
  };

  const focusFromExportCheck = (targetId: string) => {
    setExportCheckOpen(false);
    window.setTimeout(() => focusCheckTarget(targetId), 120);
  };

  return {
    copyApplicationField,
    copyPlainText,
    downloadPlainText,
    exportAnyway,
    exportCheckOpen,
    focusFromExportCheck,
    pendingExportFormat,
    requestDocxExport,
    requestExport,
    saveJson,
    saveMarkdown,
    setExportCheckOpen,
  };
}
