"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  friendlyLocalAIError,
  generateLocalAIText,
  interruptLocalAIGeneration,
} from "@/lib/local-ai-engine";
import { buildPromptedLocalRewriteMessages, cleanLocalAIRewrite, localAIRewriteMaxTokens } from "@/lib/local-ai";
import { useLocalAIReady } from "@/hooks/use-local-ai-runtime";

const INLINE_AI_INSTRUCTION_LIMIT = 100;
const INLINE_AI_PRESETS = [
  { label: "Concise", instruction: "Make this more concise." },
  { label: "Proofread", instruction: "Proofread and fix grammar." },
  { label: "Stronger impact", instruction: "Strengthen the impact without adding facts." },
  { label: "Measurable", instruction: "Highlight measurable scope or results using only existing facts." },
] as const;

export function LocalAIInlineEdit({
  label,
  text,
  context,
  onApply,
  onClose,
  onOpenSetup,
}: {
  label: string;
  text: string;
  context?: string;
  onApply: (value: string) => void;
  onClose: () => void;
  onOpenSetup: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = useLocalAIReady();

  useEffect(() => () => interruptLocalAIGeneration(), []);

  const generate = async () => {
    if (!instruction.trim() || !text.trim() || generating) return;
    setGenerating(true);
    setOutput("");
    setError(null);
    try {
      const result = await generateLocalAIText({
        messages: buildPromptedLocalRewriteMessages({ label, text, instruction, context }),
        maxTokens: localAIRewriteMaxTokens(text),
        onToken: setOutput,
      });
      setOutput(cleanLocalAIRewrite(result));
    } catch (generationError) {
      setOutput("");
      setError(friendlyLocalAIError(generationError));
    } finally {
      setGenerating(false);
    }
  };

  const stop = () => {
    interruptLocalAIGeneration();
    setGenerating(false);
  };

  return (
    <div className="space-y-2 rounded-md border border-violet-200 bg-violet-50/70 p-3 text-foreground shadow-sm dark:border-violet-500/40 dark:bg-violet-950/30" aria-label={`Edit ${label} with local AI`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-violet-950 dark:text-violet-100"><Sparkles className="size-3.5" /> Edit this text locally</p>
          <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">Describe one small change. Surrounding resume text helps match tone; facts stay constrained to this field.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close AI edit">
          <X />
        </Button>
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap gap-1.5" aria-label="Suggested AI edits">
          {INLINE_AI_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={generating || !ready}
              onClick={() => setInstruction(preset.instruction)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={instruction}
            maxLength={INLINE_AI_INSTRUCTION_LIMIT}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void generate();
              }
            }}
            disabled={generating || !ready}
            placeholder="e.g. Make this more concise"
            aria-label={`AI edit instruction for ${label}`}
            className="bg-background"
          />
          {generating ? (
            <Button type="button" variant="outline" size="sm" onClick={stop}><Square /> Stop</Button>
          ) : (
            <Button type="button" size="sm" onClick={() => void generate()} disabled={!ready || !instruction.trim()}><Sparkles /> Edit</Button>
          )}
        </div>
        <p className="text-right text-[10px] font-normal tabular-nums text-muted-foreground">
          {instruction.length}/{INLINE_AI_INSTRUCTION_LIMIT}
        </p>
      </div>

      {ready ? (
        <>
          {error ? <p role="alert" className="text-xs font-normal text-destructive">{error}</p> : null}
          {output || generating ? (
            <div className="space-y-2" aria-live="polite">
              <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-2.5 text-sm font-normal leading-relaxed">
                {output || <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Editing locally…</span>}
              </div>
              {!generating && output.trim() ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => onApply(cleanLocalAIRewrite(output))}><Check /> Apply edit</Button>
                  <span className="text-[11px] font-normal text-muted-foreground">Review facts before applying.</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-background/80 p-2.5">
          <p className="text-xs font-normal text-muted-foreground">Load a downloaded model before editing.</p>
          <Button type="button" variant="outline" size="sm" onClick={onOpenSetup}><Sparkles /> Open setup</Button>
        </div>
      )}
    </div>
  );
}
