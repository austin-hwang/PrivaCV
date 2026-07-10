"use client";

import { Check, FileSearch, History, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MobileReviewTool = "import-review" | "versions" | "role-focus" | "checks";

export function MobileReviewTools({
  activeTool,
  passedChecks,
  totalChecks,
  hasRoleFocus,
  importReview,
  versionCount,
  onChange,
}: {
  activeTool: MobileReviewTool | null;
  passedChecks: number;
  totalChecks: number;
  hasRoleFocus: boolean;
  importReview: { reviewedCount: number; itemCount: number } | null;
  versionCount: number;
  onChange: (tool: MobileReviewTool | null) => void;
}) {
  const toggle = (tool: MobileReviewTool) => onChange(activeTool === tool ? null : tool);

  return (
    <section className="mb-5 lg:hidden" aria-label="Resume review tools">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Review tools</p>
      <div className={cn("grid gap-2", importReview ? "grid-cols-2" : "grid-cols-3")}>
        {importReview ? (
          <Button
            type="button"
            variant={activeTool === "import-review" ? "secondary" : "outline"}
            size="sm"
            className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-[11px] leading-tight"
            aria-pressed={activeTool === "import-review"}
            aria-controls="import-review-panel"
            onClick={() => toggle("import-review")}
          >
            <FileSearch className="size-3.5 text-amber-800" />
            <span>Import · {importReview.reviewedCount}/{importReview.itemCount}</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant={activeTool === "checks" ? "secondary" : "outline"}
          size="sm"
          className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-[11px] leading-tight"
          aria-pressed={activeTool === "checks"}
          aria-controls="resume-check-panel"
          onClick={() => toggle("checks")}
        >
          <Check className={cn("size-3.5", passedChecks === totalChecks && "text-emerald-700")} />
          <span>Check · {passedChecks}/{totalChecks}</span>
        </Button>
        <Button
          type="button"
          variant={activeTool === "role-focus" ? "secondary" : "outline"}
          size="sm"
          className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-[11px] leading-tight"
          aria-pressed={activeTool === "role-focus"}
          aria-controls="role-focus-panel"
          onClick={() => toggle("role-focus")}
        >
          <Target className={cn("size-3.5", hasRoleFocus && "text-sky-800")} />
          <span>{hasRoleFocus ? "Role focus set" : "Role focus"}</span>
        </Button>
        <Button
          type="button"
          variant={activeTool === "versions" ? "secondary" : "outline"}
          size="sm"
          className="h-auto min-h-14 flex-col gap-1 px-2 py-2 text-[11px] leading-tight"
          aria-pressed={activeTool === "versions"}
          aria-controls="version-history-panel"
          onClick={() => toggle("versions")}
        >
          <History className="size-3.5" />
          <span>{versionCount ? `${versionCount} saved` : "Versions"}</span>
        </Button>
      </div>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">Keep editing moving; open guidance only when you need it.</p>
    </section>
  );
}
