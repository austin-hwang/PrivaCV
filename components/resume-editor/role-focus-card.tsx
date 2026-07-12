"use client";

import { AlertCircle, ArrowRight, Check, Save, Target } from "lucide-react";
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
  const [phrase, setPhrase] = useState("");
  const hasDescription = Boolean(jobDescription.trim());
  const matchedTerms = roleFocus.terms.filter((term) => term.matched);
  const missingTerms = roleFocus.terms.filter((term) => !term.matched);
  const requirementTerms = roleFocus.terms.filter((term) => term.isRequirement);
  const generalMatchedTerms = matchedTerms.filter((term) => !term.isRequirement);
  const generalMissingTerms = missingTerms.filter((term) => !term.isRequirement);
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
            <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.14em]">Role focus</CardDescription>
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
      <CardContent className="space-y-3 p-0 pt-4">
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
        {hasDescription && hasContent ? (
          <div className="flex flex-col gap-3 rounded-md border border-sky-300 bg-sky-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-950">Save your base before tailoring</p>
              <p className="text-xs leading-snug text-sky-900/80">
                Keep this draft and its local role context easy to restore after you try wording changes.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0 border-sky-300 bg-background" onClick={onSaveBase}>
              <Save /> Save base draft
            </Button>
          </div>
        ) : null}
        {hasDescription && roleFocus.totalCount ? (
          <div className="rounded-md border bg-background p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                {roleFocus.matchedCount} of {roleFocus.totalCount} selected terms appear
              </Badge>
              {roleFocus.matchedCount ? (
                <Badge variant="outline" className="border-sky-300 bg-sky-50 text-sky-950">
                  {roleFocus.detailEvidenceCount} backed by entry details
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {roleFocus.requirementCount
                  ? `${roleFocus.requirementCount} listed requirement${roleFocus.requirementCount === 1 ? "" : "s"} shown first.`
                  : "Repeated terms are listed first."}
              </span>
            </div>
            {requirementTerms.length ? (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Listed requirements</p>
                <div className="flex flex-wrap gap-1.5">
                  {requirementTerms.map((term) => (
                    <Badge
                      key={term.term}
                      variant="outline"
                      className={term.matched ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-950"}
                    >
                      {term.term} <span className="ml-1 text-[10px] font-medium">{term.matched ? "present" : "review"}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {generalMatchedTerms.length ? (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Already present</p>
                <div className="flex flex-wrap gap-1.5">
                  {generalMatchedTerms.map((term) => (
                    <Badge key={term.term} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {generalMissingTerms.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Not found verbatim</p>
                <div className="flex flex-wrap gap-1.5">
                  {generalMissingTerms.map((term) => (
                    <Badge key={term.term} variant="outline" className="border-amber-300 bg-amber-50 text-amber-950">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              Requirements come only from an explicit qualifications-style heading. Use any missing term only when it accurately describes your experience. This is a wording review, not an ATS score.
            </p>
            {roleFocus.referenceOnlyCount ? (
              <p className="mt-2 text-xs leading-snug text-muted-foreground">
                {roleFocus.referenceOnlyCount} {roleFocus.referenceOnlyCount === 1 ? "matching term appears" : "matching terms appear"} outside entry details. A title, skill list, or education entry can be useful context; add a term to a truthful achievement only when it gives a recruiter clearer proof.
              </p>
            ) : null}
            {matchedTerms.some((term) => term.evidence.length) ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Where matched terms appear</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Jump to the wording you already have. Terms found only in a title, heading, summary, or skills can be worth grounding in a truthful achievement too.
                </p>
                <div className="mt-2 space-y-2">
                  {matchedTerms.filter((term) => term.evidence.length).map((term) => {
                    const concreteEvidence = term.evidence.filter((item) => item.isConcrete);
                    const supportingEvidence = term.evidence.filter((item) => !item.isConcrete);
                    return (
                      <div key={term.term} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold text-foreground">{term.term}</span>
                        {concreteEvidence.map((item) => (
                          <Button
                            key={`${term.term}-${item.targetId}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-emerald-300 bg-emerald-50 px-2 text-emerald-950"
                            onClick={() => onFocus(item.targetId)}
                          >
                            {item.label} <ArrowRight />
                          </Button>
                        ))}
                        {supportingEvidence.map((item) => (
                          <Button
                            key={`${term.term}-${item.targetId}`}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 border-sky-300 bg-sky-50 px-2 text-sky-950"
                            onClick={() => onFocus(item.targetId)}
                          >
                            {item.label} <ArrowRight />
                          </Button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : hasDescription ? (
          <Alert>
            <AlertCircle />
            <AlertTitle>Add a little more role detail</AlertTitle>
            <AlertDescription>
              Try pasting the responsibilities and requirements so PrivaCV can surface useful terms to review.
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
