"use client";

import { useState } from "react";
import { Button as ButtonPrimitive } from "react-aria-components";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      <CardHeader className="sr-only">
        <CardTitle>Start your resume</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
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
                isDisabled={isImporting}
              >
                <Upload data-icon="inline-start" />{" "}
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
                <ClipboardPaste data-icon="inline-start" />{" "}
                <span className="min-w-0">Paste resume text</span>
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
            <DropdownMenuTrigger
              onOpenChange={(open) => {
                if (!open) onPreviewBlank(null);
              }}
            >
              <Button
                type="button"
                variant="secondary"
                className="mt-auto h-auto min-h-9 w-full justify-start border border-input whitespace-normal text-left"
              >
                <FileText data-icon="inline-start" />{" "}
                <span className="min-w-0">Start a blank resume</span>{" "}
                <ChevronDown data-icon="inline-end" className="ml-auto shrink-0" />
              </Button>
              <DropdownMenu className="min-w-64">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Choose a layout</DropdownMenuLabel>
                  {RESUME_TEMPLATES.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      className="items-start"
                      onHoverStart={() => onPreviewBlank(template.id)}
                      onAction={() => onStartBlank(template.id)}
                    >
                      <span>
                        <span className="block">{template.label}</span>
                        <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">
                          {template.description}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenu>
            </DropdownMenuTrigger>
            <p className="text-xs leading-snug text-muted-foreground">
              You can change the layout and theme later from Design.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20">
          <ButtonPrimitive
            aria-expanded={moreOpen}
            onPress={() => setMoreOpen((open) => !open)}
            className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              data-icon="inline-start"
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
          </ButtonPrimitive>

          {moreOpen ? (
            <div className="flex flex-col gap-4 border-t px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onLoadSample}>
                  <FileText data-icon="inline-start" /> Load a sample
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenJson}>
                  <FileJson data-icon="inline-start" /> Open saved JSON
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onOpenCheckpointBackup}>
                  <History data-icon="inline-start" /> Open checkpoint backup
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Privacy and export benefits">
          <Badge variant="secondary">No account</Badge>
          <Badge variant={storageIssue ? "outline" : "secondary"}>
            {storageIssue ? "Autosave unavailable" : "Local autosave"}
          </Badge>
          <Badge variant="secondary">Free PDF export</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
