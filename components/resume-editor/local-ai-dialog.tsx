"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Cpu, Download, Loader2, Sparkles, Square, Trash2 } from "lucide-react";
import type { MLCEngineInterface } from "@mlc-ai/web-llm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  LOCAL_AI_MODELS,
  LOCAL_AI_MODEL_STORAGE_KEY,
  buildLocalRewriteMessages,
  buildParserReviewMessages,
  cleanLocalAIRewrite,
  isLocalAIModelId,
  type LocalAIModelId,
  type LocalAIRewriteGoal,
} from "@/lib/local-ai";
import { getSectionEntries, getSectionTitle, resumePlainText, type ResumeState } from "@/lib/resume";
import { cn } from "@/lib/utils";

type LocalAIRuntime = {
  engine: MLCEngineInterface;
  modelId: LocalAIModelId;
  worker: Worker;
};

let runtime: LocalAIRuntime | null = null;

type ModelState = "checking" | "not-cached" | "cached" | "loading" | "ready" | "removing" | "error";
type DeviceState = "checking" | "supported" | "unsupported";
type AITask = "rewrite" | "parser-review";

type EditableTarget = {
  id: string;
  label: string;
  value: string;
  field?: "summary" | "skills";
  section?: string;
  index?: number;
};

type GPUAdapterLike = { features?: { has: (feature: string) => boolean } };
type NavigatorWithGPU = Navigator & {
  gpu?: { requestAdapter: () => Promise<GPUAdapterLike | null> };
  deviceMemory?: number;
};

function friendlyLocalAIError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/webgpu|gpu adapter|navigator\.gpu/i.test(message)) {
    return "WebGPU could not start on this browser or device. Try an up-to-date browser with hardware acceleration enabled.";
  }
  if (/memory|allocation|device lost|buffer/i.test(message)) {
    return "The model ran out of available GPU memory. Close other heavy tabs or try the smaller model.";
  }
  return message || "Local AI could not start.";
}

async function disposeRuntime() {
  const current = runtime;
  runtime = null;
  if (!current) return;
  try {
    await current.engine.unload();
  } catch {
    // The worker may already be unavailable after a WebGPU/device failure.
  } finally {
    current.worker.terminate();
  }
}

