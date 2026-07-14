export const LOCAL_AI_MODELS = [
  {
    id: "Qwen3-1.7B-q4f16_1-MLC",
    label: "Qwen 3 1.7B",
    description: "Best balance of rewrite quality and support across WebGPU devices.",
    memory: "~2.0 GB GPU memory",
    recommended: true,
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    description: "Lower-memory fallback for devices that cannot load the recommended model.",
    memory: "~880 MB GPU memory",
    recommended: false,
  },
] as const;

export type LocalAIModelId = (typeof LOCAL_AI_MODELS)[number]["id"];

export function isLocalAIModelId(value: string): value is LocalAIModelId {
  return LOCAL_AI_MODELS.some((model) => model.id === value);
}
