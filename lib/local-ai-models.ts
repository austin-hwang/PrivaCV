export const LOCAL_AI_MODELS = [
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    description: "Recommended for stronger rewrites on most modern WebGPU devices.",
    memory: "~2.3 GB GPU memory",
    recommended: true,
  },
  {
    id: "Phi-4-mini-instruct-q4f16_1-MLC",
    label: "Phi-4 Mini",
    description: "Higher-capability option for devices with more available GPU memory.",
    memory: "~3.4 GB GPU memory",
    recommended: false,
  },
  {
    id: "DeepSeek-R1-Distill-Llama-8B-q4f16_1-MLC",
    label: "DeepSeek R1 Llama 8B",
    description: "Reasoning-focused option for high-memory devices; edits can be significantly slower.",
    memory: "~5.0 GB GPU memory",
    recommended: false,
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