export function LocalAIDialog({
  open,
  onOpenChange,
  state,
  importSourceText,
  onUpdateField,
  onUpdateEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ResumeState;
  importSourceText?: string;
  onUpdateField: (field: "summary" | "skills", value: string) => void;
  onUpdateEntry: (section: string, index: number, value: string) => void;
}) {
  const [modelId, setModelId] = useState<LocalAIModelId>(LOCAL_AI_MODELS[0].id);
  const [modelState, setModelState] = useState<ModelState>("checking");
  const [deviceState, setDeviceState] = useState<DeviceState>("checking");
  const [deviceDetail, setDeviceDetail] = useState("Checking WebGPU support…");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<AITask>("rewrite");
  const [targetId, setTargetId] = useState("");
  const [draft, setDraft] = useState("");
  const [goal, setGoal] = useState<LocalAIRewriteGoal>("strengthen");
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);
  const generationId = useRef(0);

  const targets = useMemo<EditableTarget[]>(() => {
    const options: EditableTarget[] = [];
    if (state.summary.trim()) {
      options.push({
        id: "summary",
        label: "Professional summary",
        value: state.summary,
        field: "summary",
      });
    }
    if (state.skills.trim()) {
      options.push({
        id: "skills",
        label: "Skills",
        value: state.skills,
        field: "skills",
      });
    }
    state.sectionOrder.forEach((section) => {
      if (section === "skills") return;
      const entries = getSectionEntries(state, section);
      entries?.forEach((entry, index) => {
        if (!entry.details.trim()) return;
        options.push({
          id: `${section}:${index}`,
          label: `${getSectionTitle(state, section)} · ${entry.title || entry.subtitle || `Entry ${index + 1}`}`,
          value: entry.details,
          section,
          index,
        });
      });
    });
    return options;
  }, [state]);

  const selectedTarget = targets.find((target) => target.id === targetId) ?? targets[0];
  const selectedModel = LOCAL_AI_MODELS.find((model) => model.id === modelId) ?? LOCAL_AI_MODELS[0];
  const lowMemoryDevice = typeof navigator !== "undefined" && (navigator as NavigatorWithGPU).deviceMemory !== undefined
    ? ((navigator as NavigatorWithGPU).deviceMemory ?? 8) <= 4
    : false;

  useEffect(() => {
    if (!open) return;
    try {
      const saved = localStorage.getItem(LOCAL_AI_MODEL_STORAGE_KEY);
      if (saved && isLocalAIModelId(saved)) setModelId(saved);
    } catch {
      // Model preference is optional; cache state is checked independently.
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const check = async () => {
      setDeviceState("checking");
      const gpu = (navigator as NavigatorWithGPU).gpu;
      if (!window.isSecureContext || !gpu) {
        if (!active) return;
        setDeviceState("unsupported");
        setDeviceDetail("WebGPU is unavailable. Local AI needs a secure page and a WebGPU-capable browser/device.");
        return;
      }
      try {
        const adapter = await gpu.requestAdapter();
        if (!active) return;
        if (!adapter) {
          setDeviceState("unsupported");
          setDeviceDetail("No compatible GPU adapter was found. Hardware acceleration may be unavailable or disabled.");
          return;
        }
        setDeviceState("supported");
        setDeviceDetail(
          adapter.features?.has("shader-f16")
            ? "WebGPU is available, including 16-bit shader support."
            : "WebGPU is available. Model speed and memory limits still vary by device.",
        );
      } catch (supportError) {
        if (!active) return;
        setDeviceState("unsupported");
        setDeviceDetail(friendlyLocalAIError(supportError));
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const checkCache = async () => {
      if (runtime?.modelId === modelId) {
        setModelState("ready");
        return;
      }
      setModelState("checking");
      setError(null);
      try {
        const { hasModelInCache } = await import("@mlc-ai/web-llm");
        const cached = await hasModelInCache(modelId);
        if (active) setModelState(cached ? "cached" : "not-cached");
      } catch (cacheError) {
        if (!active) return;
        setModelState("error");
        setError(friendlyLocalAIError(cacheError));
      }
    };
    void checkCache();
    return () => {
      active = false;
    };
  }, [modelId, open]);

  useEffect(() => {
    if (!selectedTarget) {
      setTargetId("");
      setDraft("");
      return;
    }
    if (!targets.some((target) => target.id === targetId)) setTargetId(selectedTarget.id);
    setDraft(selectedTarget.value);
    setOutput("");
  }, [selectedTarget, targetId, targets]);

  const changeModel = (next: string) => {
    if (!isLocalAIModelId(next)) return;
    setModelId(next);
    setOutput("");
    setError(null);
    try {
      localStorage.setItem(LOCAL_AI_MODEL_STORAGE_KEY, next);
    } catch {
      // A blocked preference store should not block model setup.
    }
  };

  const prepareModel = async () => {
    if (deviceState !== "supported" || modelState === "loading") return;
    setModelState("loading");
    setProgress(0);
    setProgressText("Starting local model…");
    setError(null);
    try {
      await disposeRuntime();
      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
      const worker = new Worker(new URL("../../lib/webllm.worker.ts", import.meta.url), { type: "module" });
      try {
        const engine = await CreateWebWorkerMLCEngine(
          worker,
          modelId,
          {
            initProgressCallback: (report) => {
              setProgress(Math.max(0, Math.min(1, report.progress)));
              setProgressText(report.text);
            },
            logLevel: "WARN",
          },
          { context_window_size: 2048 },
        );
        runtime = { engine, modelId, worker };
      } catch (loadError) {
        worker.terminate();
        throw loadError;
      }
      setProgress(1);
      setProgressText("Model ready");
      setModelState("ready");
    } catch (loadError) {
      setModelState("error");
      setError(friendlyLocalAIError(loadError));
    }
  };

  const removeModel = async () => {
    if (!window.confirm(`Remove ${selectedModel.label} model files from this browser?`)) return;
    setModelState("removing");
    setError(null);
    try {
      if (runtime?.modelId === modelId) await disposeRuntime();
      const { deleteModelAllInfoInCache } = await import("@mlc-ai/web-llm");
      await deleteModelAllInfoInCache(modelId);
      setModelState("not-cached");
      setProgress(0);
      setProgressText("");
    } catch (removeError) {
      setModelState("error");
      setError(friendlyLocalAIError(removeError));
    }
  };

  const generate = async () => {
    if (!runtime || runtime.modelId !== modelId || generating) return;
    if (task === "rewrite" && (!selectedTarget || !draft.trim())) return;
    if (task === "parser-review" && !importSourceText?.trim()) return;

    const currentGeneration = ++generationId.current;
    setGenerating(true);
    setOutput("");
    setError(null);
    try {
      await runtime.engine.resetChat();
      const messages = task === "rewrite"
        ? buildLocalRewriteMessages({ label: selectedTarget!.label, text: draft, goal })
        : buildParserReviewMessages({ sourceText: importSourceText!, parsedText: resumePlainText(state) });
      const chunks = await runtime.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: task === "rewrite" ? 220 : 360,
      });
      let result = "";
      for await (const chunk of chunks) {
        if (generationId.current !== currentGeneration) break;
        result += chunk.choices[0]?.delta.content ?? "";
        setOutput(result);
      }
      if (task === "rewrite" && generationId.current === currentGeneration) {
        setOutput(cleanLocalAIRewrite(result));
      }
    } catch (generationError) {
      if (generationId.current === currentGeneration) setError(friendlyLocalAIError(generationError));
    } finally {
      if (generationId.current === currentGeneration) setGenerating(false);
    }
  };

  const stopGeneration = () => {
    generationId.current += 1;
    runtime?.engine.interruptGenerate();
    setGenerating(false);
  };

  const applyRewrite = () => {
    if (!selectedTarget || !output.trim()) return;
    const cleaned = cleanLocalAIRewrite(output);
    if (selectedTarget.field) onUpdateField(selectedTarget.field, cleaned);
    else if (selectedTarget.section !== undefined && selectedTarget.index !== undefined) {
      onUpdateEntry(selectedTarget.section, selectedTarget.index, cleaned);
    }
    setDraft(cleaned);
    setOutput("");
  };

  const isCached = modelState === "cached" || modelState === "ready";
  const setupBusy = modelState === "checking" || modelState === "loading" || modelState === "removing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <Sparkles className="size-5" aria-hidden="true" />
            <DialogTitle>Local AI</DialogTitle>
            <Badge variant="secondary">Experimental</Badge>
          </div>
          <DialogDescription>
            Optional resume assistance powered by WebLLM. Resume content and generation stay in this browser.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-300 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/40">
          <AlertCircle className="size-4 text-amber-800 dark:text-amber-300" />
          <AlertTitle className="text-amber-950 dark:text-amber-100">Device support and model limitations</AlertTitle>
          <AlertDescription className="space-y-1 text-amber-950 dark:text-amber-100/90">
            <p>{deviceDetail}</p>
            <p>
              WebGPU support, speed, and available memory vary by browser and device. Mobile and older GPUs may fail. Suggestions can be inaccurate, so nothing is applied without your review.
            </p>
          </AlertDescription>
        </Alert>

        <section className="space-y-3 rounded-lg border p-4" aria-labelledby="local-ai-setup-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="local-ai-setup-title" className="text-sm font-semibold">1. Prepare a model</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                Nothing downloads automatically. Your first setup fetches public model files from MLC/Hugging Face, then caches them in this browser. Loading a cached model still takes a moment each visit.
              </p>
            </div>
            <Badge variant={modelState === "ready" ? "secondary" : "outline"} className={modelState === "ready" ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200" : undefined}>
              {modelState === "ready" ? "Ready" : isCached ? "Downloaded" : modelState === "not-cached" ? "Not downloaded" : modelState === "loading" ? "Preparing" : modelState === "removing" ? "Removing" : modelState === "error" ? "Needs attention" : "Checking cache"}
            </Badge>
          </div>

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Model
            <select
              value={modelId}
              disabled={setupBusy || generating}
              onChange={(event) => changeModel(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LOCAL_AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} — {model.memory}{model.recommended ? " — recommended" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{selectedModel.label}:</span> {selectedModel.description} {selectedModel.memory} at WebLLM&apos;s published configuration.
            {lowMemoryDevice && !selectedModel.recommended ? <span className="ml-1 text-amber-700 dark:text-amber-300">The smaller model is safer for this device.</span> : null}
          </div>

          {modelState === "loading" ? (
            <div className="space-y-1.5" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{Math.round(progress * 100)}% · {progressText || "Downloading and loading model…"}</p>
            </div>
          ) : null}

          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={prepareModel}
              disabled={deviceState !== "supported" || setupBusy || modelState === "ready"}
            >
              {modelState === "loading" ? <Loader2 className="animate-spin" /> : modelState === "ready" ? <Check /> : isCached ? <Cpu /> : <Download />}
              {modelState === "loading" ? "Preparing…" : modelState === "ready" ? "Model ready" : isCached ? "Load cached model" : "Download and load model"}
            </Button>
            {isCached ? (
              <Button type="button" variant="outline" onClick={removeModel} disabled={setupBusy || generating}>
                <Trash2 /> Remove download
              </Button>
            ) : null}
            <Button type="button" variant="ghost" asChild>
              <a href="https://github.com/mlc-ai/web-llm" target="_blank" rel="noreferrer">About WebLLM</a>
            </Button>
          </div>
        </section>

        <section className={cn("space-y-4 rounded-lg border p-4", modelState !== "ready" && "opacity-60")} aria-labelledby="local-ai-use-title">
          <div>
            <h3 id="local-ai-use-title" className="text-sm font-semibold">2. Use local assistance</h3>
            <p className="mt-1 text-xs text-muted-foreground">Small, focused requests reduce latency and are more dependable on compact models.</p>
          </div>

          <div className="grid grid-cols-2 rounded-md border bg-muted/30 p-1" aria-label="Local AI task">
            <Button type="button" size="sm" variant={task === "rewrite" ? "secondary" : "ghost"} aria-pressed={task === "rewrite"} onClick={() => { setTask("rewrite"); setOutput(""); }} disabled={modelState !== "ready" || generating}>
              Rewrite a field
            </Button>
            <Button type="button" size="sm" variant={task === "parser-review" ? "secondary" : "ghost"} aria-pressed={task === "parser-review"} onClick={() => { setTask("parser-review"); setOutput(""); }} disabled={modelState !== "ready" || generating || !importSourceText?.trim()}>
              Check import mapping
            </Button>
          </div>

          {task === "rewrite" ? (
            targets.length ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                    Resume field
                    <select
                      value={selectedTarget?.id ?? ""}
                      disabled={modelState !== "ready" || generating}
                      onChange={(event) => {
                        const target = targets.find((item) => item.id === event.target.value);
                        if (!target) return;
                        setTargetId(target.id);
                        setDraft(target.value);
                        setOutput("");
                      }}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                    Goal
                    <select
                      value={goal}
                      disabled={modelState !== "ready" || generating}
                      onChange={(event) => setGoal(event.target.value as LocalAIRewriteGoal)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="strengthen">Strengthen and clarify</option>
                      <option value="grammar">Fix grammar</option>
                      <option value="shorten">Shorten</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                  Text sent to the local model
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} disabled={modelState !== "ready" || generating} className="min-h-28" />
                </label>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Add a summary, skills, or entry details to create a focused rewrite.</p>
            )
          ) : importSourceText?.trim() ? (
            <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
              The model will compare the locally extracted source with the parsed draft and flag up to five likely omissions or field swaps. It will not change the resume.
            </p>
          ) : (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Import a PDF, Word file, or pasted resume in this session to check its source mapping. Full source text is intentionally not kept in browser storage after a refresh.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {generating ? (
              <Button type="button" variant="outline" onClick={stopGeneration}><Square /> Stop</Button>
            ) : (
              <Button type="button" onClick={generate} disabled={modelState !== "ready" || (task === "rewrite" ? !draft.trim() || !selectedTarget : !importSourceText?.trim())}>
                <Sparkles /> {task === "rewrite" ? "Generate suggestion" : "Review mapping"}
              </Button>
            )}
          </div>

          {output || generating ? (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Suggestion</p>
                {generating ? <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Generating locally</span> : null}
              </div>
              <div className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm leading-relaxed">{output || "Starting…"}</div>
              {task === "rewrite" && !generating && output.trim() ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={applyRewrite}><Check /> Apply to resume</Button>
                  <span className="text-xs text-muted-foreground">Review facts and wording before applying.</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}
