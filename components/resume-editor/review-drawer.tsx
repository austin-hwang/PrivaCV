"use client";

import { ArrowRight, Check, Cpu, Keyboard, MessageSquarePlus, Moon, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { useResumeEditor } from "@/hooks/use-resume-editor";
import { cn } from "@/lib/utils";

export function ReviewDrawer({
  editor,
  open,
  onOpenChange,
  onFocusTarget,
  onStartChecksReview,
  onOpenLocalAI,
  onOpenShortcuts,
  isDarkTheme,
  onToggleTheme,
  feedbackUrl,
}: {
  editor: ReturnType<typeof useResumeEditor>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusTarget: (targetId: string) => void;
  onStartChecksReview: () => void;
  onOpenLocalAI: () => void;
  onOpenShortcuts: () => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  feedbackUrl: string | null;
}) {
  const { checks, hasContent, passedChecks } = editor;

  const checksReady = passedChecks === checks.length;
  const suggestedChecks = checks.filter((check) => !check.ok || check.advisory);
  const jumpTargets = [
    { id: "tool-actions", label: "More tools" },
    ...(hasContent ? [{ id: "tool-checks", label: "Checks" }] : []),
  ];
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent aria-describedby={undefined} className="top-[120px] lg:top-[73px]">
        <SheetHeader>
          <SheetTitle>Tools</SheetTitle>
          <SheetDescription>Review your resume and open browser tools.</SheetDescription>
        </SheetHeader>

        <div className="flex gap-1.5 border-b px-4 py-2.5">
          {jumpTargets.map((item) => (
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
          <section id="tool-actions" aria-label="More tools" className="scroll-mt-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">More tools</p>
            <div className="grid gap-2">
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" onClick={onOpenLocalAI}>
                <Cpu className="text-violet-600 dark:text-violet-300" />
                <span>
                  <span className="block text-sm font-semibold">Local AI</span>
                  <span className="block text-xs font-normal text-muted-foreground">Download or manage private on-device models.</span>
                </span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" onClick={onToggleTheme}>
                {isDarkTheme ? <Sun /> : <Moon />}
                <span>
                  <span className="block text-sm font-semibold">{isDarkTheme ? "Switch to light mode" : "Switch to night mode"}</span>
                  <span className="block text-xs font-normal text-muted-foreground">Change the editor appearance on this device.</span>
                </span>
              </Button>
              <Button type="button" variant="outline" className="h-auto justify-start gap-3 whitespace-normal py-3 text-left" onClick={onOpenShortcuts}>
                <Keyboard />
                <span>
                  <span className="block text-sm font-semibold">Keyboard shortcuts</span>
                  <span className="block text-xs font-normal text-muted-foreground">See faster ways to edit and export.</span>
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

          {hasContent ? (
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
              {suggestedChecks.length ? (
                <Button type="button" variant="outline" size="sm" className="mb-3 w-full" onClick={onStartChecksReview}>
                  <ArrowRight /> Review {suggestedChecks.length} {suggestedChecks.length === 1 ? "suggestion" : "suggestions"}
                </Button>
              ) : null}
              <div className="grid gap-2">
                {checks.map((check) => (
                  <div key={check.id} className="flex gap-2.5 rounded-lg border bg-muted/30 p-3">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        check.advisory
                          ? "bg-brand text-brand-foreground"
                          : check.ok
                            ? "bg-success text-success-foreground"
                            : "bg-warning text-warning-foreground",
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
            </section>
          ) : null}
        </div>

        <p className="border-t px-4 py-3 text-xs leading-snug text-muted-foreground">Resume checks and Local AI run in this browser.</p>
      </SheetContent>
    </Sheet>
  );
}
