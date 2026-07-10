"use client";

import { AlertCircle, Check, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildRoleFocus, buildRolePhraseSuggestions, reviewRolePhrase } from "@/lib/job-match";
import { cn } from "@/lib/utils";

export function RoleFocusCard({
  jobDescription,
  roleLabel,
  roleFocus,
  resumeText,
  onChange,
  onRoleLabelChange,
  onClear,
}: {
  jobDescription: string;
  roleLabel: string;
  roleFocus: ReturnType<typeof buildRoleFocus>;
  resumeText: string;
  onChange: (value: string) => void;
  onRoleLabelChange: (value: string) => void;
  onClear: () => void;
}) {
  const [phrase, setPhrase] = useState("");
  const hasDescription = Boolean(jobDescription.trim());
  const matchedTerms = roleFocus.terms.filter((term) => term.matched);
  const missingTerms = roleFocus.terms.filter((term) => !term.matched);
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
    <Card className="mb-6 border-sky-300 bg-sky-50/70">
      <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-sky-300 bg-background text-sky-800">
            <Target className="size-4" />
          </span>
          <div>
            <CardDescription className="font-semibold uppercase tracking-[0.16em] text-sky-900">Role focus</CardDescription>
            <CardTitle className="text-base">Check the language you already use.</CardTitle>
            <CardDescription>
              Paste a job description to find its most repeated terms in your resume. Everything stays in this browser.
            </CardDescription>
          </div>
        </div>
        {hasDescription ? (
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={clearDescription}>
            Clear description
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="grid gap-1.5 text-sm font-medium">
          <span>Private role label (optional)</span>
          <Input
            value={roleLabel}
            onChange={(event) => onRoleLabelChange(event.target.value)}
            placeholder="e.g. Acme — Senior Product Engineer"
          />
          <span className="text-xs font-normal leading-snug text-muted-foreground">
            A short local-only label makes saved drafts easy to recognize. It never appears in your resume or PDF.
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          <span>Job description</span>
          <Textarea
            value={jobDescription}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Paste the role description here to compare wording locally."
            className="min-h-24 resize-y bg-background"
          />
        </label>
        {hasDescription && roleFocus.totalCount ? (
          <div className="rounded-md border bg-background p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                {roleFocus.matchedCount} of {roleFocus.totalCount} selected terms already used
              </Badge>
              <span className="text-xs text-muted-foreground">Repeated terms are listed first.</span>
            </div>
            {matchedTerms.length ? (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Already present</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedTerms.map((term) => (
                    <Badge key={term.term} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {missingTerms.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Not found verbatim</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingTerms.map((term) => (
                    <Badge key={term.term} variant="outline" className="border-amber-300 bg-amber-50 text-amber-950">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              Use missing terms only when they accurately describe your experience. This is a wording review, not an ATS score.
            </p>
          </div>
        ) : hasDescription ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>Add a little more role detail</AlertTitle>
            <AlertDescription>
              Try pasting the responsibilities and requirements so Resume Editor can surface useful terms to review.
            </AlertDescription>
          </Alert>
        ) : null}
        {hasDescription ? (
          <div className="rounded-md border bg-background p-3">
            <label className="grid gap-1.5 text-sm font-medium">
              <span>Check an exact phrase from this role</span>
              <Input
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="e.g. TypeScript services"
                aria-describedby="role-phrase-help"
              />
            </label>
            <p id="role-phrase-help" className="mt-1.5 text-xs leading-snug text-muted-foreground">
              Compare a specific two-or-more-word concept after deciding it accurately reflects your work.
            </p>
            {phraseSuggestions.length ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Suggested exact phrases</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Pick one to review it below. Suggestions come directly from adjacent wording in the job description.
                </p>
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
