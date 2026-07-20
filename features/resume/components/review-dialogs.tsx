import { AlertCircle, Check, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type ResumeCheck } from "@/lib/resume";
import { cn } from "@/lib/utils";

export type DestructiveResumeAction = "clear" | "clear-checkpoints" | "delete-all";

export function DestructiveResumeDialog({
  action,
  onActionChange,
  onConfirm,
}: {
  action: DestructiveResumeAction | null;
  onActionChange: (action: DestructiveResumeAction | null) => void;
  onConfirm: (action: DestructiveResumeAction) => void;
}) {
  return (
    <Dialog open={action !== null} onOpenChange={(open) => { if (!open) onActionChange(null); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {action === "delete-all"
              ? "Delete all browser data?"
              : action === "clear-checkpoints"
                ? "Clear all checkpoints?"
                : "Clear this resume?"}
          </DialogTitle>
          <DialogDescription>
            {action === "delete-all"
              ? "This removes the resume library, edit history, applications, imported text, Local AI settings, and downloaded model files from this browser. This cannot be undone. Export backups first if you want to keep a copy."
              : action === "clear-checkpoints"
                ? "This removes every saved checkpoint for the current resume. Your live draft and autosave stay intact. This cannot be undone."
                : "This clears every resume field. You can restore the current version from the recovery card."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onActionChange(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (action) onConfirm(action);
            }}
          >
            {action === "delete-all"
              ? "Delete all data"
              : action === "clear-checkpoints"
                ? "Clear checkpoints"
                : "Clear resume"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResumeChecksDialog({
  open,
  checks,
  passedChecks,
  onOpenChange,
  onStartWalkthrough,
}: {
  open: boolean;
  checks: ResumeCheck[];
  passedChecks: number;
  onOpenChange: (open: boolean) => void;
  onStartWalkthrough: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Resume review</DialogTitle>
          <DialogDescription>
            Review every check at a glance, then walk through each one on your resume.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2" aria-label="Resume checks">
          {checks.map((check) => {
            const passed = check.ok && !check.advisory;
            const status = passed ? "Passed" : check.advisory ? "Suggestion" : "Review";
            return (
              <div key={check.id} data-resume-check={check.id} className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                    passed ? "bg-success/15 text-success" : check.advisory ? "bg-brand/10 text-brand" : "bg-warning/20 text-foreground",
                  )}
                  aria-hidden="true"
                >
                  {passed ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{check.label}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{check.detail}</p>
                  {!passed ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{check.guidance}</p> : null}
                </div>
                <Badge variant="outline" className={cn("shrink-0", passed && "border-success/30 text-success", check.advisory && "border-brand/30 text-brand")}>
                  {status}
                </Badge>
              </div>
            );
          })}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{passedChecks} of {checks.length} checks passed</span>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="button" onClick={onStartWalkthrough}>
              <ClipboardCheck /> Start walkthrough
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
