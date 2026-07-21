"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Cpu, Download, Sparkles, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    <Dialog isOpen={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogHeader>
        <div className="flex items-center gap-2 pr-8">
          <Sparkles className="size-5" aria-hidden="true" />
          <DialogTitle>Local AI setup</DialogTitle>
          <Badge variant="secondary">Experimental</Badge>
        </div>
      </DialogHeader>

      <Alert variant="warning" className="pl-4">
        <AlertTitle>Local AI can vary by device</AlertTitle>
        <AlertDescription>
          Performance may be slower on some devices, and suggestions may be inaccurate. Review every
          change before applying it.
        </AlertDescription>
      </Alert>

      <Card aria-labelledby="local-ai-setup-title">
        <CardHeader>
          <CardTitle id="local-ai-setup-title">Prepare a model</CardTitle>
          <CardDescription>
            Downloads an open-source model from Hugging Face and caches it in this browser.
          </CardDescription>
          <CardAction>
            <Badge variant={modelState === "ready" ? "secondary" : "outline"}>
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
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <Field>
            <FieldLabel>Model</FieldLabel>
            <Select
              selectedKey={modelId}
              isDisabled={modelSelectionBusy}
              onSelectionChange={(key) => changeModel(String(key))}
              aria-label="Model"
              autoFocus
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LOCAL_AI_MODELS.map((model) => (
                    <SelectItem
                      key={model.id}
                      id={model.id}
                      textValue={`${model.label} — ${model.memory}${model.recommended ? " — recommended" : ""}`}
                    >
                      {model.label} — {model.memory}
                      {model.recommended ? " — recommended" : ""}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              <span className="font-medium text-foreground">{selectedModel.label}:</span>{" "}
              {selectedModel.description} {selectedModel.memory} at WebLLM&apos;s published
              configuration.
              {lowMemoryDevice && selectedModel.recommended ? (
                <span className="ml-1 text-warning">
                  If loading fails, try the lower-memory model.
                </span>
              ) : null}
            </FieldDescription>
          </Field>

          {modelState === "loading" ? (
            <div className="flex flex-col gap-1.5" aria-live="polite">
              <Progress aria-label="Preparing local AI model" value={progress * 100} />
              <p className="text-xs text-muted-foreground">
                {Math.round(progress * 100)}% · {progressText || "Downloading and loading model…"}
              </p>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Local AI setup failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
              isDisabled={deviceState !== "supported" || setupBusy || modelState === "ready"}
            >
              {modelState === "loading" ? (
                <Spinner data-icon="inline-start" />
              ) : modelState === "ready" ? (
                <Check data-icon="inline-start" />
              ) : isCached ? (
                <Cpu data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
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
              <AlertDialogTrigger>
                <Button type="button" variant="outline" isDisabled={setupBusy}>
                  <Trash2 data-icon="inline-start" /> Remove download
                </Button>
                <AlertDialog>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove this model download?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {selectedModel.label} model files will be removed from this browser. You can
                      download them again later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onPress={() => void removeModel()}>
                      Remove download
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialog>
              </AlertDialogTrigger>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Dialog>
  );
}
