"use client";

import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type BlankResumeGuideStep = {
  id: string;
  label: string;
  description: string;
  actionLabel: string;
  targetId: string;
  done: boolean;
};

/**
 * A deliberately small orientation aid for a person who chose a blank draft.
 * It points to the minimum useful content without turning the editor into a
 * locked wizard or prescribing a one-size-fits-all resume.
 */
export function BlankResumeGuide({
  steps,
  onFocus,
  onDismiss,
}: {
  steps: BlankResumeGuideStep[];
  onFocus: (targetId: string) => void;
  onDismiss: () => void;
}) {
  const completeCount = steps.filter((step) => step.done).length;
  const complete = completeCount === steps.length;

  return (
    <Card className="mb-5 border-brand/30 bg-brand/10" aria-label="Blank resume essentials">
      <CardHeader className="flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">
            {complete ? "Your first draft has the basics." : "Start with the parts a recruiter needs first."}
          </CardTitle>
          <CardDescription>
            {complete
              ? "Use Resume Review before export to polish the details that matter for this application."
              : "These are guideposts, not requirements. Add other sections whenever they strengthen your story."}
          </CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" className="w-fit text-brand" onClick={onDismiss}>
          Hide guide
        </Button>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-3" aria-label={`${completeCount} of ${steps.length} essentials complete`}>
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "flex min-w-0 flex-col gap-2 rounded-md border bg-background/75 p-3",
                step.done && "border-success/30 bg-success/10",
              )}
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    step.done ? "border-success bg-success text-success-foreground" : "border-brand/40 bg-brand/10 text-brand",
                  )}
                  aria-hidden="true"
                >
                  {step.done ? <Check className="size-3" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{step.description}</p>
                </div>
              </div>
              <Button
                type="button"
                variant={step.done ? "ghost" : "outline"}
                size="sm"
                className="mt-auto w-fit self-end"
                onClick={() => onFocus(step.targetId)}
              >
                {step.done ? "Review" : step.actionLabel} {!step.done ? <ArrowRight /> : null}
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
