import type { ChatCompletionMessageParam, InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";
import { isLocalAIModelId, LOCAL_AI_MODEL_STORAGE_KEY, type LocalAIModelId } from "@/lib/local-ai";

type LocalAIRuntime = {
  engine: MLCEngineInterface;
  modelId: LocalAIModelId;
  worker: Worker;
};

let runtime: LocalAIRuntime | null = null;
let loadingRuntime: { modelId: LocalAIModelId; worker: Worker; token: object; promise: Promise<LocalAIRuntime> } | null = null;
let generating = false;
const LOCAL_AI_CACHE_PATH_VERSION = "webllm-cache-v2";
const QWEN3_CACHE_PATH_VERSION = "webllm-cache-v2-qwen3";
export const LOCAL_AI_CACHE_MIGRATION_STORAGE_KEY = "resume-editor-local-ai-cache-v2-migrated";
const WEBLLM_CACHE_NAMES = ["webllm/model", "webllm/config", "webllm/wasm", "tvmjs"];
export const LOCAL_AI_RUNTIME_CHANGE_EVENT = "resume-editor-local-ai-runtime-change";

function announceRuntimeChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_AI_RUNTIME_CHANGE_EVENT));
}

function appConfigForModelPath(
  webllm: typeof import("@mlc-ai/web-llm"),
  pathSuffixForModel: (modelId: LocalAIModelId) => string,
) {
  return {
    ...webllm.prebuiltAppConfig,
    model_list: webllm.prebuiltAppConfig.model_list
      .filter((model) => isLocalAIModelId(model.model_id))
      .map((model) => {
        const pathSuffix = pathSuffixForModel(model.model_id as LocalAIModelId);
        return {
          ...model,
          model: new URL(
            `/api/local-ai/models/${encodeURIComponent(model.model_id)}/resolve/main/${pathSuffix}`,
            window.location.origin,
          ).href,
        };
      }),
  };
}

export function localAIModelCachePath(modelId: LocalAIModelId) {
  return modelId.startsWith("Qwen3") ? QWEN3_CACHE_PATH_VERSION : LOCAL_AI_CACHE_PATH_VERSION;
}

export function localAIAppConfig(webllm: typeof import("@mlc-ai/web-llm")) {
  return appConfigForModelPath(webllm, (modelId) => `${localAIModelCachePath(modelId)}/`);
}

export function legacyLocalAIAppConfig(webllm: typeof import("@mlc-ai/web-llm")) {
  return appConfigForModelPath(webllm, () => "");
}

export function getLocalAIRuntime() {
  return runtime;
}

export function setLocalAIRuntime(next: LocalAIRuntime) {
  runtime = next;
  announceRuntimeChange();
}

export async function disposeLocalAIRuntime() {
  if (loadingRuntime) {
    loadingRuntime.worker.terminate();
    loadingRuntime = null;
  }
  const current = runtime;
  runtime = null;
  generating = false;
  announceRuntimeChange();
  if (!current) return;
  try {
    await current.engine.unload();
  } catch {
    // The worker may already be unavailable after a WebGPU/device failure.
  } finally {
    current.worker.terminate();
  }
}

export async function loadLocalAIModel({
  webllm,
  modelId,
  onProgress,
}: {
  webllm: typeof import("@mlc-ai/web-llm");
  modelId: LocalAIModelId;
  onProgress?: (report: InitProgressReport) => void;
}) {
  if (runtime?.modelId === modelId) return runtime;
  if (loadingRuntime?.modelId === modelId) return loadingRuntime.promise;
  await disposeLocalAIRuntime();

  const worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
  const token = {};
  const loadPromise = (async () => {
    try {
      const engine = await webllm.CreateWebWorkerMLCEngine(
        worker,
        modelId,
        {
          appConfig: localAIAppConfig(webllm),
          initProgressCallback: onProgress,
          logLevel: "WARN",
        },
        { context_window_size: 4096 },
      );
      if (loadingRuntime?.token !== token) {
        await engine.unload().catch(() => undefined);
        worker.terminate();
        throw new Error("Local AI loading was cancelled.");
      }
      const next = { engine, modelId, worker };
      setLocalAIRuntime(next);
      return next;
    } catch (error) {
      worker.terminate();
      throw error;
    } finally {
      if (loadingRuntime?.token === token) loadingRuntime = null;
    }
  })();
  loadingRuntime = { modelId, worker, token, promise: loadPromise };
  return loadPromise;
}

