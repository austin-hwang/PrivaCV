"use client";

import { ClipboardPaste, FileJson, FileText, History, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StartPanelProps = {
  isImporting: boolean;
  onImportPdf: () => void;
  onImportText: () => void;
  onLoadSample: () => void;
  onOpenJson: () => void;
  onOpenCheckpointBackup: () => void;
};

export function StartPanel({
  isImporting,
  onImportPdf,
  onImportText,
  onLoadSample,
  onOpenJson,
  onOpenCheckpointBackup,
}: StartPanelProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardDescription className="font-semibold uppercase tracking-[0.16em]">Private resume workspace</CardDescription>
        <CardTitle className="text-2xl">Start from the resume you already have.</CardTitle>
        <CardDescription>
          Choose the route that best matches your source. You will review every imported field before you export.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="group rounded-lg border-2 border-primary bg-primary p-4 text-left text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={onImportText}
          >
            <span className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15">
                <ClipboardPaste className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">Paste resume text</span>
                <span className="mt-1 block text-sm leading-snug text-primary-foreground/85">
                  Best for copied documents, LinkedIn, and OCR&apos;d scanned PDFs.
                </span>
              </span>
            </span>
          </button>
          <button
            type="button"
            className="group rounded-lg border bg-background p-4 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            onClick={onImportPdf}
            disabled={isImporting}
          >
            <span className="flex items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <Upload className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{isImporting ? "Importing PDF" : "Import a PDF"}</span>
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                  Best for a PDF with selectable text. Scanned PDFs need OCR text first.
                </span>
              </span>
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Already saved work?</span>
          <Button type="button" variant="outline" size="sm" onClick={onOpenJson}>
            <FileJson /> Open JSON
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenCheckpointBackup}>
            <History /> Open checkpoint backup
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/50 p-3">
          <p className="text-xs leading-snug text-muted-foreground">
            Want to explore first? Load a sample resume and edit it locally.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={onLoadSample}>
            <FileText /> Use sample
          </Button>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Privacy and export benefits">
          {["No account", "Local autosave", "Free PDF export"].map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
