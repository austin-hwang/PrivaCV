"use client";

import { Download, Eye, History, Save, Trash2, Undo2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MAX_VERSION_HISTORY,
  formatCheckpointTime,
  versionHeadline,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";

/**
 * A calm timeline of named local snapshots: save one, restore it, compare it
 * against the current resume, or delete it. Backups export/import the whole set
 * as a JSON file. Everything stays in this browser.
 */
export function VersionHistoryCard({
  hasContent,
  versions,
  currentFingerprint,
  deletedVersion,
  onSave,
  onSaveBackup,
  onOpenBackup,
  onCompareCurrent,
  onRestore,
  onDelete,
  onUndoDelete,
  onDismissDeleted,
}: {
  hasContent: boolean;
  versions: VersionHistoryItem[];
  currentFingerprint: string;
  deletedVersion: VersionHistoryItem | null;
  onSave: () => void;
  onSaveBackup: () => void;
  onOpenBackup: () => void;
  onCompareCurrent: (item: VersionHistoryItem) => void;
  onRestore: (item: VersionHistoryItem) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onDismissDeleted: () => void;
}) {
  if (!hasContent && !versions.length && !deletedVersion) return null;

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="flex-col gap-3 space-y-0 p-0">
        <div>
          <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em]">Version history</CardDescription>
          <CardTitle className="text-base">Save a checkpoint before tailoring.</CardTitle>
          <CardDescription>
            Up to {MAX_VERSION_HISTORY} browser-only snapshots · {versions.length} saved.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onSave} disabled={!hasContent}>
            <Save /> Save version
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenBackup}>
            <Upload /> Open backup
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSaveBackup} disabled={!versions.length}>
            <Download /> Back up
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-0 pt-4">
        {deletedVersion ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50/70 p-2.5">
            <p className="min-w-0 truncate text-xs text-amber-950">Deleted “{deletedVersion.label}”.</p>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="outline" size="sm" className="h-7 bg-background" onClick={onUndoDelete}>
                <Undo2 /> Undo
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7" onClick={onDismissDeleted}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}
        {versions.length ? (
          <ul className="space-y-2">
            {versions.map((item) => {
              const isCurrent = item.fingerprint === currentFingerprint;
              return (
                <li key={item.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                    <History className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{item.label}</p>
                      {isCurrent ? (
                        <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">Current</Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatCheckpointTime(item.savedAt)} · {versionHeadline(item.state)}
                    </p>
                    {item.roleLabel ? (
                      <p className="truncate text-xs text-muted-foreground">Role: {item.roleLabel}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Compare ${item.label} with current resume`} onClick={() => onCompareCurrent(item)}>
                      <Eye />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Restore ${item.label}`} onClick={() => onRestore(item)}>
                      <Undo2 />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Delete ${item.label}`} onClick={() => onDelete(item.id)}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
            No saved versions yet. Save one before adapting this resume for a specific job.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
