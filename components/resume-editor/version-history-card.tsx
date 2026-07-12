"use client";

import { Download, Eye, GitBranch, History, Save, Target, Trash2, Undo2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  exportChangeSummary,
  plainTextStats,
  resumePlainText,
  type ResumeState,
} from "@/lib/resume";
import {
  MAX_VERSION_HISTORY,
  compactDetail,
  formatCheckpointTime,
  roleContextFingerprint,
  versionContentBadges,
  versionHeadline,
  type VersionHistoryItem,
} from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

export function VersionHistoryCard({
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
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="flex-col gap-3 space-y-0 p-0">
        <div>
          <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em]">Version history</CardDescription>
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
      <CardContent className="space-y-2 p-0 pt-4">
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
                  : `${remainingSlots} ${remainingSlots === 1 ? "slot" : "slots"} left before PrivaCV starts replacing the oldest checkpoint.`}
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
