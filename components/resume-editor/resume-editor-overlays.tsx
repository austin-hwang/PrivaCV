"use client";

import { useMemo, useState } from "react";
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
  Target,
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
import { VersionChangeRow } from "@/components/resume-editor/version-changes";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import { applicationCopyGroups, plainTextStats } from "@/lib/resume";
import { analyzeJobMatch } from "@/lib/job-match";
import { MAX_VERSION_HISTORY, formatCheckpointTime } from "@/lib/resume-workspace";

export function ResumeEditorOverlays({
  editor,
  jobMatchOpen,
  setJobMatchOpen,
}: {
  editor: ReturnType<typeof useResumeEditor>;
  jobMatchOpen: boolean;
  setJobMatchOpen: (open: boolean) => void;
}) {
  const [pastedResumeText, setPastedResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [expandedApplicationFields, setExpandedApplicationFields] = useState<Set<string>>(() => new Set());
  const {
    applicationCopyOpen,
    checks,
    comparedBaseVersion,
    comparedTargetState,
    comparedTargetVersion,
    copyPlainText,
    docxInputRef,
    copyApplicationField,
    downloadDocx,
    downloadPlainText,
    existingVersionForSave,
    exportAnyway,
    exportCheckOpen,
    failedChecks,
    focusFromExportCheck,
    focusFromVersionCompare,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importReviewStatus,
    importVersionHistoryBackup,
    jsonInputRef,
    mergedHistoryBackup,
    openJson,
    openDocx,
    openPdf,
    openTextImport,
    openVersionHistoryBackup,
    pdfInputRef,
    plainText,
    completeImportReview,
    restoreVersion,
    saveVersion,
    setExportCheckOpen,
    setApplicationCopyOpen,
    setHistoryBackupToImport,
    setTextReviewOpen,
    setTextImportOpen,
    setVersionCompareTarget,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    textReviewOpen,
    textImportOpen,
    toast,
    undoRemoval,
    versionChanges,
    versionCompareAfterLabel,
    versionCompareBeforeLabel,
    versionCompareDescription,
    versionCompareOpen,
    versionCompareUsesCurrent,
    versionDraftLabel,
    versionDraftNote,
    versionHistory,
    versionSaveOpen,
    versionToReplaceOnSave,
  } = editor;

  const nextImportReviewItem = importReview?.items.find(
    (item) => !importReview.reviewedItemIds?.includes(item.id),
  );
  const applicationCopy = applicationCopyGroups(editor.state);
  const jobMatch = useMemo(
    () => (jobDescription.trim() ? analyzeJobMatch(jobDescription, editor.state) : null),
    [editor.state, jobDescription],
  );
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
        open={jobMatchOpen}
        onOpenChange={(open) => {
          setJobMatchOpen(open);
          if (!open) setJobDescription("");
        }}
      >
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Local tailoring review</DialogDescription>
            <DialogTitle>Compare this resume with a job</DialogTitle>
            <DialogDescription>
              Paste a job description to see distinctive terms that appear here and terms to consider only if they are true for you. Nothing is uploaded, rewritten, or changed automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 gap-5 overflow-y-auto pr-1">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Job description</span>
              <Textarea
                autoFocus
                value={jobDescription}
                placeholder="Paste the role description, responsibilities, and qualifications here…"
                className="min-h-40 resize-y text-sm leading-relaxed"
                onChange={(event) => setJobDescription(event.target.value)}
              />
            </label>
            {jobMatch ? (
              jobMatch.terms.length ? (
                <section aria-live="polite" className="grid gap-4">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="text-sm font-semibold">{jobMatch.matchedTerms.length} of {jobMatch.terms.length} distinctive terms found</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      This is an exact text comparison, not an ATS score. It does not judge your qualifications or recommend adding unsupported claims.
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold">Already reflected</h3>
                    {jobMatch.matchedTerms.length ? (
                      <div className="flex flex-wrap gap-2">
                        {jobMatch.matchedTerms.map((term) => <Badge key={term.term} variant="secondary"><Check className="size-3" /> {term.term}</Badge>)}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">No distinctive terms from this description appear verbatim yet.</p>}
                  </div>
                  <div className="grid gap-2">
                    <h3 className="text-sm font-semibold">Not found verbatim</h3>
                    {jobMatch.missingTerms.length ? (
                      <div className="flex flex-wrap gap-2">
                        {jobMatch.missingTerms.map((term) => <Badge key={term.term} variant="outline" className="border-amber-300 bg-amber-50 text-amber-950">{term.term}</Badge>)}
                      </div>
                    ) : <p className="text-sm text-muted-foreground">Every distinctive term selected from this description appears in the resume.</p>}
                    <p className="text-xs leading-relaxed text-muted-foreground">Review wording, related experience, and relevance yourself before changing a resume.</p>
                  </div>
                </section>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Add a fuller job description</AlertTitle>
                  <AlertDescription>There are not enough distinctive terms to compare yet. Include responsibilities or qualifications for a more useful review.</AlertDescription>
                </Alert>
              )
            ) : (
              <Alert>
                <Target className="h-4 w-4" />
                <AlertTitle>Start with the posting</AlertTitle>
                <AlertDescription>Paste the job description to compare its terminology with the current resume.</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="items-center border-t pt-4 sm:justify-between">
            <span className="text-xs text-muted-foreground">Your job description stays in this browser and is cleared when you close this review.</span>
            <Button type="button" variant="outline" onClick={() => { setJobMatchOpen(false); setJobDescription(""); }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={textImportOpen}
        onOpenChange={(open) => {
          setTextImportOpen(open);
          if (!open) setPastedResumeText("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Local text import</DialogDescription>
            <DialogTitle>Paste the resume you already have</DialogTitle>
            <DialogDescription>
              Paste text copied from a document, LinkedIn, or an OCR&apos;d scanned PDF. PrivaCV structures it in this browser, then asks you to review the suggested fields.
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
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Plain-text export</DialogDescription>
            <DialogTitle>Review before copying</DialogTitle>
            <DialogDescription>
              This is the exact ATS-friendly text that will be copied for job applications and recruiter portals. You can also download the same content as a simple, editable Word document.
            </DialogDescription>
          </DialogHeader>
          {plainText ? (
            <Textarea value={plainText} readOnly className="min-h-[360px] resize-y whitespace-pre font-mono text-xs leading-relaxed" />
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Add resume details first</AlertTitle>
              <AlertDescription>The plain-text review will appear once your resume has content.</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{plainText ? plainTextStats(plainText) : "0 words"}</span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={downloadDocx} disabled={!plainText}>
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
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Application copy</DialogDescription>
            <DialogTitle>Copy exactly what each portal asks for</DialogTitle>
            <DialogDescription>
              Copy a contact field, role, achievement list, or section without retyping. Everything stays in this browser.
            </DialogDescription>
          </DialogHeader>
          {applicationCopy.length ? (
            <div className="grid min-h-0 gap-5 overflow-y-auto pr-1">
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
            <span className="text-xs text-muted-foreground">Need the whole resume? Use Review Text for a complete ATS-friendly copy.</span>
            <Button type="button" variant="outline" onClick={() => setApplicationCopyOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionSaveOpen} onOpenChange={setVersionSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Version history</DialogDescription>
            <DialogTitle>Name this checkpoint</DialogTitle>
            <DialogDescription>
              Give this snapshot a name so the right draft is easy to find and restore later.
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
            {versionToReplaceOnSave ? (
              <Alert className="border-amber-300 bg-amber-50/70">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>History is full</AlertTitle>
                <AlertDescription>
                  Saving a new checkpoint will replace {versionToReplaceOnSave.label}, saved{" "}
                  {formatCheckpointTime(versionToReplaceOnSave.savedAt)}. The recommended action downloads a complete
                  backup first, so every current checkpoint remains recoverable.
                </AlertDescription>
              </Alert>
            ) : existingVersionForSave ? (
              <Alert>
                <History className="h-4 w-4" />
                <AlertTitle>Matching checkpoint found</AlertTitle>
                <AlertDescription>
                  Saving will refresh {existingVersionForSave.label} instead of using another local history slot.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <History className="h-4 w-4" />
                <AlertTitle>{MAX_VERSION_HISTORY - versionHistory.length} local slots available</AlertTitle>
                <AlertDescription>
                  PrivaCV keeps the newest {MAX_VERSION_HISTORY} checkpoints in this browser.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">Saved only in this browser.</span>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setVersionSaveOpen(false)}>
                  Cancel
                </Button>
                {versionToReplaceOnSave ? (
                  <>
                    <Button type="submit" variant="outline">
                      <Save /> Save without backup
                    </Button>
                    <Button type="button" onClick={() => saveVersion(true)}>
                      <Download /> Back up &amp; Save
                    </Button>
                  </>
                ) : (
                  <Button type="submit">
                    <Save /> Save Checkpoint
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyBackupToImport)} onOpenChange={(open) => !open && setHistoryBackupToImport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Checkpoint backup</DialogDescription>
            <DialogTitle>Add saved checkpoints from backup</DialogTitle>
            <DialogDescription>
              Your current resume stays open. Imported checkpoints are merged with this browser&apos;s local history.
            </DialogDescription>
          </DialogHeader>
          {historyBackupToImport ? (
            <div className="grid gap-3">
              <Alert>
                <History className="h-4 w-4" />
                <AlertTitle>
                  {mergedHistoryBackup.incomingUnique.length
                    ? `${mergedHistoryBackup.incomingUnique.length} unique ${mergedHistoryBackup.incomingUnique.length === 1 ? "checkpoint" : "checkpoints"} ready to add`
                    : "No new checkpoints to add"}
                </AlertTitle>
                <AlertDescription>
                  PrivaCV keeps the newest {MAX_VERSION_HISTORY} unique checkpoints. After merging, {mergedHistoryBackup.checkpoints.length} will remain in this browser.
                </AlertDescription>
              </Alert>
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-md border bg-muted/30 p-3">
                {mergedHistoryBackup.incomingUnique.map((checkpoint) => (
                  <Badge key={checkpoint.id} variant="outline" className="max-w-full truncate">
                    {checkpoint.label}
                  </Badge>
                ))}
                {!mergedHistoryBackup.incomingUnique.length ? (
                  <span className="text-sm text-muted-foreground">Every checkpoint in this backup already has a local match.</span>
                ) : null}
              </div>
              {mergedHistoryBackup.matchingCheckpoints.length ? (
                <Alert className="border-sky-300 bg-sky-50/70">
                  <Check className="h-4 w-4" />
                  <AlertTitle>
                    {mergedHistoryBackup.matchingCheckpoints.length} {mergedHistoryBackup.matchingCheckpoints.length === 1 ? "checkpoint already matches" : "checkpoints already match"} this browser
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <span>Matching drafts will not use another local history slot.</span>
                    <span className="flex flex-wrap gap-2">
                      {mergedHistoryBackup.matchingCheckpoints.map((checkpoint) => (
                        <Badge key={checkpoint.id} variant="outline" className="max-w-full border-sky-300 bg-background text-foreground">
                          {checkpoint.label}
                        </Badge>
                      ))}
                    </span>
                  </AlertDescription>
                </Alert>
              ) : null}
              {mergedHistoryBackup.overflow.length ? (
                <Alert className="border-amber-300 bg-amber-50/70">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>
                    {mergedHistoryBackup.overflow.length} older {mergedHistoryBackup.overflow.length === 1 ? "checkpoint will" : "checkpoints will"} stay only in this backup
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                    <span>
                      These drafts fall outside this browser&apos;s {MAX_VERSION_HISTORY}-checkpoint limit. Keep the backup file to retain them.
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {mergedHistoryBackup.overflow.map((checkpoint) => (
                        <Badge key={checkpoint.id} variant="outline" className="max-w-full border-amber-300 bg-background text-foreground">
                          {checkpoint.label} · {formatCheckpointTime(checkpoint.savedAt)}
                        </Badge>
                      ))}
                    </span>
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">Nothing is uploaded or sent anywhere.</span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setHistoryBackupToImport(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={importVersionHistoryBackup}>
                <History /> Add checkpoints
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionCompareOpen} onOpenChange={(open) => !open && setVersionCompareTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Version history</DialogDescription>
            <DialogTitle>{versionCompareUsesCurrent ? "Compare saved checkpoint" : "Compare saved versions"}</DialogTitle>
            <DialogDescription>{versionCompareDescription}</DialogDescription>
          </DialogHeader>

          {comparedBaseVersion && comparedTargetState ? (
            <div className="grid max-h-[56vh] gap-3 overflow-y-auto pr-1">
              {versionChanges.length ? (
                <div className="grid gap-2">
                  {versionChanges.map((change) => (
                    <VersionChangeRow
                      key={change.id}
                      change={change}
                      beforeLabel={versionCompareBeforeLabel}
                      afterLabel={versionCompareAfterLabel}
                      onSelect={versionCompareUsesCurrent ? () => focusFromVersionCompare(change.targetId) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertTitle>No resume differences found</AlertTitle>
                  <AlertDescription>
                    {versionCompareUsesCurrent
                      ? "The current resume matches this saved checkpoint."
                      : "These saved checkpoints contain the same resume content."}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : null}

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {versionChanges.length
                ? `${versionChanges.length} changed ${versionChanges.length === 1 ? "area" : "areas"}`
                : "Saved only in this browser"}
            </span>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setVersionCompareTarget(null)}>
                Close
              </Button>
              {comparedTargetVersion ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    restoreVersion(comparedTargetVersion);
                    setVersionCompareTarget(null);
                  }}
                >
                  <Undo2 /> Restore Compared
                </Button>
              ) : null}
              {comparedBaseVersion ? (
                <Button
                  type="button"
                  onClick={() => {
                    restoreVersion(comparedBaseVersion);
                    setVersionCompareTarget(null);
                  }}
                >
                  <Undo2 /> {versionCompareUsesCurrent ? "Restore Saved" : "Restore Base"}
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportCheckOpen} onOpenChange={setExportCheckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">PDF export check</DialogDescription>
            <DialogTitle>Review before exporting</DialogTitle>
            <DialogDescription>
              Fix the highest-impact items now, or continue if you have already reviewed the resume yourself.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            {importReview ? (
              <div className="rounded-md border border-amber-300 bg-amber-50/70 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {importReviewStatus?.isComplete ? "Imported fields are confirmed" : "Imported fields still need review"}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {importReviewStatus?.isComplete
                        ? "Finish the review to clear this reminder before your next export."
                        : "Confirm each suggested field, or consciously continue with Export Anyway."}
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
                    <Button type="button" variant="outline" size="sm" onClick={completeImportReview}>
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
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-700 text-xs font-bold text-white">
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
                <Printer /> Export Anyway
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={docxInputRef}
        type="file"
        accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
        hidden
        onChange={(event) => {
          void openDocx(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          void openPdf(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
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
