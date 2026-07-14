"use client";

import { useMemo, useState } from "react";
import { Download, History, Save, Search, Trash2, Undo2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  autosave,
  currentFingerprint,
  storageIssue,
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
  autosave: VersionHistoryItem | null;
  currentFingerprint: string;
  storageIssue: boolean;
  deletedVersion: VersionHistoryItem | null;
  onSave: () => void;
  onSaveBackup: () => void;
  onOpenBackup: () => void;
  onRestore: (item: VersionHistoryItem) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onDismissDeleted: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const allVersions = useMemo(() => autosave ? [autosave, ...versions] : versions, [autosave, versions]);
  const visibleVersions = useMemo(
    () =>
      normalizedQuery
        ? allVersions.filter((item) =>
            [item.label, item.note, item.state.name, item.state.title]
              .filter((value): value is string => Boolean(value))
              .some((value) => value.toLocaleLowerCase().includes(normalizedQuery)),
          )
        : allVersions,
    [allVersions, normalizedQuery],
  );
  const showingFilteredVersions = visibleVersions.length !== allVersions.length;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setQuery("");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex h-[min(900px,calc(100dvh-2rem))] max-w-6xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-5 pr-12">
          <DialogTitle>Version history</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-5 py-3">
          <p className="text-sm text-muted-foreground">
            <span>{versions.length} {versions.length === 1 ? "checkpoint" : "checkpoints"} saved</span>
            {autosave ? <span> · Autosave copy available</span> : null}
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

        {storageIssue ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/40 bg-warning/10 px-5 py-3 text-sm text-foreground">
            <p>Browser storage is unavailable. Versions shown here may not survive a refresh.</p>
            <Button type="button" variant="outline" size="sm" className="border-warning/50 bg-background" onClick={onSaveBackup} disabled={!versions.length}>
              <Download /> Back up versions now
            </Button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {allVersions.length ? (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Find a saved version"
                  placeholder="Find by name, note, or resume title"
                  className="pr-9 pl-9"
                />
                {query ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 size-9"
                    aria-label="Clear version search"
                    onClick={() => setQuery("")}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {showingFilteredVersions ? `Showing ${visibleVersions.length} of ${allVersions.length}` : "Showing all saved versions"}
              </p>
            </div>
          ) : null}

          {deletedVersion ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 p-3">
              <p className="min-w-0 truncate text-sm text-foreground">Deleted “{deletedVersion.label}”.</p>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="outline" size="sm" className="bg-background" onClick={onUndoDelete}>
                  <Undo2 /> Undo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onDismissDeleted}>Dismiss</Button>
              </div>
            </div>
          ) : null}

          {visibleVersions.length ? (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {visibleVersions.map((item) => {
                const isAutosave = item.id === "autosave-copy";
                const isCurrent = item.fingerprint === currentFingerprint;
                return (
                  <li key={item.id} className="rounded-lg border bg-card p-3 shadow-sm">
                    <VersionThumbnail item={item} />
                    <div data-version-heading className="mt-3 grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-2">
                      <span data-version-icon className="flex size-5 items-center justify-center" aria-hidden="true">
                        <History className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{item.label}</p>
                          {isAutosave ? <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">Autosaved</Badge> : isCurrent ? <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px]">Current</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatCheckpointTime(item.savedAt)} · {versionHeadline(item.state)}</p>
                        {item.note ? <p className="mt-1 max-h-9 overflow-hidden text-xs leading-snug text-muted-foreground">{item.note}</p> : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onRestore(item)} disabled={isCurrent}>
                        <Undo2 /> {isAutosave ? "Restore autosave" : "Restore"}
                      </Button>
                      {!isAutosave ? (
                        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${item.label}`} onClick={() => onDelete(item.id)}>
                          <Trash2 />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : allVersions.length ? (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <div>
                <Search className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-semibold">No saved versions match “{query.trim()}”</p>
                <p className="mt-1 max-w-sm text-sm leading-snug text-muted-foreground">Search by checkpoint name, note, or resume title.</p>
                <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setQuery("")}>
                  Clear search
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed bg-muted/30 p-6 text-center">
              <div>
                <History className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-semibold">No saved versions yet</p>
                <p className="mt-1 max-w-sm text-sm leading-snug text-muted-foreground">Save a checkpoint to restore this version later.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
