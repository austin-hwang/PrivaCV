import type { ChatCompletionMessageParam, MLCEngineInterface } from "@mlc-ai/web-llm";
import { isLocalAIModelId, type LocalAIModelId } from "@/lib/local-ai";

type LocalAIRuntime = {
  engine: MLCEngineInterface;
  modelId: LocalAIModelId;
  worker: Worker;
};

let runtime: LocalAIRuntime | null = null;
let generating = false;

export function localAIAppConfig(webllm: typeof import("@mlc-ai/web-llm")) {
  return {
    ...webllm.prebuiltAppConfig,
    model_list: webllm.prebuiltAppConfig.model_list
      .filter((model) => isLocalAIModelId(model.model_id))
      .map((model) => ({
        ...model,
        model: new URL(
          `/api/local-ai/models/${encodeURIComponent(model.model_id)}/resolve/main/`,
          window.location.origin,
        ).href,
      })),
  };
}

export function getLocalAIRuntime() {
  return runtime;
}

export function setLocalAIRuntime(next: LocalAIRuntime) {
  runtime = next;
}

export async function disposeLocalAIRuntime() {
  const current = runtime;
  runtime = null;
  generating = false;
  if (!current) return;
  try {
    await current.engine.unload();
  } catch {
    // The worker may already be unavailable after a WebGPU/device failure.
  } finally {
    current.worker.terminate();
  }
}

export function interruptLocalAIGeneration() {
  runtime?.engine.interruptGenerate();
  generating = false;
}

export async function generateLocalAIText({
  messages,
  maxTokens,
  json = false,
  onToken,
}: {
  messages: ChatCompletionMessageParam[];
  maxTokens: number;
  json?: boolean;
  onToken?: (text: string) => void;
}) {
  const current = runtime;
  if (!current) throw new Error("Set up and load a local model first.");
  if (generating) throw new Error("Local AI is already working on another edit.");

  generating = true;
  try {
    await current.engine.resetChat();
    const chunks = await current.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: json ? 0 : 0.2,
      top_p: 0.9,
      max_tokens: maxTokens,
      response_format: json ? { type: "json_object" } : undefined,
    });
    let result = "";
    for await (const chunk of chunks) {
      result += chunk.choices[0]?.delta.content ?? "";
      onToken?.(result);
    }
    return result;
  } finally {
    generating = false;
  }
}

export function friendlyLocalAIError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/TensorCopyFromBytes|arr_size\s*==\s*nbytes|size mismatch/i.test(message)) {
    return "The model download was incomplete and its cached files were removed. Download the model again.";
  }
  if (/webgpu|gpu adapter|navigator\.gpu/i.test(message)) {
    return "WebGPU could not start on this browser or device. Try an up-to-date browser with hardware acceleration enabled.";
  }
  if (/memory|allocation|device lost|buffer/i.test(message)) {
    return "The model ran out of available GPU memory. Close other heavy tabs or try the smaller model.";
  }
  if (/cors|failed to fetch|network|fetch/i.test(message)) {
    return "The model download could not be reached. Check your connection or browser privacy settings, then try again.";
  }
  return message || "Local AI could not start.";
}
