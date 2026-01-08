import { createXai } from "@ai-sdk/xai";
import { generateText, generateObject, streamText } from "ai";
import { z } from "zod";

import { XAI_API_KEY, XAI_MODEL } from "#constants/index.js";
import { log } from "#utils/logger.js";

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
): Promise<string> {
  const label = options?.label || "LLM Text Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${XAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGrokModel();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] LLM call completed in ${duration}ms (${(
      duration / 1000
    ).toFixed(2)}s)`,
    undefined,
    processId
  );
  log(`      Response length: ${text.length} characters`, undefined, processId);

  return text;
}

export async function generateObjectResponse<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<T> {
  const label = options?.label || "LLM Object Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${XAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGrokModel();
  const { object } = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
    temperature: options?.temperature ?? 0.0,
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

  return object;
}

export async function streamTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; label?: string; processId?: string },
  onToken: (token: string) => void
): Promise<string> {
  const label = options?.label || "LLM Streaming Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting streaming LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
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
    temperature: options?.temperature ?? 0.0,
  });

  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    onToken(chunk);
  }

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

  return fullText;
}
