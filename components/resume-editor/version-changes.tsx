"use client";

import { ArrowRight, Check, ChevronDown, ChevronUp, History, Undo2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ExportChange } from "@/lib/resume";
import { CHANGE_PREVIEW_LIMIT, formatCheckpointTime, type RestoredVersionSummary } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

export function VersionChangeRow({
  change,
  beforeLabel,
  afterLabel,
  onSelect,
}: {
  change: ExportChange;
  beforeLabel: string;
  afterLabel: string;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <History className="mt-0.5 size-4 shrink-0 text-indigo-800 dark:text-indigo-300" />
      <div className="min-w-0">
        <span className="block font-semibold text-foreground">{change.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{change.detail}</span>
        <ChangeFieldLabels labels={change.fieldLabels} />
        {change.before || change.after ? (
          <span className="mt-2 grid gap-1 text-xs leading-snug text-muted-foreground">
            <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
              <span className="font-medium text-foreground">{beforeLabel}</span>
              <span className="truncate">{change.before ?? "Empty"}</span>
            </span>
            <span className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-2">
              <span className="font-medium text-foreground">{afterLabel}</span>
              <span className="truncate">{change.after ?? "Empty"}</span>
            </span>
          </span>
        ) : null}
      </div>
      {onSelect ? (
        <ArrowRight className="ml-auto mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </>
  );

  const className =
    "group flex min-h-24 gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (onSelect) {
    return (
      <button type="button" className={cn(className, "hover:border-indigo-500")} onClick={onSelect}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
export function ChangeSummaryGrid({
  changes,
  beforeLabel,
  afterLabel,
  onSelect,
}: {
  changes: ExportChange[];
  beforeLabel: string;
  afterLabel: string;
  onSelect?: (change: ExportChange) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleChanges = showAll ? changes : changes.slice(0, CHANGE_PREVIEW_LIMIT);
  const hiddenCount = changes.length - visibleChanges.length;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visibleChanges.map((change) => (
        <VersionChangeRow
          key={change.id}
          change={change}
          beforeLabel={beforeLabel}
          afterLabel={afterLabel}
          onSelect={onSelect ? () => onSelect(change) : undefined}
        />
      ))}
      {changes.length > CHANGE_PREVIEW_LIMIT ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed bg-background p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {showAll
                ? `Showing all ${changes.length} changed areas`
                : `${hiddenCount} more changed ${hiddenCount === 1 ? "area" : "areas"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {showAll ? "Collapse the audit trail when you are done reviewing." : "Expand the full audit trail before exporting or restoring."}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowAll((current) => !current)}>
            {showAll ? <ChevronUp /> : <ChevronDown />}
            {showAll ? "Show fewer changes" : "Show all changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RestoredVersionCard({
  summary,
  onDismiss,
  onFocus,
}: {
  summary: RestoredVersionSummary;
  onDismiss: () => void;
  onFocus: (targetId: string) => void;
}) {
  return (
    <Card className="mb-6 border-violet-300 bg-violet-50/70 dark:border-violet-500/40 dark:bg-violet-950/40">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-violet-300 bg-background text-violet-800 dark:border-violet-500/50 dark:text-violet-300">
            <Undo2 className="size-4" />
          </span>
          <div>
            <CardTitle className="text-base">{summary.label}</CardTitle>
            <CardDescription>
              Restored from the version saved {formatCheckpointTime(summary.savedAt)}. Review what changed from the draft
              you were editing.
            </CardDescription>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onDismiss}>
          Dismiss
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        {summary.changes.length ? (
          <ChangeSummaryGrid
            changes={summary.changes}
            beforeLabel="Before"
            afterLabel="Restored"
            onSelect={(change) => onFocus(change.targetId)}
          />
        ) : (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>No differences found</AlertTitle>
            <AlertDescription>This checkpoint already matched the resume you were editing.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function ChangeFieldLabels({ labels }: { labels?: string[] }) {
  if (!labels?.length) return null;
  const visibleLabels = labels.slice(0, 4);
  const hiddenCount = labels.length - visibleLabels.length;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visibleLabels.map((label) => (
        <Badge key={label} variant="secondary" className="h-5 max-w-full truncate px-1.5 text-[10px] font-medium normal-case tracking-normal">
          {label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium normal-case tracking-normal">
          +{hiddenCount} more
        </Badge>
      ) : null}
    </div>
  );
}
