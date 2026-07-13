"use client";

import { ArrowRight, Check, Circle, Save, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildRolePhraseSuggestions, reviewRolePhrase, type buildRoleFocus } from "@/lib/job-match";
import { cn } from "@/lib/utils";

/**
 * Lean "tailor for a role" helper: paste a job description and get a short
 * checklist of the terms it emphasizes, each marked present or worth addressing,
 * with a jump link to wording you already have. Everything stays local.
 */
export function RoleFocusCard({
  jobDescription,
  roleLabel,
  roleFocus,
  resumeText,
  hasContent,
  onChange,
  onRoleLabelChange,
  onClear,
  onSaveBase,
  onFocus,
}: {
  jobDescription: string;
  roleLabel: string;
  roleFocus: ReturnType<typeof buildRoleFocus>;
  resumeText: string;
  hasContent: boolean;
  onChange: (value: string) => void;
  onRoleLabelChange: (value: string) => void;
  onClear: () => void;
  onSaveBase: () => void;
  onFocus: (targetId: string) => void;
}) {
  const hasDescription = Boolean(jobDescription.trim());
  const [phrase, setPhrase] = useState("");
  // Requirements first, then the most repeated terms. Keep it short — a
  // checklist, not an exhaustive term dump.
  const checklist = [...roleFocus.terms]
    .sort((a, b) => Number(b.isRequirement) - Number(a.isRequirement))
    .slice(0, 12);
  const phraseReview = useMemo(() => reviewRolePhrase(resumeText, phrase), [phrase, resumeText]);
  const phraseSuggestions = useMemo(
    () => buildRolePhraseSuggestions(resumeText, jobDescription),
    [jobDescription, resumeText],
  );

  useEffect(() => {
    setPhrase("");
  }, [jobDescription]);

  const clearDescription = () => {
    setPhrase("");
    onClear();
  };

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
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearDescription}>
            Clear
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3 p-0 pt-4">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          <span>Private role label <span className="font-normal">(optional)</span></span>
          <Input
            value={roleLabel}
            onChange={(event) => onRoleLabelChange(event.target.value)}
            placeholder="e.g. Acme — Senior Product Engineer"
            aria-describedby="role-label-help"
          />
          <span id="role-label-help" className="font-normal leading-snug">
            Helps identify saved drafts and downloads. It never appears in your resume content or on the PDF page.
          </span>
        </label>
        <Textarea
          value={jobDescription}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste the job description here…"
          className="min-h-28 resize-y bg-background"
          aria-label="Job description"
        />
        {hasDescription && hasContent ? (
          <div className="flex flex-col gap-2 rounded-md border border-sky-300 bg-sky-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-950">Save your base before tailoring</p>
              <p className="text-xs leading-snug text-sky-900/80">Keep this draft and role context easy to restore after wording changes.</p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 border-sky-300 bg-background" onClick={onSaveBase}>
              <Save /> Save base draft
            </Button>
          </div>
        ) : null}
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
        {hasDescription ? (
          <div className="rounded-md border bg-background p-3">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Check an exact phrase</span>
              <Input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="e.g. TypeScript services"
                aria-describedby="role-phrase-help"
              />
            </label>
            <p id="role-phrase-help" className="mt-1.5 text-xs leading-snug text-muted-foreground">
              Compare a two-or-more-word concept after deciding it truthfully reflects your work.
            </p>
            {phraseSuggestions.length ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Suggested exact phrases</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {phraseSuggestions.map((suggestion) => (
                    <Button
                      key={suggestion.phrase}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8 whitespace-normal py-1 text-left"
                      onClick={() => setPhrase(suggestion.phrase)}
                    >
                      {suggestion.phrase}
                      <span className={cn("ml-1.5 text-xs", suggestion.matched ? "text-emerald-800" : "text-muted-foreground")}>
                        {suggestion.matched ? "in resume" : "review"}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {phraseReview.phrase ? (
              <div aria-live="polite" className="mt-3 rounded-md border bg-muted/30 p-2.5 text-sm">
                {phraseReview.termCount < 2 ? (
                  <p className="text-muted-foreground">Add at least two words to check a phrase.</p>
                ) : phraseReview.matched ? (
                  <p className="font-medium text-emerald-900">Phrase already appears in your resume.</p>
                ) : (
                  <p className="font-medium text-amber-950">Phrase not found verbatim in your resume.</p>
                )}
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  This checks the same word sequence while ignoring punctuation and spacing; it does not judge your fit.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
