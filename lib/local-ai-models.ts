export const LOCAL_AI_MODELS = [
  {
    id: "SmolLM2-360M-Instruct-q4f32_1-MLC",
    label: "SmolLM2 360M",
    description: "Fastest option for grammar, shortening, and simple rewrites.",
    memory: "~580 MB GPU memory",
    recommended: true,
  },
  {
    id: "Qwen3-0.6B-q4f16_1-MLC",
    label: "Qwen 3 0.6B",
    description: "Newer multilingual option with stronger rewrite quality than the smallest model.",
    memory: "~1.4 GB GPU memory",
    recommended: false,
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B",
    description: "Stronger suggestions, with a larger download and slower responses.",
    memory: "~880 MB GPU memory",
    recommended: false,
  },
] as const;

export type LocalAIModelId = (typeof LOCAL_AI_MODELS)[number]["id"];

export function isLocalAIModelId(value: string): value is LocalAIModelId {
  return LOCAL_AI_MODELS.some((model) => model.id === value);
}
