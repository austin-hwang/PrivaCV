"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ClipboardCopy,
  ClipboardPaste,
  Eye,
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
import {
  RoleFocusComparison,
  VersionChangeRow,
} from "@/components/resume-editor/version-changes";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import { plainTextStats } from "@/lib/resume";
import { MAX_VERSION_HISTORY, formatCheckpointTime } from "@/lib/resume-workspace";

export function ResumeEditorOverlays({
  editor,
}: {
  editor: ReturnType<typeof useResumeEditor>;
}) {
  const [pastedResumeText, setPastedResumeText] = useState("");
  const {
    checks,
    comparedBaseRoleFocus,
    comparedBaseRoleLabel,
    comparedBaseVersion,
    comparedTargetRoleFocus,
    comparedTargetRoleLabel,
    comparedTargetState,
    comparedTargetVersion,
    copyPlainText,
    existingVersionForSave,
    exportAnyway,
    exportCheckOpen,
    failedChecks,
    focusFromExportCheck,
    focusFromVersionCompare,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importVersionHistoryBackup,
    jobDescription,
    jsonInputRef,
    mergedHistoryBackup,
    openJson,
    openPdf,
    openTextImport,
    openVersionHistoryBackup,
    pdfInputRef,
    plainText,
    restoreVersion,
    roleLabel,
    saveVersion,
    setExportCheckOpen,
    setHistoryBackupToImport,
    setImportReview,
    setTextReviewOpen,
    setTextImportOpen,
    setVersionCompareTarget,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    textReviewOpen,
    textImportOpen,
    toast,
    versionChanges,
    versionCompareAfterLabel,
    versionCompareBeforeLabel,
    versionCompareDescription,
    versionCompareOpen,
    versionCompareUsesCurrent,
    versionDraftLabel,
    versionDraftNote,
    versionHistory,
    versionRoleFocusChanged,
    versionSaveOpen,
    versionToReplaceOnSave,
  } = editor;

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
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Local text import</DialogDescription>
            <DialogTitle>Paste the resume you already have</DialogTitle>
            <DialogDescription>
              Paste text copied from a document, LinkedIn, or an OCR&apos;d scanned PDF. Resume Editor structures it in this browser, then asks you to review the suggested fields.
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
              This is the exact ATS-friendly text that will be copied for job applications and recruiter portals.
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
              <Button type="button" onClick={copyPlainText} disabled={!plainText}>
                <ClipboardCopy /> Copy Text
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={versionSaveOpen} onOpenChange={setVersionSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogDescription className="font-semibold uppercase tracking-[0.16em]">Version history</DialogDescription>
            <DialogTitle>Name this checkpoint</DialogTitle>
            <DialogDescription>
              Add context before tailoring this resume so the right draft is easy to restore later.
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
              <span>Note (optional)</span>
              <Textarea
                value={versionDraftNote}
                placeholder="Before tailoring bullets for the Stripe application."
                className="min-h-24"
                onChange={(event) => setVersionDraftNote(event.target.value)}
              />
            </label>
            <Alert className={jobDescription.trim() || roleLabel.trim() ? "border-sky-300 bg-sky-50/70" : undefined}>
              <Target className="h-4 w-4" />
              <AlertTitle>
                {jobDescription.trim() ? "Role focus included" : roleLabel.trim() ? "Role label included" : "No role focus to include"}
              </AlertTitle>
              <AlertDescription>
                {jobDescription.trim()
                  ? "This checkpoint will keep its pasted job description and private role label so you can resume the same local wording review when you restore it."
                  : roleLabel.trim()
                    ? "This checkpoint will keep its private role label so this draft stays recognizable in local version history."
                    : "Add a job description or private role label in Role Focus before saving if you want this checkpoint to retain tailoring context."}
              </AlertDescription>
            </Alert>
            {versionToReplaceOnSave ? (
              <Alert className="border-amber-300 bg-amber-50/70">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>History is full</AlertTitle>
                <AlertDescription>
                  Saving a new checkpoint will replace {versionToReplaceOnSave.label}, saved{" "}
                  {formatCheckpointTime(versionToReplaceOnSave.savedAt)}. Back up checkpoints first if you want a copy
                  outside this browser.
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
                  Resume Editor keeps the newest {MAX_VERSION_HISTORY} checkpoints in this browser.
                </AlertDescription>
              </Alert>
            )}
            <DialogFooter className="items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">Saved only in this browser.</span>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setVersionSaveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <Save /> Save Checkpoint
                </Button>
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
                  Resume Editor keeps the newest {MAX_VERSION_HISTORY} unique checkpoints. After merging, {mergedHistoryBackup.checkpoints.length} will remain in this browser.
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
              {versionRoleFocusChanged ? (
                <RoleFocusComparison
                  beforeLabel={versionCompareBeforeLabel}
                  afterLabel={versionCompareAfterLabel}
                  beforeRoleLabel={comparedBaseRoleLabel}
                  afterRoleLabel={comparedTargetRoleLabel}
                  beforeDescription={comparedBaseRoleFocus}
                  afterDescription={comparedTargetRoleFocus}
                />
              ) : null}
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
                ? `${versionChanges.length} changed ${versionChanges.length === 1 ? "area" : "areas"}${
                    versionRoleFocusChanged ? " · role focus changed" : ""
                  }`
                : versionRoleFocusChanged
                  ? "Same resume · role focus changed"
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
                    <p className="text-sm font-semibold">Imported fields still need review</p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      Confirm the suggested fields before exporting.
                    </p>
                  </div>
                  <Badge variant="secondary">{importReview.items.length} fields</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {importReview.items.slice(0, 3).map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => focusFromExportCheck(item.targetId)}
                    >
                      <Eye /> {item.label}
                    </Button>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImportReview(null)}>
                    <Check /> Mark reviewed
                  </Button>
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
          className="app-chrome fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          role="status"
        >
          {toast.message}
        </div>
      ) : null}

    </>
  );
}
