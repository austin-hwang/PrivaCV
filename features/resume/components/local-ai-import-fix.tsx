"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Sparkles, X } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ChangeSummaryGrid } from "@/features/resume/components/version-changes";
import {
  friendlyLocalAIError,
  generateLocalAIText,
  getLocalAIRuntime,
  interruptLocalAIGeneration,
} from "@/lib/local-ai-engine";
import {
  buildImportRepairMessages,
  LOCAL_AI_IMPORT_JSON_SCHEMA,
  parseLocalAIImportProposal,
} from "@/lib/local-ai";
import { exportChangeSummary, resumePlainText, type ResumeState } from "@/lib/resume";
import { useLocalAIReady } from "@/features/resume/hooks/use-local-ai-runtime";

export function LocalAIImportFix({
  sourceText,
  currentState,
  onApply,
  onClose,
  onOpenSetup,
  usingCurrentDraft,
}: {
  sourceText: string;
  currentState: ResumeState;
  onApply: (state: ResumeState) => void;
  onClose: () => void;
  onOpenSetup: () => void;
  usingCurrentDraft?: boolean;
}) {
  const [proposal, setProposal] = useState<ResumeState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const ready = useLocalAIReady();
  const changes = proposal ? exportChangeSummary(currentState, proposal) : [];

  useEffect(() => () => interruptLocalAIGeneration(), []);

  const repair = async () => {
    if (!getLocalAIRuntime() || generating) return;
    setGenerating(true);
    setProposal(null);
    setError(null);
    try {
      const output = await generateLocalAIText({
        messages: buildImportRepairMessages({ sourceText, currentState }),
        maxTokens: 1_300,
        jsonSchema: LOCAL_AI_IMPORT_JSON_SCHEMA,
      });
      setProposal(parseLocalAIImportProposal(output, currentState));
    } catch (repairError) {
      setError(friendlyLocalAIError(repairError));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (started.current || !ready) return;
    started.current = true;
    void repair();
  });

  return (
    <section
      className="flex w-full flex-col gap-3 rounded-lg border border-brand/30 bg-card p-4 shadow-xs"
      aria-labelledby="local-ai-import-fix-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="local-ai-import-fix-title"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Sparkles className="size-4 text-brand" /> Fix import with local AI
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {usingCurrentDraft
              ? "The original extracted text is no longer available after the earlier browser session, so the model will reorganize the current parsed draft. Re-import the source file first if text was omitted."
              : "The original extracted text stays in this browser. The model remaps it into resume fields, then you review the proposal before applying."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
          aria-label="Close AI import fix"
        >
          <X data-icon="inline-start" />
        </Button>
      </div>

      {!ready ? (
        <Alert>
          <Sparkles />
          <AlertTitle>Local model required</AlertTitle>
          <AlertDescription>
            Load a local model first. The larger model is more dependable for full-resume mapping.
          </AlertDescription>
          <AlertAction>
            <Button type="button" variant="outline" size="sm" onClick={onOpenSetup}>
              Open setup
            </Button>
          </AlertAction>
        </Alert>
      ) : generating ? (
        <Alert aria-live="polite">
          <Spinner />
          <AlertTitle>Rebuilding resume fields locally</AlertTitle>
          <AlertDescription>This takes longer than a small edit.</AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Could not rebuild the import</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button type="button" variant="outline" size="sm" onClick={() => void repair()}>
              Try again
            </Button>
          </AlertAction>
        </Alert>
      ) : proposal ? (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Proposed mapping
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Check names, dates, employers, and every factual claim. Local models can still place
              text incorrectly.
            </p>
          </div>
          {changes.length ? (
            <ChangeSummaryGrid
              changes={changes}
              beforeLabel="Current import"
              afterLabel="AI proposal"
            />
          ) : (
            <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              The model did not find a meaningful structural change.
            </p>
          )}
          <Field>
            <FieldLabel className="sr-only" htmlFor="ai-import-proposal">
              AI import proposal as plain text
            </FieldLabel>
            <Textarea
              id="ai-import-proposal"
              readOnly
              value={resumePlainText(proposal)}
              className="max-h-72 min-h-40 resize-y bg-background font-mono text-xs leading-relaxed"
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onApply(proposal)}
              isDisabled={!changes.length}
            >
              <Check data-icon="inline-start" /> Apply corrected draft
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void repair()}>
              Run again
            </Button>
            <span className="text-xs text-muted-foreground">
              Applying creates a recovery point and restarts import review.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
