"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FileText,
  GitBranch,
  History,
  Printer,
  RotateCcw,
  Save,
  Target,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useResumeEditor } from "@/hooks/use-resume-editor";
import { buildRoleFocus, buildRolePhraseSuggestions, reviewRolePhrase } from "@/lib/job-match";
import {
  bulletsFrom,
  clampTextScale,
  exportChangeSummary,
  hasAnyContent,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  plainTextStats,
  resumePlainText,
  SECTION_LABELS,
  type ExportChange,
  type ResumeEntry,
  type ResumeState,
  type SectionKey,
} from "@/lib/resume";
import {
  CHANGE_PREVIEW_LIMIT,
  ENTRY_SCHEMA,
  MAX_VERSION_HISTORY,
  REPEATABLE_SECTIONS,
  compactDetail,
  formatCheckpointTime,
  roleContextFingerprint,
  versionContentBadges,
  versionHeadline,
  type RestoredVersionSummary,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

export function ResumeEditor() {
  const {
    addEntry,
    checks,
    clearResume,
    comparedBaseRoleFocus,
    comparedBaseRoleLabel,
    comparedBaseVersion,
    comparedTargetRoleFocus,
    comparedTargetRoleLabel,
    comparedTargetState,
    comparedTargetVersion,
    copyPlainText,
    deleteVersion,
    deletedVersion,
    dismissRecoveryPoint,
    dismissRestoredVersionSummary,
    existingVersionForSave,
    exportAnyway,
    exportChanges,
    exportCheckOpen,
    exportCheckpoint,
    exportFingerprint,
    exportIsCurrent,
    failedChecks,
    focusCheckTarget,
    focusFromExportCheck,
    focusFromVersionCompare,
    hasContent,
    historyBackupInputRef,
    historyBackupToImport,
    importReview,
    importReviewTargets,
    importVersionHistoryBackup,
    isImporting,
    jobDescription,
    jsonInputRef,
    loadSample,
    mergedHistoryBackup,
    moveEntry,
    moveSection,
    openJson,
    openPdf,
    openVersionHistoryBackup,
    openVersionSave,
    pageCount,
    passedChecks,
    pdfInputRef,
    plainText,
    recoveryPoint,
    removeEntry,
    requestExport,
    restoreRecoveryPoint,
    restoreVersion,
    resumeRef,
    roleFocus,
    roleLabel,
    saveJson,
    saveVersion,
    saveVersionHistoryBackup,
    setDeletedVersion,
    setExportCheckOpen,
    setHistoryBackupToImport,
    setImportReview,
    setJobDescription,
    setRoleLabel,
    setTextReviewOpen,
    setVersionCompareTarget,
    setVersionDraftLabel,
    setVersionDraftNote,
    setVersionSaveOpen,
    state,
    textReviewOpen,
    toast,
    undoDeleteVersion,
    updateEntry,
    updateField,
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
    visibleRestoredVersionSummary,
  } = useResumeEditor();

  return (
    <>
      <header className="app-chrome sticky top-0 z-40 border-b bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Private workspace</p>
            <h1 className="text-lg font-semibold tracking-normal">Resume Editor</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-64 flex-1 items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground lg:flex-none">
              <span className="whitespace-nowrap">Text size</span>
              <input
                id="resume-text-scale"
                className="min-w-24 flex-1 accent-foreground"
                type="range"
                min={MIN_TEXT_SCALE}
                max={MAX_TEXT_SCALE}
                step="0.02"
                value={state.textScale}
                onChange={(event) => updateField("textScale", clampTextScale(Number(event.target.value)))}
                aria-label="Resume text size"
              />
              <output className="w-10 text-right tabular-nums">{Math.round(state.textScale * 100)}%</output>
            </label>
            <Button type="button" onClick={requestExport}>
              <Printer /> Export PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => setTextReviewOpen(true)}>
              <ClipboardCopy /> Review Text
            </Button>
            <Button type="button" variant="outline" onClick={() => pdfInputRef.current?.click()} disabled={isImporting}>
              <Upload /> {isImporting ? "Importing" : "Import PDF"}
            </Button>
            <Button type="button" variant="outline" onClick={saveJson}>
              <Download /> Save JSON
            </Button>
            <Button type="button" variant="outline" onClick={() => jsonInputRef.current?.click()}>
              <FileJson /> Open JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={loadSample}
            >
              <FileText /> Sample
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Clear all fields? You can restore this version from the recovery card.")) {
                  clearResume();
                }
              }}
            >
              <RotateCcw /> Clear
            </Button>
          </div>
        </div>
      </header>

      <main className="app-shell grid min-h-[calc(100vh-73px)] grid-cols-1 lg:grid-cols-[minmax(390px,1fr)_minmax(440px,1fr)]">
        <section className="editor-pane overflow-y-auto border-b p-4 pb-16 lg:max-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:p-6">
          {!hasContent ? (
            <Card className="mb-6">
              <CardHeader>
                <CardDescription className="font-semibold uppercase tracking-[0.16em]">Private resume workspace</CardDescription>
                <CardTitle className="text-2xl">Start from the resume you already have.</CardTitle>
                <CardDescription>
                  Import a PDF, open a saved JSON file, or load a polished sample to see the final structure instantly.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => pdfInputRef.current?.click()} disabled={isImporting}>
                    <Upload /> Import PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadSample}
                  >
                    <FileText /> Use Sample
                  </Button>
                  <Button type="button" variant="outline" onClick={() => jsonInputRef.current?.click()}>
                    <FileJson /> Open JSON
                  </Button>
                  <Button type="button" variant="outline" onClick={() => historyBackupInputRef.current?.click()}>
                    <History /> Open checkpoint backup
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {["No account", "Local autosave", "Free PDF export"].map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {recoveryPoint ? (
            <Card className="mb-6 border-sky-300 bg-sky-50/70">
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.16em] text-sky-900">
                    Restore point saved
                  </CardDescription>
                  <CardTitle className="text-base">You can go back to the previous resume.</CardTitle>
                  <CardDescription>
                    {recoveryPoint.label}. This recovery point stays in this browser tab until you dismiss or restore it.
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={restoreRecoveryPoint}>
                    <Undo2 /> Restore previous
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={dismissRecoveryPoint}>
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ) : null}

          {importReview ? (
            <Card className="mb-6 border-amber-300 bg-amber-50/70">
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardDescription className="font-semibold uppercase tracking-[0.16em] text-amber-900">
                      PDF import review
                    </CardDescription>
                    <CardTitle className="text-base">Check the fields PDF parsing usually guesses.</CardTitle>
                    <CardDescription>
                      Imported from {importReview.fileName}. Formatting in PDFs is approximate, so confirm these fields
                      before exporting.
                    </CardDescription>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setImportReview(null)}>
                    <Check /> Done
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {importReview.sections.map((section) => (
                    <Badge key={section} variant="secondary">
                      {section}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {importReview.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="group flex min-h-16 gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => focusCheckTarget(item.targetId)}
                  >
                    <Eye className="mt-0.5 size-4 shrink-0 text-amber-800" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                    <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <VersionHistoryCard
            hasContent={hasContent}
            versions={versionHistory}
            currentState={state}
            currentFingerprint={exportFingerprint}
            currentRoleFocus={jobDescription}
            currentRoleLabel={roleLabel}
            deletedVersion={deletedVersion}
            onSave={openVersionSave}
            onSaveBackup={saveVersionHistoryBackup}
            onOpenBackup={() => historyBackupInputRef.current?.click()}
            onCompareCurrent={(item) => setVersionCompareTarget({ baseId: item.id, targetId: "current" })}
            onCompareSaved={(base, target) => setVersionCompareTarget({ baseId: base.id, targetId: target.id })}
            onRestore={restoreVersion}
            onDelete={deleteVersion}
            onUndoDelete={undoDeleteVersion}
            onDismissDeleted={() => setDeletedVersion(null)}
          />

          {visibleRestoredVersionSummary ? (
            <RestoredVersionCard
              summary={visibleRestoredVersionSummary}
              onDismiss={dismissRestoredVersionSummary}
              onFocus={focusCheckTarget}
            />
          ) : null}

          {hasContent ? (
            <RoleFocusCard
              jobDescription={jobDescription}
              roleLabel={roleLabel}
              roleFocus={roleFocus}
              resumeText={plainText}
              onChange={setJobDescription}
              onRoleLabelChange={setRoleLabel}
              onClear={() => setJobDescription("")}
            />
          ) : null}

          {hasContent ? (
            <Card className="mb-6">
              <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardDescription className="font-semibold uppercase tracking-[0.16em]">Resume Check</CardDescription>
                  <CardTitle>{passedChecks === checks.length ? "Ready to export" : "Needs attention"}</CardTitle>
                </div>
                <Badge variant="outline" className="tabular-nums">
                  {passedChecks}/{checks.length}
                </Badge>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {checks.map((check) => (
                  <div key={check.id} className="flex min-h-14 gap-2 rounded-md border bg-muted/30 p-2.5">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                        check.ok ? "bg-emerald-700" : "bg-amber-700",
                      )}
                    >
                      {check.ok ? <Check className="size-3" /> : "!"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{check.label}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                      {!check.ok ? (
                        <>
                          <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 px-2"
                            onClick={() => focusCheckTarget(check.targetId)}
                          >
                            <ArrowRight /> {check.actionLabel}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {hasContent && exportCheckpoint ? (
            <Card className={cn("mb-6", exportIsCurrent ? "border-emerald-300 bg-emerald-50/70" : "border-indigo-300 bg-indigo-50/70")}>
              <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-background",
                      exportIsCurrent ? "border-emerald-300 text-emerald-800" : "border-indigo-300 text-indigo-800",
                    )}
                  >
                    {exportIsCurrent ? <FileCheck2 className="size-4" /> : <History className="size-4" />}
                  </span>
                  <div>
                    <CardDescription
                      className={cn(
                        "font-semibold uppercase tracking-[0.16em]",
                        exportIsCurrent ? "text-emerald-900" : "text-indigo-900",
                      )}
                    >
                      Last export
                    </CardDescription>
                    <CardTitle className="text-base">
                      {exportIsCurrent ? "Current resume matches your last PDF export." : "This resume changed since your last PDF export."}
                    </CardTitle>
                    <CardDescription>
                      Last opened print on {formatCheckpointTime(exportCheckpoint.exportedAt)} with {exportCheckpoint.pageCount}{" "}
                      {exportCheckpoint.pageCount === 1 ? "page" : "pages"} and{" "}
                      {exportCheckpoint.issueCount === 0
                        ? "no unresolved checks"
                        : `${exportCheckpoint.issueCount} unresolved ${exportCheckpoint.issueCount === 1 ? "item" : "items"}`}
                      .
                    </CardDescription>
                  </div>
                </div>
                {!exportIsCurrent ? (
                  <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={requestExport}>
                    <Printer /> Export updated PDF
                  </Button>
                ) : null}
              </CardHeader>
              {!exportIsCurrent && exportChanges.length ? (
                <CardContent className="pt-0">
                  <ChangeSummaryGrid
                    changes={exportChanges}
                    beforeLabel="Before"
                    afterLabel="Now"
                    onSelect={(change) => focusCheckTarget(change.targetId)}
                  />
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          <div className="space-y-6">
            <FieldGroup title="Header">
              <TextField
                id="field-name"
                label="Full Name"
                value={state.name}
                placeholder="Jane Doe"
                reviewTarget={importReviewTargets.has("field-name")}
                onChange={(value) => updateField("name", value)}
              />
              <TextField
                id="field-title"
                label="Title / Role"
                value={state.title}
                placeholder="Senior Software Engineer"
                reviewTarget={importReviewTargets.has("field-title")}
                onChange={(value) => updateField("title", value)}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="field-email"
                  label="Email"
                  value={state.email}
                  placeholder="jane@example.com"
                  reviewTarget={importReviewTargets.has("field-email")}
                  onChange={(value) => updateField("email", value)}
                />
                <TextField
                  id="field-phone"
                  label="Phone"
                  value={state.phone}
                  placeholder="(555) 123-4567"
                  reviewTarget={importReviewTargets.has("field-phone")}
                  onChange={(value) => updateField("phone", value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  id="field-location"
                  label="Location"
                  value={state.location}
                  placeholder="San Francisco, CA"
                  reviewTarget={importReviewTargets.has("field-location")}
                  onChange={(value) => updateField("location", value)}
                />
                <TextField
                  id="field-website"
                  label="Website / LinkedIn"
                  value={state.website}
                  placeholder="linkedin.com/in/janedoe"
                  reviewTarget={importReviewTargets.has("field-website")}
                  onChange={(value) => updateField("website", value)}
                />
              </div>
            </FieldGroup>

            <FieldGroup title="Summary">
              <TextAreaField
                id="field-summary"
                label="Professional Summary"
                value={state.summary}
                placeholder="Brief overview of your experience and strengths."
                reviewTarget={importReviewTargets.has("field-summary")}
                onChange={(value) => updateField("summary", value)}
              />
            </FieldGroup>

            {state.sectionOrder.map((section, sectionIndex) => (
              <FieldGroup
                key={section}
                title={SECTION_LABELS[section]}
                actions={
                  <div
                    id={sectionIndex === 0 ? "section-order-controls" : undefined}
                    className="flex items-center gap-1 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    tabIndex={sectionIndex === 0 ? -1 : undefined}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${SECTION_LABELS[section]} up`}
                      disabled={sectionIndex === 0}
                      onClick={() => moveSection(section, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Move ${SECTION_LABELS[section]} down`}
                      disabled={sectionIndex === state.sectionOrder.length - 1}
                      onClick={() => moveSection(section, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    {section !== "skills" ? (
                      <Button id={`add-${section}-entry`} type="button" variant="outline" size="sm" onClick={() => addEntry(section)}>
                        Add
                      </Button>
                    ) : null}
                  </div>
                }
              >
                {section === "skills" ? (
                  <TextAreaField
                    id="field-skills"
                    label={'Skills (one group per line, e.g. "Languages: Python, Go")'}
                    value={state.skills}
                    placeholder={"Languages: Python, JavaScript, Go\nTools: Docker, Kubernetes, AWS"}
                    reviewTarget={importReviewTargets.has("field-skills")}
                    onChange={(value) => updateField("skills", value)}
                  />
                ) : (
                  <EntryList
                    section={section}
                    entries={state[section]}
                    reviewTargets={importReviewTargets}
                    onUpdate={updateEntry}
                    onMove={moveEntry}
                    onRemove={removeEntry}
                  />
                )}
              </FieldGroup>
            ))}
          </div>
        </section>

        <section className="preview-pane overflow-y-auto bg-muted/70 p-4 lg:max-h-[calc(100vh-73px)] lg:p-7" aria-label="Resume preview">
          <div className="mx-auto flex flex-col items-center gap-3">
            <ResumePreview state={state} ref={resumeRef} />
            <p className="app-chrome text-xs text-muted-foreground">
              {pageCount} {pageCount === 1 ? "page" : "pages"} in preview
            </p>
          </div>
        </section>
      </main>

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
                    <p className="text-sm font-semibold">PDF import still needs review</p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      Confirm the parser guessed fields correctly before exporting {importReview.fileName}.
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
                <AlertDescription>The remaining checkpoint is the imported PDF review.</AlertDescription>
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

function VersionChangeRow({
  change,
  beforeLabel,
  afterLabel,
  onSelect,
}: {
  change: ExportChange;
  beforeLabel: string;
  afterLabel: string;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <History className="mt-0.5 size-4 shrink-0 text-indigo-800" />
      <div className="min-w-0">
        <span className="block font-semibold text-foreground">{change.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{change.detail}</span>
        <ChangeFieldLabels labels={change.fieldLabels} />
        {change.before || change.after ? (
          <span className="mt-2 grid gap-1 text-xs leading-snug text-muted-foreground">
            <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
              <span className="font-medium text-foreground">{beforeLabel}</span>
              <span className="truncate">{change.before ?? "Empty"}</span>
            </span>
            <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
              <span className="font-medium text-foreground">{afterLabel}</span>
              <span className="truncate">{change.after ?? "Empty"}</span>
            </span>
          </span>
        ) : null}
      </div>
      {onSelect ? (
        <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </>
  );

  const className =
    "group flex min-h-24 gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (onSelect) {
    return (
      <button type="button" className={cn(className, "hover:border-indigo-500")} onClick={onSelect}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function RoleFocusComparison({
  beforeLabel,
  afterLabel,
  beforeRoleLabel,
  afterRoleLabel,
  beforeDescription,
  afterDescription,
}: {
  beforeLabel: string;
  afterLabel: string;
  beforeRoleLabel: string;
  afterRoleLabel: string;
  beforeDescription: string;
  afterDescription: string;
}) {
  return (
    <Alert className="border-sky-300 bg-sky-50/70">
      <Target className="h-4 w-4 text-sky-800" />
      <AlertTitle>Role focus changed</AlertTitle>
      <AlertDescription className="grid gap-2">
        <span>These drafts use different local role context. Restore the matching checkpoint to bring its role label and job description back.</span>
        <span className="grid gap-1.5 rounded-md border border-sky-200 bg-background p-2 text-xs leading-snug text-muted-foreground">
          {beforeRoleLabel || afterRoleLabel ? (
            <>
              <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
                <span className="font-medium text-foreground">{beforeLabel} label</span>
                <span>{beforeRoleLabel || "No label saved"}</span>
              </span>
              <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
                <span className="font-medium text-foreground">{afterLabel} label</span>
                <span>{afterRoleLabel || "No label saved"}</span>
              </span>
            </>
          ) : null}
          <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
            <span className="font-medium text-foreground">{beforeLabel}</span>
            <span>{beforeDescription ? compactDetail(beforeDescription) : "No role focus saved"}</span>
          </span>
          <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
            <span className="font-medium text-foreground">{afterLabel}</span>
            <span>{afterDescription ? compactDetail(afterDescription) : "No role focus saved"}</span>
          </span>
        </span>
      </AlertDescription>
    </Alert>
  );
}

function ChangeSummaryGrid({
  changes,
  beforeLabel,
  afterLabel,
  onSelect,
}: {
  changes: ExportChange[];
  beforeLabel: string;
  afterLabel: string;
  onSelect?: (change: ExportChange) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleChanges = showAll ? changes : changes.slice(0, CHANGE_PREVIEW_LIMIT);
  const hiddenCount = changes.length - visibleChanges.length;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visibleChanges.map((change) => (
        <VersionChangeRow
          key={change.id}
          change={change}
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
          onSelect={onSelect ? () => onSelect(change) : undefined}
        />
      ))}
      {changes.length > CHANGE_PREVIEW_LIMIT ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed bg-background p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {showAll
                ? `Showing all ${changes.length} changed areas`
                : `${hiddenCount} more changed ${hiddenCount === 1 ? "area" : "areas"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {showAll ? "Collapse the audit trail when you are done reviewing." : "Expand the full audit trail before exporting or restoring."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowAll((current) => !current)}>
            {showAll ? <ChevronUp /> : <ChevronDown />}
            {showAll ? "Show fewer changes" : "Show all changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RestoredVersionCard({
  summary,
  onDismiss,
  onFocus,
}: {
  summary: RestoredVersionSummary;
  onDismiss: () => void;
  onFocus: (targetId: string) => void;
}) {
  return (
    <Card className="mb-6 border-violet-300 bg-violet-50/70">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-violet-300 bg-background text-violet-800">
            <Undo2 className="size-4" />
          </span>
          <div>
            <CardDescription className="font-semibold uppercase tracking-[0.16em] text-violet-900">
              Checkpoint restored
            </CardDescription>
            <CardTitle className="text-base">{summary.label}</CardTitle>
            <CardDescription>
              Restored from the version saved {formatCheckpointTime(summary.savedAt)}. Review what changed from the draft
              you were editing.
            </CardDescription>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {summary.changes.length ? (
          <ChangeSummaryGrid
            changes={summary.changes}
            beforeLabel="Before"
            afterLabel="Restored"
            onSelect={(change) => onFocus(change.targetId)}
          />
        ) : (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>No differences found</AlertTitle>
            <AlertDescription>This checkpoint already matched the resume you were editing.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeFieldLabels({ labels }: { labels?: string[] }) {
  if (!labels?.length) return null;
  const visibleLabels = labels.slice(0, 4);
  const hiddenCount = labels.length - visibleLabels.length;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visibleLabels.map((label) => (
        <Badge key={label} variant="secondary" className="h-5 max-w-full truncate px-1.5 text-[10px] font-medium normal-case tracking-normal">
          {label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium normal-case tracking-normal">
          +{hiddenCount} more
        </Badge>
      ) : null}
    </div>
  );
}

function FieldGroup({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b pb-5 last:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h2>
        {actions}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function RoleFocusCard({
  jobDescription,
  roleLabel,
  roleFocus,
  resumeText,
  onChange,
  onRoleLabelChange,
  onClear,
}: {
  jobDescription: string;
  roleLabel: string;
  roleFocus: ReturnType<typeof buildRoleFocus>;
  resumeText: string;
  onChange: (value: string) => void;
  onRoleLabelChange: (value: string) => void;
  onClear: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const hasDescription = Boolean(jobDescription.trim());
  const matchedTerms = roleFocus.terms.filter((term) => term.matched);
  const missingTerms = roleFocus.terms.filter((term) => !term.matched);
  const phraseReview = useMemo(() => reviewRolePhrase(resumeText, phrase), [phrase, resumeText]);
  const phraseSuggestions = useMemo(
    () => buildRolePhraseSuggestions(resumeText, jobDescription),
    [jobDescription, resumeText],
  );

  useEffect(() => {
    setPhrase("");
  }, [jobDescription]);

  const clearDescription = () => {
    setPhrase("");
    onClear();
  };

  return (
    <Card className="mb-6 border-sky-300 bg-sky-50/70">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-sky-300 bg-background text-sky-800">
            <Target className="size-4" />
          </span>
          <div>
            <CardDescription className="font-semibold uppercase tracking-[0.16em] text-sky-900">Role focus</CardDescription>
            <CardTitle className="text-base">Check the language you already use.</CardTitle>
            <CardDescription>
              Paste a job description to find its most repeated terms in your resume. Everything stays in this browser.
            </CardDescription>
          </div>
        </div>
        {hasDescription ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearDescription}>
            Clear description
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="grid gap-1.5 text-sm font-medium">
          <span>Private role label (optional)</span>
          <Input
            value={roleLabel}
            onChange={(event) => onRoleLabelChange(event.target.value)}
            placeholder="e.g. Acme — Senior Product Engineer"
          />
          <span className="text-xs font-normal leading-snug text-muted-foreground">
            A short local-only label makes saved drafts easy to recognize. It never appears in your resume or PDF.
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          <span>Job description</span>
          <Textarea
            value={jobDescription}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Paste the role description here to compare wording locally."
            className="min-h-24 resize-y bg-background"
          />
        </label>
        {hasDescription && roleFocus.totalCount ? (
          <div className="rounded-md border bg-background p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                {roleFocus.matchedCount} of {roleFocus.totalCount} selected terms already used
              </Badge>
              <span className="text-xs text-muted-foreground">Repeated terms are listed first.</span>
            </div>
            {matchedTerms.length ? (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Already present</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedTerms.map((term) => (
                    <Badge key={term.term} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {missingTerms.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Not found verbatim</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingTerms.map((term) => (
                    <Badge key={term.term} variant="outline" className="border-amber-300 bg-amber-50 text-amber-950">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              Use missing terms only when they accurately describe your experience. This is a wording review, not an ATS score.
            </p>
          </div>
        ) : hasDescription ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>Add a little more role detail</AlertTitle>
            <AlertDescription>
              Try pasting the responsibilities and requirements so Resume Editor can surface useful terms to review.
            </AlertDescription>
          </Alert>
        ) : null}
        {hasDescription ? (
          <div className="rounded-md border bg-background p-3">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Check an exact phrase from this role</span>
              <Input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="e.g. TypeScript services"
                aria-describedby="role-phrase-help"
              />
            </label>
            <p id="role-phrase-help" className="mt-1.5 text-xs leading-snug text-muted-foreground">
              Compare a specific two-or-more-word concept after deciding it accurately reflects your work.
            </p>
            {phraseSuggestions.length ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Suggested exact phrases</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Pick one to review it below. Suggestions come directly from adjacent wording in the job description.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {phraseSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.phrase}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8 whitespace-normal py-1 text-left"
                      onClick={() => setPhrase(suggestion.phrase)}
                    >
                      {suggestion.phrase}
                      <span className={cn("ml-1.5 text-xs", suggestion.matched ? "text-emerald-800" : "text-muted-foreground")}>
                        {suggestion.matched ? "in resume" : "review"}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {phraseReview.phrase ? (
              <div aria-live="polite" className="mt-3 rounded-md border bg-muted/30 p-2.5 text-sm">
                {phraseReview.termCount < 2 ? (
                  <p className="text-muted-foreground">Add at least two words to check a phrase.</p>
                ) : phraseReview.matched ? (
                  <p className="font-medium text-emerald-900">Phrase already appears in your resume.</p>
                ) : (
                  <p className="font-medium text-amber-950">Phrase not found verbatim in your resume.</p>
                )}
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  This checks the same word sequence while ignoring punctuation and spacing; it does not judge your fit.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function VersionHistoryCard({
  hasContent,
  versions,
  currentState,
  currentFingerprint,
  currentRoleFocus,
  currentRoleLabel,
  deletedVersion,
  onSave,
  onSaveBackup,
  onOpenBackup,
  onCompareCurrent,
  onCompareSaved,
  onRestore,
  onDelete,
  onUndoDelete,
  onDismissDeleted,
}: {
  hasContent: boolean;
  versions: VersionHistoryItem[];
  currentState: ResumeState;
  currentFingerprint: string;
  currentRoleFocus: string;
  currentRoleLabel: string;
  deletedVersion: VersionHistoryItem | null;
  onSave: () => void;
  onSaveBackup: () => void;
  onOpenBackup: () => void;
  onCompareCurrent: (item: VersionHistoryItem) => void;
  onCompareSaved: (base: VersionHistoryItem, target: VersionHistoryItem) => void;
  onRestore: (item: VersionHistoryItem) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onDismissDeleted: () => void;
}) {
  const [savedCompareBaseId, setSavedCompareBaseId] = useState("");
  const [savedCompareTargetId, setSavedCompareTargetId] = useState("");
  const versionInsights = useMemo(
    () =>
      versions.map((item) => {
        const text = resumePlainText(item.state);
        const isCurrent = item.fingerprint === currentFingerprint;
        const roleFocusMatchesCurrent =
          roleContextFingerprint(item.jobDescription, item.roleLabel) ===
          roleContextFingerprint(currentRoleFocus, currentRoleLabel);
        const changesFromCurrent = isCurrent ? [] : exportChangeSummary(item.state, currentState);
        return { item, text, isCurrent, roleFocusMatchesCurrent, changesFromCurrent };
      }),
    [currentFingerprint, currentRoleFocus, currentRoleLabel, currentState, versions],
  );
  const suggestedComparison = useMemo(
    () =>
      versionInsights.reduce<(typeof versionInsights)[number] | null>((best, insight) => {
        if (insight.isCurrent || insight.changesFromCurrent.length === 0) return best;
        if (!best || insight.changesFromCurrent.length < best.changesFromCurrent.length) return insight;
        return best;
      }, null),
    [versionInsights],
  );
  const baseVersion = versions.find((item) => item.id === savedCompareBaseId) ?? versions[0] ?? null;
  const targetVersion =
    versions.find((item) => item.id === savedCompareTargetId && item.id !== baseVersion?.id) ??
    versions.find((item) => item.id !== baseVersion?.id) ??
    null;
  const oldestVersion = versions[versions.length - 1] ?? null;
  const remainingSlots = Math.max(0, MAX_VERSION_HISTORY - versions.length);

  if (!hasContent && !versions.length && !deletedVersion) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardDescription className="font-semibold uppercase tracking-[0.16em]">Version history</CardDescription>
          <CardTitle className="text-base">Save a local checkpoint before tailoring.</CardTitle>
          <CardDescription>
            Keep up to {MAX_VERSION_HISTORY} browser-only versions so you can experiment without losing a strong draft.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenBackup}>
            <Upload /> Open backup
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSaveBackup} disabled={!versions.length}>
            <Download /> Back up checkpoints
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={!hasContent}>
            <Save /> Save version
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {versions.length ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
              remainingSlots === 0 ? "border-amber-300 bg-amber-50/70" : "bg-background",
            )}
          >
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant={remainingSlots === 0 ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">
                  {versions.length}/{MAX_VERSION_HISTORY} saved
                </Badge>
                {remainingSlots === 0 ? (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                    Full
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm font-semibold">
                {remainingSlots === 0 ? "New checkpoints replace the oldest saved draft." : "Local checkpoint space available."}
              </p>
              <p className="text-xs text-muted-foreground">
                {remainingSlots === 0 && oldestVersion
                  ? `${oldestVersion.label} is the oldest checkpoint and will be replaced first by a new unique save.`
                  : `${remainingSlots} ${remainingSlots === 1 ? "slot" : "slots"} left before Resume Editor starts replacing the oldest checkpoint.`}
              </p>
            </div>
            {remainingSlots === 0 ? (
              <Button type="button" variant="outline" size="sm" className="shrink-0 bg-background" onClick={onSave} disabled={!hasContent}>
                <Save /> Save with review
              </Button>
            ) : null}
          </div>
        ) : null}
        {deletedVersion ? (
          <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Deleted checkpoint
                </Badge>
                <span className="text-xs text-muted-foreground">Saved {formatCheckpointTime(deletedVersion.savedAt)}</span>
              </div>
              <p className="truncate text-sm font-semibold">{deletedVersion.label}</p>
              <p className="text-xs text-muted-foreground">Restore it to version history before closing this page.</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onUndoDelete}>
                <Undo2 /> Undo delete
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onDismissDeleted}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
        {suggestedComparison ? (
          <div className="flex flex-col gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Suggested checkpoint
                </Badge>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {suggestedComparison.changesFromCurrent.length} changed{" "}
                  {suggestedComparison.changesFromCurrent.length === 1 ? "area" : "areas"}
                </Badge>
              </div>
              <p className="truncate text-sm font-semibold">{suggestedComparison.item.label}</p>
              <p className="text-xs text-muted-foreground">
                Closest saved draft to the current resume. Review it first before restoring older checkpoints.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 bg-background"
              onClick={() => onCompareCurrent(suggestedComparison.item)}
            >
              <Eye /> Review differences
            </Button>
          </div>
        ) : null}
        {versions.length >= 2 && baseVersion && targetVersion ? (
          <div className="grid gap-3 rounded-md border bg-background p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Compare two saved checkpoints</p>
                <p className="text-xs text-muted-foreground">Audit tailoring changes without changing the current resume.</p>
              </div>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => onCompareSaved(baseVersion, targetVersion)}>
                <Eye /> Compare saved versions
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                <span>Base checkpoint</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={baseVersion.id}
                  onChange={(event) => setSavedCompareBaseId(event.target.value)}
                >
                  {versions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} - {formatCheckpointTime(item.savedAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                <span>Compared checkpoint</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={targetVersion.id}
                  onChange={(event) => setSavedCompareTargetId(event.target.value)}
                >
                  {versions
                    .filter((item) => item.id !== baseVersion.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label} - {formatCheckpointTime(item.savedAt)}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}
        {versions.length ? (
          versionInsights.map(({ item, text, isCurrent, roleFocusMatchesCurrent, changesFromCurrent }) => {
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                    <History className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Saved {formatCheckpointTime(item.savedAt)}
                      </p>
                      {isCurrent && roleFocusMatchesCurrent ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          Current
                        </Badge>
                      ) : isCurrent ? (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          Same resume
                        </Badge>
                      ) : changesFromCurrent.length ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {changesFromCurrent.length} changed {changesFromCurrent.length === 1 ? "area" : "areas"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          No visible differences
                        </Badge>
                      )}
                      {isCurrent && !roleFocusMatchesCurrent ? (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          Role focus changed
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{versionHeadline(item.state)}</p>
                    {item.derivedFromLabel ? (
                      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <GitBranch className="size-3 shrink-0" />
                        <span className="truncate">Derived from {item.derivedFromLabel}</span>
                      </p>
                    ) : null}
                    {item.roleLabel || item.jobDescription ? (
                      <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <Target className="size-3 shrink-0" />
                        <span className="truncate">
                          {item.roleLabel ? `Role label · ${item.roleLabel}` : "Role focus saved"}
                          {item.jobDescription ? ` · ${compactDetail(item.jobDescription)}` : ""}
                        </span>
                      </p>
                    ) : null}
                    {item.note ? <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{item.note}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {versionContentBadges(item.state).map((label) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="h-5 max-w-full truncate px-1.5 text-[10px] font-medium normal-case tracking-normal"
                        >
                          {label}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{text ? plainTextStats(text) : "Empty resume"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onCompareCurrent(item)}>
                    <Eye /> Compare
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onRestore(item)}>
                    <Undo2 /> Restore
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Delete saved version ${item.label}`} onClick={() => onDelete(item.id)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            No saved versions yet. Save one before adapting this resume for a specific job.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TextField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextAreaField({
  id,
  label,
  value,
  placeholder,
  reviewTarget,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  reviewTarget?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        className={cn(reviewTarget && "border-amber-500 bg-amber-50 ring-2 ring-amber-200")}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EntryList({
  section,
  entries,
  reviewTargets,
  onUpdate,
  onMove,
  onRemove,
}: {
  section: (typeof REPEATABLE_SECTIONS)[number];
  entries: ResumeEntry[];
  reviewTargets: Set<string>;
  onUpdate: (section: (typeof REPEATABLE_SECTIONS)[number], index: number, key: keyof ResumeEntry, value: string) => void;
  onMove: (section: (typeof REPEATABLE_SECTIONS)[number], index: number, direction: -1 | 1) => void;
  onRemove: (section: (typeof REPEATABLE_SECTIONS)[number], index: number) => void;
}) {
  const schema = ENTRY_SCHEMA[section];

  if (!entries.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        No {SECTION_LABELS[section].toLowerCase()} entries yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <Card key={index} className="bg-muted/20 shadow-none">
          <CardContent className="space-y-3 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Move entry up"
                  disabled={index === 0}
                  onClick={() => onMove(section, index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Move entry down"
                  disabled={index === entries.length - 1}
                  onClick={() => onMove(section, index, 1)}
                >
                  <ArrowDown />
                </Button>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(section, index)}>
                <Trash2 /> Remove
              </Button>
            </div>
            <TextField
              id={`field-${section}-${index}-title`}
              label={schema.title}
              value={entry.title}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-title`)}
              onChange={(value) => onUpdate(section, index, "title", value)}
            />
            <TextField
              id={`field-${section}-${index}-subtitle`}
              label={schema.subtitle}
              value={entry.subtitle}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-subtitle`)}
              onChange={(value) => onUpdate(section, index, "subtitle", value)}
            />
            <TextField
              id={`field-${section}-${index}-meta`}
              label={schema.meta}
              value={entry.meta}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-meta`)}
              onChange={(value) => onUpdate(section, index, "meta", value)}
            />
            <TextAreaField
              id={`field-${section}-${index}-details`}
              label={schema.details}
              value={entry.details}
              reviewTarget={reviewTargets.has(`field-${section}-${index}-details`)}
              onChange={(value) => onUpdate(section, index, "details", value)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const ResumePreview = forwardRef<HTMLDivElement, { state: ResumeState }>(function ResumePreview({ state }, ref) {
  const hasContent = hasAnyContent(state);

  return (
    <div
      ref={ref}
      className={cn("resume-sheet", !hasContent && "resume-empty")}
      style={{ "--resume-scale": state.textScale } as CSSProperties}
    >
      {!hasContent ? <EmptyResumePreview /> : <FilledResumePreview state={state} />}
    </div>
  );
});

function EmptyResumePreview() {
  return (
    <div aria-label="Empty resume preview">
      <p className="mb-2 font-sans text-[0.78em] font-bold uppercase tracking-[1px] text-[#666]">Clean one-page structure</p>
      <h1 className="resume-name">Your Name</h1>
      <div className="resume-contact">
        <span>email@example.com</span>
        <span>(555) 123-4567</span>
        <span>City, ST</span>
        <span>linkedin.com/in/you</span>
      </div>
      <div className="resume-empty-line resume-empty-line-wide" />
      <div className="resume-empty-line" />
      <section className="resume-section">
        <h2 className="resume-section-title">Experience</h2>
        <div className="resume-empty-role" />
        <ul className="resume-bullets">
          <li>Lead with measurable impact, scope, and outcomes.</li>
          <li>Keep each bullet concise enough to scan quickly.</li>
        </ul>
      </section>
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
        <div className="resume-empty-line resume-empty-line-short" />
      </section>
    </div>
  );
}

function FilledResumePreview({ state }: { state: ResumeState }) {
  const contactParts = [state.email, state.phone, state.location, state.website].filter(Boolean);

  return (
    <>
      <h1 className="resume-name">{state.name || "Your Name"}</h1>
      {state.title ? <div className="resume-title">{state.title}</div> : null}
      {contactParts.length ? (
        <div className="resume-contact">
          {contactParts.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
      ) : null}
      {state.summary ? <p className="resume-lead">{state.summary}</p> : null}
      {state.sectionOrder.map((section) => (
        <ResumeSection key={section} state={state} section={section} />
      ))}
    </>
  );
}

function ResumeSection({ state, section }: { state: ResumeState; section: SectionKey }) {
  if (section === "skills") {
    const lines = state.skills
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    return (
      <section className="resume-section">
        <h2 className="resume-section-title">Skills</h2>
        <div>
          {lines.map((line) => {
            const index = line.indexOf(":");
            return (
              <div className="resume-skill-line" key={line}>
                {index > -1 ? (
                  <>
                    <span className="resume-skill-cat">{line.slice(0, index).trim()}:</span> {line.slice(index + 1).trim()}
                  </>
                ) : (
                  line
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  const entries = state[section].filter((entry) => entry.title || entry.subtitle || entry.meta || entry.details);
  if (!entries.length) return null;

  return (
    <section className="resume-section">
      <h2 className="resume-section-title">{SECTION_LABELS[section]}</h2>
      {entries.map((entry, index) => (
        <div className="resume-entry" key={`${entry.title}-${entry.subtitle}-${index}`}>
          <div className="resume-entry-head">
            <div>{entry.title ? <span className="resume-entry-role">{entry.title}</span> : null}</div>
            {entry.meta ? <div className="resume-entry-meta">{entry.meta}</div> : null}
          </div>
          {entry.subtitle ? <div className="resume-entry-sub">{entry.subtitle}</div> : null}
          {bulletsFrom(entry.details).length ? (
            <ul className="resume-bullets">
              {bulletsFrom(entry.details).map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}
