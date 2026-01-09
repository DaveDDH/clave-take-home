import {
  HELICONE_KEY,
  OPENAI_API_KEY,
  OPENAI_MODEL,
} from "#constants/index.js";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, generateObject, streamText, LanguageModel } from "ai";
import { z } from "zod";
import { log } from "#utils/logger.js";
import type { TokenUsage } from "#utils/cost.js";

export interface LLMResultWithUsage<T> {
  result: T;
  usage: TokenUsage;
}

export const getOpenAIProvider = () => {
  if (HELICONE_KEY)
    return createOpenAI({
      baseURL: "https://oai.helicone.ai/v1",
      headers: {
        "Helicone-Auth": `Bearer ${HELICONE_KEY}`,
      },
    });
  return createOpenAI({
    apiKey: OPENAI_API_KEY,
  });
};

export const getOpenAIModel = (): LanguageModel => {
  const provider = getOpenAIProvider();
  return provider(OPENAI_MODEL);
};

export async function generateTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<LLMResultWithUsage<string>> {
  const label = options?.label || "OpenAI Text Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting OpenAI LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0}`,
    undefined,
    processId
  );
  log(`      Model: ${OPENAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getOpenAIModel();
  const response = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] OpenAI call completed in ${duration}ms`,
    undefined,
    processId
  );
  log(`      Response length: ${response.text.length} characters`, undefined, processId);

  const usage: TokenUsage = {
    promptTokens: response.usage.inputTokens ?? 0,
    completionTokens: response.usage.outputTokens ?? 0,
    cachedTokens: response.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };

  return { result: response.text, usage };
}

export async function generateObjectResponse<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<LLMResultWithUsage<T>> {
  const label = options?.label || "OpenAI Object Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting OpenAI LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0}`,
    undefined,
    processId
  );
  log(`      Model: ${OPENAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getOpenAIModel();
  const response = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
    temperature: options?.temperature ?? 0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] OpenAI call completed in ${duration}ms`,
    undefined,
    processId
  );
  log(`      Response type: structured object`, undefined, processId);

  const usage: TokenUsage = {
    promptTokens: response.usage.inputTokens ?? 0,
    completionTokens: response.usage.outputTokens ?? 0,
    cachedTokens: response.usage.inputTokenDetails?.cacheReadTokens ?? 0,
  };

  return { result: response.object, usage };
}

export async function streamTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; label?: string; processId?: string },
  onToken: (token: string) => void
): Promise<LLMResultWithUsage<string>> {
  const label = options?.label || "OpenAI Streaming Generation";
  const processId = options?.processId;

  log(
    `   🤖 [${label}] Starting streaming OpenAI call...`,
    undefined,
    processId
  );
  log(
    `      Temperature: ${options?.temperature ?? 0}`,
    undefined,
    processId
  );
  log(`      Model: ${OPENAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getOpenAIModel();
  const result = await streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0,
  });

  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    onToken(chunk);
  }

  // Usage is available after streaming completes
  const finalUsage = await result.usage;

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] OpenAI streaming completed in ${duration}ms`,
    undefined,
    processId
  );
  log(
    `      Response length: ${fullText.length} characters`,
    undefined,
    processId
  );

  const usage: TokenUsage = {
    promptTokens: finalUsage.inputTokens ?? 0,
    completionTokens: finalUsage.outputTokens ?? 0,
    cachedTokens: finalUsage.inputTokenDetails?.cacheReadTokens ?? 0,
  };

  return { result: fullText, usage };
}
