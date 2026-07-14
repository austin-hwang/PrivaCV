"use client";

import { useState } from "react";
import { ChevronRight, ClipboardPaste, FileJson, FileText, History, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RESUME_TEMPLATES, type ResumeTemplateId } from "@/lib/resume";
import { cn } from "@/lib/utils";

type StartPanelProps = {
  isImporting: boolean;
  storageIssue: boolean;
  onImportFile: () => void;
  onImportText: () => void;
  onLoadSample: () => void;
  onOpenJson: () => void;
  onOpenCheckpointBackup: () => void;
  onStartBlank: (template?: ResumeTemplateId) => void;
  onChooseTemplate: (template: ResumeTemplateId) => void;
};

export function StartPanel({
  isImporting,
  storageIssue,
  onImportFile,
  onImportText,
  onLoadSample,
  onOpenJson,
  onOpenCheckpointBackup,
  onStartBlank,
  onChooseTemplate,
}: StartPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <Card className="mb-6">
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Path 1 — bring an existing resume in and review it. */}
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
            <div>
              <p className="text-sm font-semibold">I have a resume</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Import and review each field.
              </p>
            </div>
            <div className="mt-auto grid gap-2">
              <Button type="button" className="justify-start" onClick={onImportText}>
                <ClipboardPaste /> Paste resume text
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label="Import a file"
                className="justify-start"
                onClick={onImportFile}
                disabled={isImporting}
              >
                <Upload /> {isImporting ? "Importing…" : "Import a file (PDF or Word)"}
              </Button>
            </div>
          </div>

          {/* Path 2 — begin from an empty, ATS-readable draft. */}
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
            <div>
              <p className="text-sm font-semibold">Start fresh</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Begin from a blank, ATS-ready draft.
              </p>
            </div>
            <Button type="button" variant="secondary" className="mt-auto justify-start" onClick={() => onStartBlank()}>
              <FileText /> Start a blank resume
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", moreOpen && "rotate-90")} />
            More options
            <span className="text-xs font-normal text-muted-foreground">Sample, saved JSON, backup, layouts</span>
          </button>

          {moreOpen ? (
            <div className="space-y-4 border-t px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onLoadSample}>
                  <FileText /> Load a sample
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenJson}>
                  <FileJson /> Open saved JSON
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenCheckpointBackup}>
                  <History /> Open checkpoint backup
                </Button>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Start blank with a layout
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {RESUME_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      aria-label={`Start blank with ${template.label} template`}
                      className="rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onChooseTemplate(template.id)}
                    >
                      <span className="block text-sm font-semibold">{template.label}</span>
                      <span className="mt-1 block text-xs leading-snug text-muted-foreground">{template.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Privacy and export benefits">
          <Badge variant="secondary">No account</Badge>
          <Badge variant={storageIssue ? "outline" : "secondary"} className={storageIssue ? "border-warning/40 bg-warning/10 text-foreground" : undefined}>
            {storageIssue ? "Autosave unavailable" : "Local autosave"}
          </Badge>
          <Badge variant="secondary">Free PDF export</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
