"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Cpu, Download, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  disposeLocalAIRuntime,
  friendlyLocalAIError,
  getLocalAIRuntime,
  legacyLocalAIAppConfig,
  LOCAL_AI_CACHE_MIGRATION_STORAGE_KEY,
  loadLocalAIModel,
  localAIAppConfig,
} from "@/lib/local-ai-engine";
import {
  LOCAL_AI_MODELS,
  LOCAL_AI_MODEL_STORAGE_KEY,
  isLocalAIModelId,
  type LocalAIModelId,
} from "@/lib/local-ai";

type ModelState = "checking" | "not-cached" | "cached" | "loading" | "ready" | "removing" | "error";
type DeviceState = "checking" | "supported" | "unsupported";
type GPUAdapterLike = { features?: { has: (feature: string) => boolean } };
type NavigatorWithGPU = Navigator & {
  gpu?: { requestAdapter: () => Promise<GPUAdapterLike | null> };
  deviceMemory?: number;
};

export function LocalAIDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [modelId, setModelId] = useState<LocalAIModelId>(LOCAL_AI_MODELS[0].id);
  const [modelState, setModelState] = useState<ModelState>("checking");
  const [deviceState, setDeviceState] = useState<DeviceState>("checking");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const modelSelectRef = useRef<HTMLSelectElement>(null);
  const selectedModel = LOCAL_AI_MODELS.find((model) => model.id === modelId) ?? LOCAL_AI_MODELS[0];
  const lowMemoryDevice =
    typeof navigator !== "undefined" && (navigator as NavigatorWithGPU).deviceMemory !== undefined
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
        return;
      }
      try {
        const adapter = await gpu.requestAdapter();
        if (!active) return;
        if (!adapter) {
          setDeviceState("unsupported");
          return;
        }
        setDeviceState("supported");
      } catch {
        if (!active) return;
        setDeviceState("unsupported");
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
      if (getLocalAIRuntime()?.modelId === modelId) {
        setModelState("ready");
        return;
      }
      setModelState("checking");
      setError(null);
      try {
        const webllm = await import("@mlc-ai/web-llm");
        let migrated = false;
        try {
          migrated = localStorage.getItem(LOCAL_AI_CACHE_MIGRATION_STORAGE_KEY) === "1";
        } catch {
          // The versioned model URL still bypasses old cache entries when
          // localStorage is unavailable.
        }
        if (!migrated) {
          await Promise.allSettled(
            LOCAL_AI_MODELS.map((model) =>
              webllm.deleteModelAllInfoInCache(model.id, legacyLocalAIAppConfig(webllm)),
            ),
          );
          try {
            localStorage.setItem(LOCAL_AI_CACHE_MIGRATION_STORAGE_KEY, "1");
          } catch {
            // Cache cleanup is best effort; the new URL is the hard boundary.
          }
        }
        const cached = await webllm.hasModelInCache(modelId, localAIAppConfig(webllm));
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

  const changeModel = (next: string) => {
    if (!isLocalAIModelId(next)) return;
    setModelId(next);
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
      const webllm = await import("@mlc-ai/web-llm");
      try {
        await loadLocalAIModel({
          webllm,
          modelId,
          onProgress: (report) => {
            setProgress(Math.max(0, Math.min(1, report.progress)));
            setProgressText(report.text);
          },
        });
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        if (/TensorCopyFromBytes|arr_size\s*==\s*nbytes|size mismatch/i.test(message)) {
          try {
            await webllm.deleteModelAllInfoInCache(modelId, localAIAppConfig(webllm));
          } catch {
            // Keep the original load error; the user can still remove the
            // download manually if browser storage cleanup was blocked.
          }
        }
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
      if (getLocalAIRuntime()?.modelId === modelId) await disposeLocalAIRuntime();
      const webllm = await import("@mlc-ai/web-llm");
      await webllm.deleteModelAllInfoInCache(modelId, localAIAppConfig(webllm));
      setModelState("not-cached");
      setProgress(0);
      setProgressText("");
    } catch (removeError) {
      setModelState("error");
      setError(friendlyLocalAIError(removeError));
    }
  };

  const isCached = modelState === "cached" || modelState === "ready";
  const setupBusy =
    modelState === "checking" || modelState === "loading" || modelState === "removing";
  const modelSelectionBusy = modelState === "loading" || modelState === "removing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() => modelSelectRef.current?.focus());
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <Sparkles className="size-5" aria-hidden="true" />
            <DialogTitle>Local AI setup</DialogTitle>
            <Badge variant="secondary">Experimental</Badge>
          </div>
        </DialogHeader>

        <Alert className="border-warning/40 bg-warning/10 pl-4">
          <AlertTitle>Local AI can vary by device</AlertTitle>
          <AlertDescription>
            Performance may be slower on some devices, and suggestions may be inaccurate. Review
            every change before applying it.
          </AlertDescription>
        </Alert>

        <section className="space-y-3 rounded-lg border p-4" aria-labelledby="local-ai-setup-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="local-ai-setup-title" className="text-sm font-semibold">
                Prepare a model
              </h3>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                Downloads an open-source model from Hugging Face and caches it in this browser.
              </p>
            </div>
            <Badge
              variant={modelState === "ready" ? "secondary" : "outline"}
              className={modelState === "ready" ? "bg-success/15 text-success" : undefined}
            >
              {modelState === "ready"
                ? "Ready"
                : isCached
                  ? "Downloaded"
                  : modelState === "not-cached"
                    ? "Not downloaded"
                    : modelState === "loading"
                      ? "Preparing"
                      : modelState === "removing"
                        ? "Removing"
                        : modelState === "error"
                          ? "Needs attention"
                          : "Checking cache"}
            </Badge>
          </div>

          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Model
            <Select
              ref={modelSelectRef}
              value={modelId}
              disabled={modelSelectionBusy}
              onChange={(event) => changeModel(event.target.value)}
              className="h-10"
            >
              {LOCAL_AI_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} — {model.memory}
                  {model.recommended ? " — recommended" : ""}
                </option>
              ))}
            </Select>
          </label>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{selectedModel.label}:</span>{" "}
            {selectedModel.description} {selectedModel.memory} at WebLLM&apos;s published
            configuration.
            {lowMemoryDevice && selectedModel.recommended ? (
              <span className="ml-1 text-warning">
                If loading fails, try the lower-memory model.
              </span>
            ) : null}
          </div>

          {modelState === "loading" ? (
            <div className="space-y-1.5" aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {Math.round(progress * 100)}% · {progressText || "Downloading and loading model…"}
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {deviceState === "unsupported" ? (
            <p role="status" className="text-sm text-muted-foreground">
              Local AI isn&apos;t available in this browser or on this device.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={prepareModel}
              disabled={deviceState !== "supported" || setupBusy || modelState === "ready"}
            >
              {modelState === "loading" ? (
                <Loader2 className="animate-spin" />
              ) : modelState === "ready" ? (
                <Check />
              ) : isCached ? (
                <Cpu />
              ) : (
                <Download />
              )}
              {modelState === "loading"
                ? "Preparing…"
                : modelState === "ready"
                  ? "Model ready"
                  : isCached
                    ? "Load cached model"
                    : "Download and load model"}
            </Button>
            {isCached ? (
              <Button type="button" variant="outline" onClick={removeModel} disabled={setupBusy}>
                <Trash2 /> Remove download
              </Button>
            ) : null}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
