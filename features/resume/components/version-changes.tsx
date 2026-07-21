"use client";

import { ArrowRight, ChevronDown, ChevronUp, History } from "lucide-react";
import { useState } from "react";
import { Button as ButtonPrimitive } from "react-aria-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ExportChange } from "@/lib/resume";
import { CHANGE_PREVIEW_LIMIT } from "@/lib/resume-workspace";
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
      <History className="mt-0.5 size-4 shrink-0 text-brand" />
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
    "group flex min-h-24 gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

  if (onSelect) {
    return (
      <ButtonPrimitive className={cn(className, "hover:border-brand")} onPress={onSelect}>
        {content}
      </ButtonPrimitive>
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
              {showAll
                ? "Collapse the audit trail when you are done reviewing."
                : "Expand the full audit trail before exporting or restoring."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? (
              <ChevronUp data-icon="inline-start" />
            ) : (
              <ChevronDown data-icon="inline-start" />
            )}
            {showAll ? "Show fewer changes" : "Show all changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ChangeFieldLabels({ labels }: { labels?: string[] }) {
  if (!labels?.length) return null;
  const visibleLabels = labels.slice(0, 4);
  const hiddenCount = labels.length - visibleLabels.length;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visibleLabels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className="h-5 max-w-full truncate px-1.5 text-[10px] font-medium normal-case tracking-normal"
        >
          {label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge
          variant="outline"
          className="h-5 px-1.5 text-[10px] font-medium normal-case tracking-normal"
        >
          +{hiddenCount} more
        </Badge>
      ) : null}
    </div>
  );
}
