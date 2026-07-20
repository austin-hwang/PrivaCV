"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  FileJson,
  FileText,
  History,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";
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
  onPreviewBlank: (template: ResumeTemplateId | null) => void;
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
  onPreviewBlank,
}: StartPanelProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <Card className="mb-6">
      <CardContent className="space-y-4 pt-6">
        <div data-start-primary-paths className="editor-pane-grid grid gap-3">
          {/* Path 1 — bring an existing resume in and review it. */}
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4">
            <div>
              <p className="text-sm font-semibold">I have a resume</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Import and review each field.
              </p>
            </div>
            <div className="mt-auto grid gap-2">
              <Button
                type="button"
                className="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                onClick={onImportFile}
                disabled={isImporting}
              >
                <Upload />{" "}
                <span className="min-w-0">
                  {isImporting ? "Importing…" : "Import a file (PDF or Word)"}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-9 w-full justify-start whitespace-normal text-left"
                onClick={onImportText}
              >
                <ClipboardPaste /> <span className="min-w-0">Paste resume text</span>
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
            <Menu
              className="mt-auto"
              onOpenChange={(open) => {
                if (!open) onPreviewBlank(null);
              }}
            >
              <MenuTrigger>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-auto min-h-9 w-full justify-start border border-input whitespace-normal text-left"
                >
                  <FileText /> <span className="min-w-0">Start a blank resume</span>{" "}
                  <ChevronDown className="ml-auto shrink-0" />
                </Button>
              </MenuTrigger>
              <MenuContent align="start" className="w-full min-w-64">
                <MenuLabel>Choose a layout</MenuLabel>
                {RESUME_TEMPLATES.map((template) => (
                  <MenuItem
                    key={template.id}
                    className="items-start"
                    onHighlight={() => onPreviewBlank(template.id)}
                    onSelect={() => onStartBlank(template.id)}
                  >
                    <span>
                      <span className="block">{template.label}</span>
                      <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">
                        {template.description}
                      </span>
                    </span>
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
            <p className="text-xs leading-snug text-muted-foreground">
              You can change the layout and theme later from Design.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20">
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                moreOpen && "rotate-90",
              )}
            />
            <span className="editor-pane-more-copy">
              <span>More options</span>
              <span className="text-xs font-normal text-muted-foreground">
                Sample, saved JSON, backup
              </span>
            </span>
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
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Privacy and export benefits">
          <Badge variant="secondary">No account</Badge>
          <Badge
            variant={storageIssue ? "outline" : "secondary"}
            className={storageIssue ? "border-warning/40 bg-warning/10 text-foreground" : undefined}
          >
            {storageIssue ? "Autosave unavailable" : "Local autosave"}
          </Badge>
          <Badge variant="secondary">Free PDF export</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
