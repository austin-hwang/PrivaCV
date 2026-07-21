"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, History, Save, Search, Trash2, Undo2, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  formatCheckpointTime,
  isAutomaticCheckpointId,
  versionHeadline,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

/** A compact, in-workspace timeline for the resume currently being edited. */
export function VersionHistoryCard({
  open,
  onOpenChange,
  hasContent,
  versions,
  current,
  autosave,
  currentFingerprint,
  storageIssue,
  deletedVersion,
  onSave,
  onSaveBackup,
  onOpenBackup,
  onClear,
  onRestore,
  onDelete,
  onUndoDelete,
  onDismissDeleted,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasContent: boolean;
  versions: VersionHistoryItem[];
  current: VersionHistoryItem;
  autosave: VersionHistoryItem | null;
  currentFingerprint: string;
  storageIssue: boolean;
  deletedVersion: VersionHistoryItem | null;
  onSave: () => void;
  onSaveBackup: () => void;
  onOpenBackup: () => void;
  onClear: () => void;
  onRestore: (item: VersionHistoryItem) => void;
  onDelete: (id: string) => void;
  onUndoDelete: () => void;
  onDismissDeleted: () => void;
  onPreview: (item: VersionHistoryItem | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const allVersions = useMemo(
    () => [
      current,
      ...(autosave && autosave.fingerprint !== current.fingerprint ? [autosave] : []),
      ...versions,
    ],
    [autosave, current, versions],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
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
  const clampedIndex = Math.min(selectedIndex, Math.max(0, allVersions.length - 1));
  const selectedVersion = allVersions[clampedIndex] ?? null;
  const selectedIsNow = selectedVersion?.id === "current-draft";
  const selectedMatchesCurrent =
    selectedIsNow || selectedVersion?.fingerprint === currentFingerprint;
  const selectedIsLivePoint =
    selectedVersion?.id === "current-draft" || selectedVersion?.id === "autosave-copy";

  useEffect(() => {
    if (selectedIndex > allVersions.length - 1)
      setSelectedIndex(Math.max(0, allVersions.length - 1));
  }, [allVersions.length, selectedIndex]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
      onPreview(null);
    }
  }, [onPreview, open]);

  if (!open) return null;

  const selectVersion = (item: VersionHistoryItem) => {
    const index = allVersions.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) {
      setSelectedIndex(index);
      onPreview(item.id === "current-draft" ? null : item);
    }
  };

  const cancelPreview = () => {
    setSelectedIndex(0);
    onPreview(null);
  };

  const confirmRestore = () => {
    if (!selectedVersion || selectedMatchesCurrent) return;
    onRestore(selectedVersion);
    cancelPreview();
  };

  const deleteSelected = () => {
    if (!selectedVersion || selectedIsLivePoint) return;
    onDelete(selectedVersion.id);
    cancelPreview();
  };

  return (
    <aside
      id="edit-history-panel"
      role="region"
      aria-labelledby="edit-history-title"
      data-print-exclude=""
      className="app-chrome w-full shrink-0 overflow-hidden rounded-lg border bg-card shadow-xs lg:sticky lg:top-0 lg:max-h-[calc(100vh-8rem)] lg:w-64"
    >
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <h2 id="edit-history-title" className="truncate text-sm font-semibold">
            Edit history
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {versions.length} {versions.length === 1 ? "checkpoint" : "checkpoints"} for this resume
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="size-8"
          aria-label="Close edit history"
          onClick={() => {
            cancelPreview();
            onOpenChange(false);
          }}
        >
          <X data-icon="inline-start" />
        </Button>
      </div>

      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto p-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
          <Button
            type="button"
            size="sm"
            className="min-w-0"
            onClick={onSave}
            isDisabled={!hasContent}
            aria-label="Save current version checkpoint"
          >
            <Save data-icon="inline-start" /> <span className="truncate">Checkpoint</span>
          </Button>
          <TooltipTrigger>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Open checkpoint backup"
              onClick={onOpenBackup}
            >
              <Upload data-icon="inline-start" />
            </Button>
            <Tooltip>Open checkpoint backup</Tooltip>
          </TooltipTrigger>
          <TooltipTrigger>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Back up checkpoints"
              onClick={onSaveBackup}
              isDisabled={!versions.length}
            >
              <Download data-icon="inline-start" />
            </Button>
            <Tooltip>Back up checkpoints</Tooltip>
          </TooltipTrigger>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 w-full"
          onClick={onClear}
          isDisabled={!versions.length}
        >
          <Trash2 data-icon="inline-start" /> Clear checkpoints
        </Button>

        {storageIssue ? (
          <Alert variant="warning" className="mt-3">
            <AlertTitle>Browser storage is unavailable</AlertTitle>
            <AlertDescription>
              <p>Checkpoints shown here may not survive a refresh.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={onSaveBackup}
                isDisabled={!versions.length}
              >
                <Download data-icon="inline-start" /> Back up now
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {allVersions.length ? (
          <>
            <Field className="mt-3">
              <FieldLabel className="sr-only" htmlFor="version-history-search">
                Find a checkpoint
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  id="version-history-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a checkpoint"
                  className="text-xs"
                />
                {query ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label="Clear version search"
                      onClick={() => setQuery("")}
                    >
                      <X data-icon="inline-start" />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
            </Field>
            <p className="mt-1.5 text-[10px] text-muted-foreground" aria-live="polite">
              {visibleVersions.length === allVersions.length
                ? "Showing all checkpoints"
                : `Showing ${visibleVersions.length} of ${allVersions.length}`}
            </p>

            <div className="mt-3 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
              <Field className="flex min-h-56 flex-col items-center rounded-md border bg-muted/20 py-2">
                <FieldLabel className="sr-only" htmlFor="version-history-slider">
                  Move through edit history
                </FieldLabel>
                <span
                  className="text-center text-[9px] font-medium text-muted-foreground"
                  aria-hidden="true"
                >
                  Now
                </span>
                <Slider
                  id="version-history-slider"
                  orientation="vertical"
                  aria-label="Move through edit history"
                  minValue={0}
                  // A min===max range renders its thumb ambiguously (not
                  // pinned to either end) in some browsers, so keep the
                  // track non-degenerate even with nothing to scrub through.
                  maxValue={Math.max(1, allVersions.length - 1)}
                  value={Math.max(0, allVersions.length - 1 - clampedIndex)}
                  isDisabled={allVersions.length < 2}
                  thumbValueText={
                    selectedVersion
                      ? `${selectedVersion.label}, ${formatCheckpointTime(selectedVersion.savedAt)}`
                      : undefined
                  }
                  onChange={(value) => {
                    const raw = Array.isArray(value) ? value[0] : value;
                    const nextIndex = Math.max(0, allVersions.length - 1 - Number(raw));
                    setSelectedIndex(nextIndex);
                    const item = allVersions[nextIndex] ?? null;
                    onPreview(item?.id === "current-draft" ? null : item);
                  }}
                  className="my-2 h-44 flex-1 cursor-ns-resize"
                />
                <span
                  className="text-center text-[9px] font-medium text-muted-foreground"
                  aria-hidden="true"
                >
                  Older
                </span>
              </Field>

              <ol
                className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1"
                aria-label="Checkpoint timeline"
              >
                {visibleVersions.map((item) => {
                  const index = allVersions.findIndex((candidate) => candidate.id === item.id);
                  const selected = index === clampedIndex;
                  const isCurrentDraft = item.id === "current-draft";
                  const isAutosave =
                    item.id === "autosave-copy" || item.id.startsWith("autosave-slot-");
                  const isAutomatic = isAutomaticCheckpointId(item.id);
                  return (
                    <li
                      key={item.id}
                      className="relative pl-3 before:absolute before:-bottom-2 before:left-[3px] before:top-3 before:w-px before:bg-border last:before:hidden"
                    >
                      <span
                        className={cn(
                          "absolute left-0 top-3 size-2 rounded-full border bg-background",
                          selected && "border-primary bg-primary",
                        )}
                        aria-hidden="true"
                      />
                      <Toggle
                        aria-label={`Select ${item.label}`}
                        isSelected={selected}
                        onChange={() => selectVersion(item)}
                        variant="subtle"
                        className="h-auto w-full items-start justify-start whitespace-normal px-2 py-1.5 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{item.label}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {formatCheckpointTime(item.savedAt)}
                          </span>
                          {item.note ? (
                            <span className="mt-1 block max-h-7 overflow-hidden text-[10px] leading-snug text-muted-foreground">
                              {item.note}
                            </span>
                          ) : null}
                          {isCurrentDraft ? (
                            <span className="mt-1 block text-[9px] font-medium uppercase tracking-wide text-primary">
                              Live draft
                            </span>
                          ) : null}
                          {!isCurrentDraft && isAutosave ? (
                            <span className="mt-1 block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                              Autosaved
                            </span>
                          ) : null}
                          {!isCurrentDraft && !isAutosave && isAutomatic ? (
                            <span className="mt-1 block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                              Automatic
                            </span>
                          ) : null}
                        </span>
                      </Toggle>
                    </li>
                  );
                })}
              </ol>
            </div>

            {visibleVersions.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed bg-muted/20 p-3 text-center">
                <p className="text-xs font-medium">No checkpoints match “{query.trim()}”</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </Button>
              </div>
            ) : null}

            {selectedVersion ? (
              <div data-history-selection className="mt-3 rounded-md border bg-background p-3">
                {!selectedIsNow ? (
                  <p className="mb-2 rounded-sm bg-brand/10 px-2 py-1.5 text-[10px] font-medium leading-snug text-brand">
                    Previewing this point. Your current draft is unchanged until you confirm.
                  </p>
                ) : null}
                <div className="flex items-start gap-2">
                  <History
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-xs font-semibold">{selectedVersion.label}</p>
                      {selectedVersion.id === "current-draft" ? (
                        <Badge variant="outline" className="h-4 px-1 text-[8px]">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      {versionHeadline(selectedVersion.state)}
                    </p>
                    {selectedVersion.note ? (
                      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                        {selectedVersion.note}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    className="min-w-0"
                    isDisabled={selectedMatchesCurrent}
                    onClick={confirmRestore}
                  >
                    <Undo2 data-icon="inline-start" />{" "}
                    <span className="truncate">Confirm restore</span>
                  </Button>
                  {!selectedIsNow ? (
                    <Button type="button" variant="outline" size="sm" onClick={cancelPreview}>
                      Cancel
                    </Button>
                  ) : null}
                  {!selectedIsLivePoint ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="size-8"
                      aria-label={`Delete ${selectedVersion.label}`}
                      onClick={deleteSelected}
                    >
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <Empty className="mt-3 min-h-40">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>No checkpoints yet</EmptyTitle>
              <EmptyDescription>Save a checkpoint to restore this resume later.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {deletedVersion ? (
          <Alert variant="warning" className="mt-3">
            <AlertTitle>Checkpoint deleted</AlertTitle>
            <AlertDescription>
              <p className="truncate">Deleted “{deletedVersion.label}”.</p>
              <div className="mt-2 flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={onUndoDelete}>
                  <Undo2 data-icon="inline-start" /> Undo
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onDismissDeleted}>
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}
      </div>
    </aside>
  );
}
