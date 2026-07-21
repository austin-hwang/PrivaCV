"use client";

import { AlertCircle, ArrowRight, Check, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
  onFocus,
}: {
  jobDescription: string;
  roleLabel: string;
  roleFocus: ReturnType<typeof buildRoleFocus>;
  resumeText: string;
  onChange: (value: string) => void;
  onRoleLabelChange: (value: string) => void;
  onClear: () => void;
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
    <Card className="mb-6">
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-background text-brand">
            <Target className="size-4" />
          </span>
          <div>
            <CardDescription className="font-semibold uppercase tracking-[0.16em]">
              Role focus
            </CardDescription>
            <CardTitle className="text-base">Check the language you already use.</CardTitle>
            <CardDescription>
              Paste a job description to find its most repeated terms in your resume. Everything
              stays in this browser.
            </CardDescription>
          </div>
        </div>
        {hasDescription ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={clearDescription}
          >
            Clear description
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="role-focus-label">Private role label (optional)</FieldLabel>
          <Input
            id="role-focus-label"
            value={roleLabel}
            onChange={(event) => onRoleLabelChange(event.target.value)}
            placeholder="e.g. Acme — Senior Product Engineer"
          />
          <FieldDescription>
            A short local-only label makes saved drafts easy to recognize. It never appears in your
            resume or PDF.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="role-focus-description">Job description</FieldLabel>
          <Textarea
            id="role-focus-description"
            value={jobDescription}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Paste the role description here to compare wording locally."
            className="min-h-24 resize-y bg-background"
          />
        </Field>
        {hasDescription && roleFocus.totalCount ? (
          <div className="rounded-md border bg-background p-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {roleFocus.matchedCount} of {roleFocus.totalCount} selected terms already used
              </Badge>
              <span className="text-xs text-muted-foreground">
                {roleFocus.requirementCount
                  ? `${roleFocus.requirementCount} listed requirement${roleFocus.requirementCount === 1 ? "" : "s"} shown first.`
                  : "Repeated terms are listed first."}
              </span>
            </div>
            {requirementTerms.length ? (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Listed requirements
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {requirementTerms.map((term) => (
                    <Badge key={term.term} variant={term.matched ? "secondary" : "outline"}>
                      {term.term}{" "}
                      <span className="ml-1 text-[10px] font-medium">
                        {term.matched ? "present" : "review"}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {generalMatchedTerms.length ? (
              <div className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Already present
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {generalMatchedTerms.map((term) => (
                    <Badge key={term.term} variant="secondary">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {generalMissingTerms.length ? (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Not found verbatim
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {generalMissingTerms.map((term) => (
                    <Badge key={term.term} variant="outline">
                      {term.term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-snug text-muted-foreground">
              Requirements come only from an explicit qualifications-style heading. Use any missing
              term only when it accurately describes your experience. This is a wording review, not
              an ATS score.
            </p>
            {matchedTerms.some((term) => term.evidence.length) ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Where matched terms appear
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Jump to the wording you already have. Terms found only in a title, summary, or
                  skills can be worth grounding in a truthful achievement too.
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  {matchedTerms
                    .filter((term) => term.evidence.length)
                    .map((term) => {
                      const concreteEvidence = term.evidence.filter((item) => item.isConcrete);
                      const supportingEvidence = term.evidence.filter((item) => !item.isConcrete);
                      return (
                        <div
                          key={term.term}
                          className="flex flex-wrap items-center gap-1.5 text-xs"
                        >
                          <span className="font-semibold text-foreground">{term.term}</span>
                          {concreteEvidence.map((item) => (
                            <Button
                              key={`${term.term}-${item.targetId}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => onFocus(item.targetId)}
                            >
                              {item.label} <ArrowRight data-icon="inline-end" />
                            </Button>
                          ))}
                          {supportingEvidence.map((item) => (
                            <Button
                              key={`${term.term}-${item.targetId}`}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => onFocus(item.targetId)}
                            >
                              {item.label} <ArrowRight data-icon="inline-end" />
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
              Try pasting the responsibilities and requirements so Resume Editor can surface useful
              terms to review.
            </AlertDescription>
          </Alert>
        ) : null}
        {hasDescription ? (
          <div className="rounded-md border bg-background p-3">
            <Field>
              <FieldLabel htmlFor="role-focus-phrase">
                Check an exact phrase from this role
              </FieldLabel>
              <Input
                id="role-focus-phrase"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="e.g. TypeScript services"
                aria-describedby="role-phrase-help"
              />
              <FieldDescription id="role-phrase-help">
                Compare a specific two-or-more-word concept after deciding it accurately reflects
                your work.
              </FieldDescription>
            </Field>
            {phraseSuggestions.length ? (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Suggested exact phrases
                </p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  Pick one to review it below. Suggestions come directly from adjacent wording in
                  the job description.
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
                      <span
                        className={cn(
                          "ml-1.5 text-xs",
                          suggestion.matched ? "text-success" : "text-muted-foreground",
                        )}
                      >
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
                  <p className="font-medium text-success">Phrase already appears in your resume.</p>
                ) : (
                  <p className="font-medium text-warning">
                    Phrase not found verbatim in your resume.
                  </p>
                )}
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  This checks the same word sequence while ignoring punctuation and spacing; it does
                  not judge your fit.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