export async function isLocalAIModelFullyCached(
  webllm: typeof import("@mlc-ai/web-llm"),
  modelId: LocalAIModelId,
) {
  if (typeof caches === "undefined") return false;
  const appConfig = localAIAppConfig(webllm);
  if (!(await webllm.hasModelInCache(modelId, appConfig))) return false;
  const modelRecord = appConfig.model_list.find((model) => model.model_id === modelId);
  if (!modelRecord) return false;

  const modelUrl = modelRecord.model.endsWith("/") ? modelRecord.model : `${modelRecord.model}/`;
  const configUrl = new URL("mlc-chat-config.json", modelUrl).href;
  const [configCache, modelCache, wasmCache] = await Promise.all([
    caches.open("webllm/config"),
    caches.open("webllm/model"),
    caches.open("webllm/wasm"),
  ]);
  const configResponse = await configCache.match(configUrl);
  if (!configResponse) return false;

  let tokenizerFile: string | undefined;
  try {
    const config = await configResponse.clone().json() as { tokenizer_files?: unknown };
    if (Array.isArray(config.tokenizer_files)) {
      tokenizerFile = config.tokenizer_files.includes("tokenizer.json")
        ? "tokenizer.json"
        : config.tokenizer_files.includes("tokenizer.model")
          ? "tokenizer.model"
          : undefined;
    }
  } catch {
    return false;
  }
  if (!tokenizerFile || !(await modelCache.match(new URL(tokenizerFile, modelUrl).href))) return false;
  return Boolean(await wasmCache.match(modelRecord.model_lib));
}

export async function clearAllLocalAIData() {
  await disposeLocalAIRuntime();
  if (typeof caches !== "undefined") {
    const names = await caches.keys().catch(() => []);
    await Promise.allSettled(
      names
        .filter((name) => WEBLLM_CACHE_NAMES.includes(name) || name.startsWith("webllm/"))
        .map((name) => caches.delete(name)),
    );
  }
  try {
    localStorage.removeItem(LOCAL_AI_MODEL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_AI_CACHE_MIGRATION_STORAGE_KEY);
  } catch {
    // Clearing resume storage still proceeds if browser privacy settings block
    // access to optional Local AI preferences.
  }
}

export function interruptLocalAIGeneration() {
  runtime?.engine.interruptGenerate();
  generating = false;
}

export function localAIChatExtraBody(modelId: LocalAIModelId) {
  return modelId.startsWith("Qwen3") ? { enable_thinking: false as const } : undefined;
}

export async function generateLocalAIText({
  messages,
  maxTokens,
  jsonSchema,
  onToken,
}: {
  messages: ChatCompletionMessageParam[];
  maxTokens: number;
  jsonSchema?: string;
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
      temperature: jsonSchema ? 0 : 0.2,
      top_p: 0.9,
      max_tokens: maxTokens,
      response_format: jsonSchema ? { type: "json_object", schema: jsonSchema } : undefined,
      extra_body: localAIChatExtraBody(current.modelId),
    });
    let result = "";
    let finishReason: string | null = null;
    for await (const chunk of chunks) {
      const choice = chunk.choices[0];
      result += choice?.delta.content ?? "";
      finishReason = choice?.finish_reason ?? finishReason;
      onToken?.(result);
    }
    if (finishReason === "length") {
      throw new Error("The model response was cut off before it finished. Try a smaller edit or a larger model.");
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
