"use client";

import { Download, History, Save, Trash2, Undo2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResumePreview } from "@/components/resume-editor/resume-preview";
import {
  formatCheckpointTime,
  versionHeadline,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

const THUMBNAIL_SCALE = 0.22;
const LETTER_WIDTH = 8.5 * 96;
const LETTER_HEIGHT = 11 * 96;

function VersionThumbnail({ item }: { item: VersionHistoryItem }) {
  return (
    <div
      aria-hidden="true"
      data-version-thumbnail
      className="relative h-[232px] overflow-hidden rounded-md border bg-muted/50 shadow-inner"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-0 origin-top"
        style={{
          width: `${LETTER_WIDTH}px`,
          height: `${LETTER_HEIGHT}px`,
          transform: `translateX(-50%) scale(${THUMBNAIL_SCALE})`,
        }}
      >
        <ResumePreview state={item.state} />
      </div>
    </div>
  );
}

/**
 * Checkpoints are decisions, not just timestamps. This dedicated workspace
 * keeps the current editor calm while letting people visually recognize each
 * saved resume before they compare, restore, or delete it.
 */
export function VersionHistoryCard({
  open,
  onOpenChange,
  hasContent,
  versions,
  currentFingerprint,
  deletedVersion,
  onSave,
  onSaveBackup,
  onOpenBackup,
  onRestore,
  onDelete,
  onUndoDelete,
  onDismissDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasContent: boolean;
  versions: VersionHistoryItem[];
  currentFingerprint: string;
  deletedVersion: VersionHistoryItem | null;
  onSave: () => void;
  onSaveBackup: () => void;
  onOpenBackup: () => void;
  onRestore: (item: VersionHistoryItem) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onDismissDeleted: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(900px,calc(100dvh-2rem))] max-w-6xl flex-col gap-0 overflow-hidden p-0" aria-describedby="version-history-description">
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Version history</p>
          <DialogTitle>See each saved resume before changing course.</DialogTitle>
          <DialogDescription id="version-history-description">
            Browser-only checkpoints. Each card shows the first page as it will read, so labels are not your only clue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3">
          <p className="text-sm text-muted-foreground">
            {versions.length} {versions.length === 1 ? "checkpoint" : "checkpoints"} saved
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onSave} disabled={!hasContent}>
              <Save /> Save current version
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onOpenBackup}>
              <Upload /> Open backup
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onSaveBackup} disabled={!versions.length}>
              <Download /> Back up
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {deletedVersion ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-500/40 dark:bg-amber-950/40">
              <p className="min-w-0 truncate text-sm text-amber-950 dark:text-amber-100">Deleted “{deletedVersion.label}”.</p>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onUndoDelete}>
                  <Undo2 /> Undo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onDismissDeleted}>Dismiss</Button>
              </div>
            </div>
          ) : null}

          {versions.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {versions.map((item) => {
                const isCurrent = item.fingerprint === currentFingerprint;
                return (
                  <li key={item.id} className="rounded-lg border bg-card p-3 shadow-sm">
                    <VersionThumbnail item={item} />
                    <div className="mt-3 flex items-start gap-2">
                      <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.label}</p>
                          {isCurrent ? <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">Current</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatCheckpointTime(item.savedAt)} · {versionHeadline(item.state)}</p>
                        {item.note ? <p className="mt-1 max-h-9 overflow-hidden text-xs leading-snug text-muted-foreground">{item.note}</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onRestore(item)}>
                        <Undo2 /> Restore
                      </Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${item.label}`} onClick={() => onDelete(item.id)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <div>
                <History className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-semibold">No saved versions yet</p>
                <p className="mt-1 max-w-sm text-sm leading-snug text-muted-foreground">Save a checkpoint before a meaningful rewrite so you can see and restore the earlier resume later.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
