"use client";

import { ArrowRight, Check, FileCheck2, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChangeSummaryGrid } from "@/components/resume-editor/version-changes";
import type { useResumeEditor } from "@/hooks/use-resume-editor";
import { formatCheckpointTime } from "@/lib/resume-workspace";
import { cn } from "@/lib/utils";

const JUMP_TARGETS = [
  { id: "tool-checks", label: "Checks" },
];

export function ReviewDrawer({
  editor,
  open,
  onOpenChange,
  onFocusTarget,
  onStartChecksReview,
}: {
  editor: ReturnType<typeof useResumeEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusTarget: (targetId: string) => void;
  onStartChecksReview: () => void;
}) {
  const {
    checks,
    passedChecks,
    exportCheckpoint,
    exportIsCurrent,
    exportChanges,
    requestExport,
  } = editor;

  const checksReady = passedChecks === checks.length;
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent aria-describedby={undefined} className="top-[120px] lg:top-[73px]">
        <SheetHeader>
          <SheetTitle>Review tools</SheetTitle>
          <SheetDescription>Keep editing on the left; everything here updates live as you type.</SheetDescription>
        </SheetHeader>

        <div className="flex gap-1.5 border-b px-4 py-2.5">
          {JUMP_TARGETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jump(item.id)}
              className="rounded-full border border-transparent bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-4 py-5">
          <section id="tool-checks" aria-label="Resume check" className="scroll-mt-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resume Check</p>
                <p className="text-base font-semibold">{checksReady ? "Ready to export" : "Needs attention"}</p>
              </div>
              <Badge variant="outline" className="tabular-nums">
                {passedChecks}/{checks.length}
              </Badge>
            </div>
            {checks.length ? (
              <Button type="button" variant="outline" size="sm" className="mb-3 w-full" onClick={onStartChecksReview}>
                <ArrowRight /> Walk through checks
              </Button>
            ) : null}
            <div className="grid gap-2">
              {checks.map((check) => (
                <div key={check.id} className="flex gap-2.5 rounded-lg border bg-muted/30 p-3">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                      check.advisory ? "bg-sky-600" : check.ok ? "bg-emerald-600" : "bg-amber-600",
                    )}
                  >
                    {check.advisory ? "i" : check.ok ? <Check className="size-3" /> : "!"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{check.label}</p>
                    <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                    {!check.ok || check.advisory ? (
                      <>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 h-7 px-2"
                          onClick={() => onFocusTarget(check.targetId)}
                        >
                          <ArrowRight /> {check.actionLabel}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {exportCheckpoint ? (
              <div
                className={cn(
                  "mt-3 rounded-lg border p-3",
                  exportIsCurrent ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-950/40" : "border-indigo-200 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-950/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background",
                      exportIsCurrent ? "border-emerald-200 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-300" : "border-indigo-200 text-indigo-700 dark:border-indigo-500/50 dark:text-indigo-300",
                    )}
                  >
                    {exportIsCurrent ? <FileCheck2 className="size-4" /> : <History className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Last export</p>
                    <p className="text-sm font-semibold">
                      {exportIsCurrent ? "Current resume matches your last PDF export." : "This resume changed since your last PDF export."}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                      Last opened print on {formatCheckpointTime(exportCheckpoint.exportedAt)} with {exportCheckpoint.pageCount}{" "}
                      {exportCheckpoint.pageCount === 1 ? "page" : "pages"} and{" "}
                      {exportCheckpoint.issueCount === 0
                        ? "no unresolved checks"
                        : `${exportCheckpoint.issueCount} unresolved ${exportCheckpoint.issueCount === 1 ? "item" : "items"}`}
                      .
                    </p>
                    {!exportIsCurrent ? (
                      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={requestExport}>
                        <FileCheck2 /> Export updated PDF
                      </Button>
                    ) : null}
                  </div>
                </div>
                {!exportIsCurrent && exportChanges.length ? (
                  <div className="mt-3">
                    <ChangeSummaryGrid
                      changes={exportChanges}
                      beforeLabel="Before"
                      afterLabel="Now"
                      onSelect={(change) => onFocusTarget(change.targetId)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

        </div>

        <p className="border-t px-4 py-3 text-xs leading-snug text-muted-foreground">Everything here stays in this browser.</p>
      </SheetContent>
    </Sheet>
  );
}
