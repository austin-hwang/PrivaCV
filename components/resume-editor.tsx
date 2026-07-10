"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ClipboardCopy,
  Download,
  Eye,
  FileCheck2,
  FileJson,
  FileText,
  History,
  Printer,
  RotateCcw,
  Undo2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntryList, FieldGroup, TextAreaField, TextField } from "@/components/resume-editor/editor-fields";
import { ResumeEditorOverlays } from "@/components/resume-editor/resume-editor-overlays";
import { ResumePreview } from "@/components/resume-editor/resume-preview";
import { RoleFocusCard } from "@/components/resume-editor/role-focus-card";
import {
  ChangeSummaryGrid,
  RestoredVersionCard,
} from "@/components/resume-editor/version-changes";
import { VersionHistoryCard } from "@/components/resume-editor/version-history-card";
import { useResumeEditor } from "@/hooks/use-resume-editor";
import {
  clampTextScale,
  MAX_TEXT_SCALE,
  MIN_TEXT_SCALE,
  SECTION_LABELS,
} from "@/lib/resume";
import { formatCheckpointTime } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

export function ResumeEditor() {
  const editor = useResumeEditor();
  const {
    addEntry,
    checks,
    clearResume,
    deleteVersion,
    deletedVersion,
    dismissRecoveryPoint,
    dismissRestoredVersionSummary,
    exportChanges,
    exportCheckpoint,
    exportFingerprint,
    exportIsCurrent,
    focusCheckTarget,
    hasContent,
    historyBackupInputRef,
    importReview,
    importReviewTargets,
    isImporting,
    jobDescription,
    jsonInputRef,
    loadSample,
    moveEntry,
    moveSection,
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
    saveVersionHistoryBackup,
    setDeletedVersion,
    setImportReview,
    setJobDescription,
    setRoleLabel,
    setTextReviewOpen,
    setVersionCompareTarget,
    state,
    undoDeleteVersion,
    updateEntry,
    updateField,
    versionHistory,
    visibleRestoredVersionSummary,
  } = editor;

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

      <ResumeEditorOverlays editor={editor} />
    </>
  );
}
