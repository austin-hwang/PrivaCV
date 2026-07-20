"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { importResumeDocxWithSource } from "@/lib/docx-import";
import { importResumePdfWithSource, importResumeTextWithSource } from "@/lib/pdf-import";
import { normalizeResume, type ResumeState } from "@/lib/resume";
import {
  buildImportReview,
  importReviewProgress,
  type ImportReviewState,
} from "@/lib/resume-workspace";

type SaveRecoveryPoint = (
  label: string,
  previousState?: ResumeState,
  previousImportReview?: ImportReviewState | null,
) => void;

type UseResumeImportOptions = {
  state: ResumeState;
  importReview: ImportReviewState | null;
  setState: Dispatch<SetStateAction<ResumeState>>;
  setImportReview: Dispatch<SetStateAction<ImportReviewState | null>>;
  setDraftSourceVersionId: Dispatch<SetStateAction<string | null>>;
  setTextImportOpen: Dispatch<SetStateAction<boolean>>;
  flash: (message: string) => unknown;
  forkAutosaveBeforeLoading: (nextState: ResumeState, destinationLabel: string) => void;
  saveRecoveryPoint: SaveRecoveryPoint;
};

export function useResumeImport({
  state,
  importReview,
  setState,
  setImportReview,
  setDraftSourceVersionId,
  setTextImportOpen,
  flash,
  forkAutosaveBeforeLoading,
  saveRecoveryPoint,
}: UseResumeImportOptions) {
  const [isImporting, setIsImporting] = useState(false);

  const toggleImportReviewItem = (itemId: string) => {
    setImportReview((current) => {
      if (!current || !current.items.some((item) => item.id === itemId)) return current;
      const reviewedItemIds = new Set(current.reviewedItemIds ?? []);
      if (reviewedItemIds.has(itemId)) reviewedItemIds.delete(itemId);
      else reviewedItemIds.add(itemId);
      return { ...current, reviewedItemIds: [...reviewedItemIds] };
    });
  };

  const completeImportReview = (confirmAll = false) => {
    if (!importReview || (!confirmAll && !importReviewProgress(importReview).isComplete)) return;
    setImportReview(null);
    flash("Import review complete");
  };

  const openJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const nextState = normalizeResume(JSON.parse(await file.text()));
      forkAutosaveBeforeLoading(nextState, file.name);
      saveRecoveryPoint(`Before opening ${file.name}`);
      setState(nextState);
      setImportReview(null);
      setDraftSourceVersionId(null);
      flash("Loaded JSON");
    } catch {
      flash("That file is not valid resume JSON");
    }
  };

  const openPdf = async (file: File | undefined) => {
    if (!file) return;
    const previousState = state;
    const previousImportReview = importReview;
    setIsImporting(true);
    try {
      const imported = await importResumePdfWithSource(file);
      forkAutosaveBeforeLoading(imported.state, file.name);
      saveRecoveryPoint(`Before importing ${file.name}`, previousState, previousImportReview);
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, file.name, imported.sourceText));
      setDraftSourceVersionId(null);
      flash("Imported PDF - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this PDF");
    } finally {
      setIsImporting(false);
    }
  };

  const openDocx = async (file: File | undefined) => {
    if (!file) return;
    const previousState = state;
    const previousImportReview = importReview;
    setIsImporting(true);
    try {
      const imported = await importResumeDocxWithSource(file);
      forkAutosaveBeforeLoading(imported.state, file.name);
      saveRecoveryPoint(`Before importing ${file.name}`, previousState, previousImportReview);
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, file.name, imported.sourceText));
      setDraftSourceVersionId(null);
      flash("Imported Word document - please review");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import this Word document");
    } finally {
      setIsImporting(false);
    }
  };

  const openResumeFile = async (file: File | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isDocx =
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx");
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    if (isDocx) return openDocx(file);
    if (isPdf) return openPdf(file);
    flash("Choose a PDF or Word (.docx) file, or paste the text instead");
  };

  const openTextImport = (text: string) => {
    try {
      const imported = importResumeTextWithSource(text);
      forkAutosaveBeforeLoading(imported.state, "pasted resume text");
      saveRecoveryPoint("Before importing pasted resume text");
      setState(imported.state);
      setImportReview(buildImportReview(imported.state, "pasted resume text", imported.sourceText));
      setDraftSourceVersionId(null);
      setTextImportOpen(false);
      flash("Imported pasted text - please review");
      return true;
    } catch (error) {
      flash(error instanceof Error ? error.message : "Could not import pasted text");
      return false;
    }
  };

  const applyAIImportFix = (proposal: ResumeState) => {
    if (!importReview?.sourceText) {
      flash("The original import text is no longer available - import the file again first");
      return false;
    }
    const nextState = normalizeResume(proposal);
    forkAutosaveBeforeLoading(nextState, `the repaired ${importReview.fileName} import`);
    saveRecoveryPoint(`Before fixing the ${importReview.fileName} import with local AI`, state, importReview);
    setState(nextState);
    setImportReview(buildImportReview(nextState, importReview.fileName, importReview.sourceText));
    setDraftSourceVersionId(null);
    flash("Applied local AI import proposal - please review every field");
    return true;
  };

  return {
    applyAIImportFix,
    completeImportReview,
    isImporting,
    openJson,
    openResumeFile,
    openTextImport,
    toggleImportReviewItem,
  };
}
