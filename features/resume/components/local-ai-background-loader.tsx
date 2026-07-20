"use client";

import { useEffect } from "react";
import {
  getLocalAIRuntime,
  isLocalAIModelFullyCached,
  loadLocalAIModel,
} from "@/lib/local-ai-engine";
import {
  isLocalAIModelId,
  LOCAL_AI_MODELS,
  LOCAL_AI_MODEL_STORAGE_KEY,
  type LocalAIModelId,
} from "@/lib/local-ai";

type NavigatorWithGPU = Navigator & {
  gpu?: { requestAdapter: () => Promise<unknown | null> };
};

export function LocalAIBackgroundLoader() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (getLocalAIRuntime() || !window.isSecureContext) return;
      const gpu = (navigator as NavigatorWithGPU).gpu;
      if (!gpu || !(await gpu.requestAdapter()) || cancelled) return;

      const webllm = await import("@mlc-ai/web-llm");
      let savedModel: LocalAIModelId | undefined;
      try {
        const saved = localStorage.getItem(LOCAL_AI_MODEL_STORAGE_KEY);
        if (saved && isLocalAIModelId(saved)) savedModel = saved;
      } catch {
        // Cache discovery can still find a downloaded model without a saved preference.
      }
      const candidates = [
        ...(savedModel ? [savedModel] : []),
        ...LOCAL_AI_MODELS.map((model) => model.id).filter((id) => id !== savedModel),
      ];
      for (const modelId of candidates) {
        if (cancelled) return;
        if (await isLocalAIModelFullyCached(webllm, modelId)) {
          if (!cancelled) await loadLocalAIModel({ webllm, modelId });
          return;
        }
      }
    };

    const start = () => void run().catch(() => {
      // Background loading is opportunistic. Setup remains the visible recovery path.
    });
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const handle = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(start, { timeout: 2_000 })
      : window.setTimeout(start, 750);

    return () => {
      cancelled = true;
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);

  return null;
}
