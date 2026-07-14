"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChangeSummaryGrid } from "@/components/resume-editor/version-changes";
import {
  friendlyLocalAIError,
  generateLocalAIText,
  getLocalAIRuntime,
  interruptLocalAIGeneration,
} from "@/lib/local-ai-engine";
import { buildImportRepairMessages, parseLocalAIImportProposal } from "@/lib/local-ai";
import { exportChangeSummary, resumePlainText, type ResumeState } from "@/lib/resume";

export function LocalAIImportFix({
  sourceText,
  currentState,
  onApply,
  onClose,
  onOpenSetup,
}: {
  sourceText: string;
  currentState: ResumeState;
  onApply: (state: ResumeState) => void;
  onClose: () => void;
  onOpenSetup: () => void;
}) {
  const [proposal, setProposal] = useState<ResumeState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const ready = Boolean(getLocalAIRuntime());
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
        json: true,
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
    <section className="w-full space-y-3 rounded-lg border border-violet-200 bg-card p-4 shadow-sm dark:border-violet-500/40" aria-labelledby="local-ai-import-fix-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="local-ai-import-fix-title" className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-violet-600 dark:text-violet-300" /> Fix import with local AI</h2>
          <p className="mt-1 text-xs text-muted-foreground">The original extracted text stays in this browser. The model remaps it into resume fields, then you review the proposal before applying.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close AI import fix"><X /></Button>
      </div>

      {!ready ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
          <p className="text-sm text-muted-foreground">Load a local model first. The larger model is more dependable for full-resume mapping.</p>
          <Button type="button" variant="outline" size="sm" onClick={onOpenSetup}><Sparkles /> Open setup</Button>
        </div>
      ) : generating ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 p-3 text-sm text-muted-foreground" aria-live="polite">
          <Loader2 className="size-4 animate-spin" /> Rebuilding resume fields locally… this takes longer than a small edit.
        </div>
      ) : error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void repair()}>Try again</Button>
        </div>
      ) : proposal ? (
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Proposed mapping</h3>
            <p className="mt-1 text-xs text-muted-foreground">Check names, dates, employers, and every factual claim. Local models can still place text incorrectly.</p>
          </div>
          {changes.length ? (
            <ChangeSummaryGrid changes={changes} beforeLabel="Current import" afterLabel="AI proposal" />
          ) : (
            <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">The model did not find a meaningful structural change.</p>
          )}
          <Textarea
            readOnly
            value={resumePlainText(proposal)}
            aria-label="AI import proposal as plain text"
            className="max-h-72 min-h-40 resize-y bg-background font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => onApply(proposal)} disabled={!changes.length}><Check /> Apply corrected draft</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void repair()}>Run again</Button>
            <span className="text-xs text-muted-foreground">Applying creates a recovery point and restarts import review.</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
