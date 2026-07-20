"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  Download,
  Eye,
  FileText,
  History,
  Printer,
  Save,
  Undo2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";
import { applicationCopyGroups, plainTextStats } from "@/lib/resume";

export function ResumeEditorOverlays({
  editor,
}: {
  editor: ReturnType<typeof useResumeEditor>;
}) {
  const [pastedResumeText, setPastedResumeText] = useState("");
  const [expandedApplicationFields, setExpandedApplicationFields] = useState<Set<string>>(() => new Set());
  const {
    applicationCopyOpen,
    checks,
    copyPlainText,
    importFileInputRef,
    copyApplicationField,
    requestDocxExport,
    downloadPlainText,
    existingVersionForSave,
    exportAnyway,
    exportCheckOpen,
    pendingExportFormat,
    failedChecks,
    focusFromExportCheck,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importReviewStatus,
    importVersionHistoryBackup,
    jsonInputRef,
    mergedHistoryBackup,
    openJson,
    openResumeFile,
    openTextImport,
    openVersionHistoryBackup,
    plainText,
    completeImportReview,
    saveVersion,
    setExportCheckOpen,
    setApplicationCopyOpen,
    setHistoryBackupToImport,
    setTextReviewOpen,
    setTextImportOpen,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    textReviewOpen,
    textImportOpen,
    toast,
    undoRemoval,
    versionDraftLabel,
    versionDraftNote,
    versionSaveOpen,
  } = editor;

  const nextImportReviewItem = importReview?.items.find(
    (item) => !importReview.reviewedItemIds?.includes(item.id),
  );
  const applicationCopy = applicationCopyGroups(editor.state);
  const backupUniqueCount = mergedHistoryBackup.incomingUnique.length;
  const backupMatchCount = mergedHistoryBackup.matchingCheckpoints.length;
  const hasNewBackupCheckpoints = backupUniqueCount > 0;
  const toggleApplicationField = (fieldId: string) => {
    setExpandedApplicationFields((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  };

  return (
    <>
      <Dialog
        open={textImportOpen}
        onOpenChange={(open) => {
          setTextImportOpen(open);
          if (!open) setPastedResumeText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste the resume you already have</DialogTitle>
            <DialogDescription>
              Paste text from a document, LinkedIn, or scanned PDF. We&apos;ll extract the fields for your review.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (openTextImport(pastedResumeText)) setPastedResumeText("");
            }}
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Resume text</span>
              <Textarea
                autoFocus
                value={pastedResumeText}
                placeholder={"Jane Doe\nSoftware Engineer\njane@example.com | San Francisco, CA\n\nExperience\nSoftware Engineer | Acme | 2022–Present\n• Built reliable web experiences for customers."}
                className="min-h-64 font-mono text-xs leading-relaxed"
                onChange={(event) => setPastedResumeText(event.target.value)}
              />
            </label>
            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">Nothing is uploaded or sent anywhere.</span>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setTextImportOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <ClipboardPaste /> Import text
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={textReviewOpen} onOpenChange={setTextReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review before copying</DialogTitle>
            <DialogDescription>
              ATS-friendly text for job applications. Copy it, or download as Word.
            </DialogDescription>
          </DialogHeader>
          {plainText ? (
            <Textarea value={plainText} readOnly className="min-h-[300px] w-full min-w-0 resize-y overflow-auto whitespace-pre font-mono text-xs leading-relaxed" />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Add resume details first</AlertTitle>
              <AlertDescription>The plain-text review will appear once your resume has content.</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{plainText ? plainTextStats(plainText) : "0 words"}</span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={requestDocxExport} disabled={!plainText}>
                <FileText /> Download .docx
              </Button>
              <Button type="button" variant="outline" onClick={downloadPlainText} disabled={!plainText}>
                <Download /> Download .txt
              </Button>
              <Button type="button" onClick={copyPlainText} disabled={!plainText}>
                <ClipboardCopy /> Copy Text
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={applicationCopyOpen}
        onOpenChange={(open) => {
          setApplicationCopyOpen(open);
          if (!open) setExpandedApplicationFields(new Set());
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="sr-only">Copy for applications</DialogTitle>
            <DialogDescription>
              Copy any field or section, ready to paste into applications.
            </DialogDescription>
          </DialogHeader>
          {applicationCopy.length ? (
            <div data-application-copy-list className="grid min-h-0 gap-5 overflow-y-auto pr-1">
              {applicationCopy.map((group) => (
                <section key={group.id} aria-label={group.label} className="grid gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{group.label}</h3>
                    {group.detail ? <p className="text-xs text-muted-foreground">{group.detail}</p> : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.fields.map((field) => {
                      const applicationFieldId = `${group.id}-${field.id}`;
                      const isExpanded = expandedApplicationFields.has(applicationFieldId);
                      const canExpand = field.text.length > 80 || field.text.split(/\r?\n/).length > 1;

                      return (
                        <div key={field.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold">{field.label}</p>
                            <p
                              id={`application-copy-${applicationFieldId}`}
                              className={`mt-1 whitespace-pre-line text-xs leading-snug text-muted-foreground ${canExpand && !isExpanded ? "max-h-12 overflow-hidden" : ""}`}
                            >
                              {field.text}
                            </p>
                            {canExpand ? (
                              <button
                                type="button"
                                className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-expanded={isExpanded}
                                aria-controls={`application-copy-${applicationFieldId}`}
                                onClick={() => toggleApplicationField(applicationFieldId)}
                              >
                                {isExpanded ? "Show less" : "Show full value"}
                              </button>
                            ) : null}
                          </div>
                          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => copyApplicationField(field.text, field.label)}>
                            <ClipboardCopy /> <span className="sr-only">Copy </span>{field.label}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Add resume details first</AlertTitle>
              <AlertDescription>Copy-ready fields will appear here as you fill out the resume.</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="items-center border-t pt-4 sm:justify-between">
            <span className="text-xs text-muted-foreground">Need the whole resume? Use Export → Copy resume text.</span>
            <Button type="button" variant="outline" onClick={() => setApplicationCopyOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionSaveOpen} onOpenChange={setVersionSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name this checkpoint</DialogTitle>
            <DialogDescription>
              Add a label and optional note.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveVersion();
            }}
          >
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Checkpoint name</span>
              <Input
                value={versionDraftLabel}
                placeholder="Frontend manager draft"
                onChange={(event) => setVersionDraftLabel(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Note <span className="font-normal normal-case text-muted-foreground/80">— optional, what makes this version different</span></span>
              <Textarea
                value={versionDraftNote}
                placeholder="e.g. Tailored for the Stripe backend role; trimmed to one page."
                className="min-h-20"
                onChange={(event) => setVersionDraftNote(event.target.value)}
              />
            </label>
            {existingVersionForSave ? (
              <Alert>
                <History className="h-4 w-4" />
                <AlertTitle>A checkpoint with identical content exists</AlertTitle>
                <AlertDescription>
                  “{existingVersionForSave.label}” already holds this exact resume. Saving keeps both — use the name or note to tell them apart.
                </AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">Saved only in this browser.</span>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setVersionSaveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save /> Save checkpoint
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyBackupToImport)} onOpenChange={(open) => !open && setHistoryBackupToImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasNewBackupCheckpoints ? "Add saved checkpoints from backup" : "Checkpoints already added"}</DialogTitle>
            <DialogDescription>
              {hasNewBackupCheckpoints
                ? "Add new checkpoints to your local history; your current resume stays open."
                : "Every checkpoint in this backup already matches your local history."}
            </DialogDescription>
          </DialogHeader>
          {historyBackupToImport ? (
            hasNewBackupCheckpoints ? (
              <div className="grid gap-3">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div data-checkpoint-summary className="flex items-start gap-3">
                    <History data-checkpoint-summary-icon className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">
                        {backupUniqueCount} new {backupUniqueCount === 1 ? "checkpoint" : "checkpoints"} ready to add
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        After adding, {mergedHistoryBackup.checkpoints.length} {mergedHistoryBackup.checkpoints.length === 1 ? "checkpoint" : "checkpoints"} will be available in this browser.
                      </p>
                    </div>
                  </div>
                  <div className="ml-7 mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    {mergedHistoryBackup.incomingUnique.map((checkpoint) => (
                      <Badge key={checkpoint.id} variant="outline" className="max-w-full truncate bg-background">
                        {checkpoint.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                {backupMatchCount ? (
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div data-checkpoint-summary className="flex items-start gap-3">
                      <Check data-checkpoint-summary-icon className="mt-0.5 size-4 shrink-0 text-success" />
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">
                          {backupMatchCount} {backupMatchCount === 1 ? "checkpoint is" : "checkpoints are"} already here
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Existing matches will not be duplicated.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {mergedHistoryBackup.matchingCheckpoints.map((checkpoint) => (
                            <Badge key={checkpoint.id} variant="outline" className="max-w-full bg-background">
                              {checkpoint.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                <div data-checkpoint-summary className="flex items-start gap-3">
                  <Check data-checkpoint-summary-icon className="mt-0.5 size-4 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">All checkpoints are already in this browser</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {backupMatchCount} matching {backupMatchCount === 1 ? "checkpoint was" : "checkpoints were"} kept as-is. No duplicates were added.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mergedHistoryBackup.matchingCheckpoints.map((checkpoint) => (
                        <Badge key={checkpoint.id} variant="outline" className="max-w-full bg-background">
                          {checkpoint.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">Nothing is uploaded or sent anywhere.</span>
            <div className="flex justify-end gap-2">
              {hasNewBackupCheckpoints ? (
                <>
                  <Button type="button" variant="outline" onClick={() => setHistoryBackupToImport(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={importVersionHistoryBackup}>
                    <History /> Add {backupUniqueCount} {backupUniqueCount === 1 ? "checkpoint" : "checkpoints"}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setHistoryBackupToImport(null)}>Done</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportCheckOpen} onOpenChange={setExportCheckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review before {pendingExportFormat === "docx" ? "downloading" : "exporting"}</DialogTitle>
            <DialogDescription>
              Fix the highest-impact items now, or continue if you have already reviewed the resume yourself.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {importReview ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {importReviewStatus?.isComplete ? "Imported fields are confirmed" : "Imported fields still need review"}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {importReviewStatus?.isComplete
                        ? "Finish the review to clear this reminder before your next export."
                        : `Confirm each suggested field, or consciously continue with ${pendingExportFormat === "docx" ? "Download Anyway" : "Export Anyway"}.`}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {importReviewStatus?.reviewedCount ?? 0}/{importReview.items.length} confirmed
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {nextImportReviewItem ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => focusFromExportCheck(nextImportReviewItem.targetId)}
                    >
                      <Eye /> Review next field
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => completeImportReview()}>
                      <Check /> Finish import review
                    </Button>
                  )}
                </div>
              </div>
            ) : null}

            {failedChecks.length ? (
              <div className="grid gap-2">
                {failedChecks.map((check) => (
                  <div key={check.id} className="flex gap-2 rounded-md border bg-muted/30 p-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-warning text-xs font-bold text-warning-foreground">
                      !
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{check.label}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => focusFromExportCheck(check.targetId)}
                    >
                      <ArrowRight /> {check.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertTitle>Resume checks passed</AlertTitle>
                <AlertDescription>The remaining checkpoint is the imported-field review.</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {failedChecks.length ? `${failedChecks.length} resume ${failedChecks.length === 1 ? "issue" : "issues"}` : "Checks clear"}
            </span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setExportCheckOpen(false)}>
                Keep Editing
              </Button>
              <Button type="button" onClick={exportAnyway}>
                {pendingExportFormat === "docx" ? <FileText /> : <Printer />}
                {pendingExportFormat === "docx" ? "Download Anyway" : "Export Anyway"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={importFileInputRef}
        type="file"
        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        hidden
        onChange={(event) => {
          void openResumeFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        id="resume-json-input"
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          void openJson(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        id="history-backup-input"
        ref={historyBackupInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => {
          void openVersionHistoryBackup(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {toast ? (
        <div
          key={toast.id}
          className="app-chrome fixed bottom-5 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
        >
          <span>{toast.message}</span>
          {toast.action === "undo" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 border border-background/40 px-2 text-background hover:bg-background/15 hover:text-background"
              onClick={undoRemoval}
            >
              <Undo2 /> Undo
            </Button>
          ) : null}
        </div>
      ) : null}

    </>
  );
}
