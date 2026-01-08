import { z } from "zod";
import * as xai from "./xai/index.js";
import * as groq from "./groq/index.js";
import * as openai from "./openai/index.js";
import type { TokenUsage } from "#utils/cost.js";

// Using a const array + typeof for runtime + type export
export const MODEL_IDS = ["grok-4.1-fast", "gpt-5.2", "gpt-oss-20b"] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const DEFAULT_MODEL: ModelId = "grok-4.1-fast";

export const AVAILABLE_MODELS: { id: ModelId; name: string; provider: string }[] = [
  { id: "grok-4.1-fast", name: "Grok 4.1 Fast", provider: "xAI" },
  { id: "gpt-5.2", name: "GPT 5.2", provider: "OpenAI" },
  { id: "gpt-oss-20b", name: "GPT-OSS 20B", provider: "Groq" },
];

export interface LLMResult<T> {
  result: T;
  usage: TokenUsage;
  model: ModelId;
}

function getProviderForModel(modelId: ModelId) {
  switch (modelId) {
    case "grok-4.1-fast":
      return xai;
    case "gpt-5.2":
      return openai;
    case "gpt-oss-20b":
      return groq;
    default:
      throw new Error(`Unknown model: ${modelId}`);
  }
}

export async function generateTextResponse(
  modelId: ModelId,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<LLMResult<string>> {
  const label = options?.label ?? "Text Generation";
  console.log(`[LLM] ${label} using model: ${modelId}`);
  const provider = getProviderForModel(modelId);
  const { result, usage } = await provider.generateTextResponse(systemPrompt, userPrompt, options);
  return { result, usage, model: modelId };
}

export async function generateObjectResponse<T>(
  modelId: ModelId,
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<LLMResult<T>> {
  const label = options?.label ?? "Object Generation";
  console.log(`[LLM] ${label} using model: ${modelId}`);
  const provider = getProviderForModel(modelId);
  const { result, usage } = await provider.generateObjectResponse(systemPrompt, userPrompt, schema, options);
  return { result, usage, model: modelId };
}

export async function streamTextResponse(
  modelId: ModelId,
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; label?: string; processId?: string },
  onToken: (token: string) => void
): Promise<LLMResult<string>> {
  const label = options?.label ?? "Stream Generation";
  console.log(`[LLM] ${label} using model: ${modelId}`);
  const provider = getProviderForModel(modelId);
  const { result, usage } = await provider.streamTextResponse(systemPrompt, userPrompt, options, onToken);
  return { result, usage, model: modelId };
}
