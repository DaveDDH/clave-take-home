import { createXai } from "@ai-sdk/xai";
import { generateText, generateObject, streamText } from "ai";
import { z } from "zod";

import { XAI_API_KEY, XAI_MODEL } from "#constants/index.js";
import { log } from "#utils/logger.js";
import type { TokenUsage } from "#utils/cost.js";

export interface LLMResultWithUsage<T> {
  result: T;
  usage: TokenUsage;
}

export const getXAIProvider = () => {
  return createXai({
    apiKey: XAI_API_KEY,
  });
};

export const getGrokModel = () => {
  const provider = getXAIProvider();
  return provider(XAI_MODEL);
};

export async function generateTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<LLMResultWithUsage<string>> {
  const label = options?.label || "LLM Text Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0}`,
    undefined,
    processId
  );
  log(`      Model: ${XAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGrokModel();
  const response = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] LLM call completed in ${duration}ms (${(
      duration / 1000
    ).toFixed(2)}s)`,
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
  const label = options?.label || "LLM Object Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0}`,
    undefined,
    processId
  );
  log(`      Model: ${XAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGrokModel();
  const response = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
    temperature: options?.temperature ?? 0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] LLM call completed in ${duration}ms (${(
      duration / 1000
    ).toFixed(2)}s)`,
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
  const label = options?.label || "LLM Streaming Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting streaming LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0}`,
    undefined,
    processId
  );
  log(`      Model: ${XAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGrokModel();
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
    `   ✅ [${label}] Streaming LLM call completed in ${duration}ms (${(
      duration / 1000
    ).toFixed(2)}s)`,
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
