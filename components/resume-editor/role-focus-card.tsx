"use client";

import { ArrowRight, Check, Circle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { buildRoleFocus } from "@/lib/job-match";
import { cn } from "@/lib/utils";

/**
 * Lean "tailor for a role" helper: paste a job description and get a short
 * checklist of the terms it emphasizes, each marked present or worth addressing,
 * with a jump link to wording you already have. Everything stays local.
 */
export function RoleFocusCard({
  jobDescription,
  roleFocus,
  hasContent,
  onChange,
  onClear,
  onFocus,
}: {
  jobDescription: string;
  roleFocus: ReturnType<typeof buildRoleFocus>;
  hasContent: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onFocus: (targetId: string) => void;
}) {
  const hasDescription = Boolean(jobDescription.trim());
  // Requirements first, then the most repeated terms. Keep it short — a
  // checklist, not an exhaustive term dump.
  const checklist = [...roleFocus.terms]
    .sort((a, b) => Number(b.isRequirement) - Number(a.isRequirement))
    .slice(0, 12);

  return (
    <Card className="border-none bg-transparent shadow-none">
      <CardHeader className="flex-col gap-3 space-y-0 p-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
            <Target className="size-4" />
          </span>
          <div>
            <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em]">Tailor for a role</CardDescription>
            <CardTitle className="text-base">Paste a job post, get a checklist.</CardTitle>
            <CardDescription>
              See which terms this role emphasizes and whether your resume already uses them. Stays in this browser.
            </CardDescription>
          </div>
        </div>
        {hasDescription ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        <Textarea
          value={jobDescription}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste the job description here…"
          className="min-h-28 resize-y bg-background"
          aria-label="Job description"
        />
        {hasDescription && !hasContent ? (
          <p className="text-xs text-muted-foreground">Add some resume content to compare against.</p>
        ) : hasDescription && checklist.length ? (
          <div className="rounded-md border bg-background p-3">
            <p className="mb-2 text-xs font-semibold">
              {roleFocus.matchedCount} of {roleFocus.totalCount} key terms already in your resume
            </p>
            <ul className="space-y-1">
              {checklist.map((term) => {
                const target = term.evidence[0]?.targetId;
                return (
                  <li key={term.term} className="flex items-center gap-2 text-sm">
                    <span className={cn("inline-flex size-4 shrink-0 items-center justify-center", term.matched ? "text-emerald-600" : "text-amber-600")}>
                      {term.matched ? <Check className="size-3.5" /> : <Circle className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{term.term}</span>
                    {term.isRequirement ? (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">required</span>
                    ) : null}
                    {term.matched && target ? (
                      <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 gap-1 px-1.5 text-xs" onClick={() => onFocus(target)}>
                        Go to <ArrowRight className="size-3" />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              A wording check, not an ATS score. Only add a term if it truthfully describes your work.
            </p>
          </div>
        ) : hasDescription ? (
          <p className="text-xs text-muted-foreground">Paste a bit more detail to surface key terms.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
