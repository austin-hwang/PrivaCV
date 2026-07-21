"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, ClipboardCopy, Cpu, MessageSquarePlus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { useResumeEditor } from "@/features/resume/hooks/use-resume-editor";

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

  // Deliberately a non-modal side panel (not a React Aria Modal): the person
  // keeps editing the resume and watching the preview while the tools stay open.
  // It closes only via the toggle, the close button, or Escape.
  const [top, setTop] = useState<number | undefined>();
  useEffect(() => {
    if (!open) return;
    // Sit flush against the app header's bottom edge, measured live so the panel
    // stays connected regardless of the header's exact height.
    const measure = () => setTop(document.querySelector("header")?.getBoundingClientRect().bottom);
    measure();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measure);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measure);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      id="tools-panel"
      role="dialog"
      aria-label="Tools"
      style={{ top }}
      className="app-chrome fixed bottom-0 right-0 top-[120px] z-40 flex w-full max-w-lg flex-col overflow-y-auto border-l border-t bg-card shadow-2xl focus:outline-hidden lg:top-[61px]"
    >
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-normal">Tools</h2>
          <p className="text-xs leading-snug text-muted-foreground">
            Review your resume and open browser tools.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close tools"
          onClick={() => onOpenChange(false)}
        >
          <X data-icon="inline-start" />
        </Button>
      </div>

      <div className="px-4 py-5">
        <section aria-label="Tools">
          <div className="grid gap-2">
            {hasContent ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 whitespace-normal py-3 text-left"
                onClick={onOpenChecksReview}
              >
                <ClipboardCheck
                  data-icon="inline-start"
                  className={cn(checksReady ? "text-success" : "text-warning")}
                />
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
              isDisabled={!hasContent}
            >
              <ClipboardCopy data-icon="inline-start" />
              <span>
                <span className="block text-sm font-semibold">Copy for applications</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Copy individual fields for application forms.
                </span>
              </span>
            </Button>
            {localAIEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto justify-start gap-3 whitespace-normal py-3 text-left"
                onClick={onOpenLocalAI}
              >
                <Cpu data-icon="inline-start" className="text-brand" />
                <span>
                  <span className="block text-sm font-semibold">Local AI</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Download or manage private on-device models.
                  </span>
                </span>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 whitespace-normal py-3 text-left"
              onClick={onOpenNavigator}
            >
              <Search data-icon="inline-start" />
              <span>
                <span className="block text-sm font-semibold">Navigate resume</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Jump directly to any field with Cmd or Ctrl + K.
                </span>
              </span>
            </Button>
            {feedbackUrl ? (
              <a
                href={feedbackUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-auto justify-start gap-3 whitespace-normal py-3 text-left",
                )}
              >
                <MessageSquarePlus />
                <span>
                  <span className="block text-sm font-semibold">Feedback</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    Share feedback or vote on features.
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
