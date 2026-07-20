"use client";

import { ClipboardCheck, ClipboardCopy, Cpu, MessageSquarePlus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { useResumeEditor } from "@/hooks/use-resume-editor";

export function ReviewDrawer({
  editor,
  open,
  onOpenChange,
  onOpenChecksReview,
  onOpenApplicationCopy,
  onOpenLocalAI,
  localAIEnabled,
  onOpenNavigator,
  feedbackUrl,
}: {
  editor: ReturnType<typeof useResumeEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChecksReview: () => void;
  onOpenApplicationCopy: () => void;
  onOpenLocalAI: () => void;
  localAIEnabled: boolean;
  onOpenNavigator: () => void;
  feedbackUrl: string | null;
}) {
  const { checks, hasContent, passedChecks } = editor;

  const checksReady = passedChecks === checks.length;
  const suggestedChecks = checks.filter((check) => !check.ok || check.advisory);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent id="tools-panel" aria-describedby={undefined} className="top-[120px] overflow-y-auto border-t lg:top-[61px]">
        <SheetHeader>
          <SheetTitle>Tools</SheetTitle>
          <SheetDescription>Review your resume and open browser tools.</SheetDescription>
        </SheetHeader>

        <div className="px-4 py-5">
          <section aria-label="Tools">
            <div className="grid gap-2">
              {hasContent ? (
                <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" onClick={onOpenChecksReview}>
                  <ClipboardCheck className={checksReady ? "text-success" : "text-warning"} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Resume Review</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {checksReady
                        ? "Ready to export. Review all resume checks."
                        : `${suggestedChecks.length} ${suggestedChecks.length === 1 ? "suggestion" : "suggestions"} to review.`}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {passedChecks}/{checks.length}
                  </Badge>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 whitespace-normal py-3 text-left"
                onClick={onOpenApplicationCopy}
                disabled={!hasContent}
              >
                <ClipboardCopy />
                <span>
                  <span className="block text-sm font-semibold">Copy for applications</span>
                  <span className="block text-xs font-normal text-muted-foreground">Copy individual fields for application forms.</span>
                </span>
              </Button>
              {localAIEnabled ? (
                <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" onClick={onOpenLocalAI}>
                  <Cpu className="text-violet-600 dark:text-violet-300" />
                  <span>
                    <span className="block text-sm font-semibold">Local AI</span>
                    <span className="block text-xs font-normal text-muted-foreground">Download or manage private on-device models.</span>
                  </span>
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" onClick={onOpenNavigator}>
                <Search />
                <span>
                  <span className="block text-sm font-semibold">Navigate resume</span>
                  <span className="block text-xs font-normal text-muted-foreground">Jump directly to any field with Cmd or Ctrl + K.</span>
                </span>
              </Button>
              {feedbackUrl ? (
                <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" asChild>
                  <a href={feedbackUrl} target="_blank" rel="noreferrer">
                    <MessageSquarePlus />
                    <span>
                      <span className="block text-sm font-semibold">Feedback</span>
                      <span className="block text-xs font-normal text-muted-foreground">Share feedback or vote on features.</span>
                    </span>
                  </a>
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
