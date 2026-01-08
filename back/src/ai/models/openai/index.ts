import {
  HELICONE_KEY,
  OPENAI_API_KEY,
  OPENAI_MODEL,
} from "#constants/index.js";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, generateObject, streamText, LanguageModel } from "ai";
import { z } from "zod";
import { log } from "#utils/logger.js";

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
): Promise<string> {
  const label = options?.label || "OpenAI Text Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting OpenAI LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${OPENAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getOpenAIModel();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] OpenAI call completed in ${duration}ms`,
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
  const label = options?.label || "OpenAI Object Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting OpenAI LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${OPENAI_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getOpenAIModel();
  const { object } = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
    temperature: options?.temperature ?? 0.0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] OpenAI call completed in ${duration}ms`,
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
  const label = options?.label || "OpenAI Streaming Generation";
  const processId = options?.processId;

  log(
    `   🤖 [${label}] Starting streaming OpenAI call...`,
    undefined,
    processId
  );
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
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
    temperature: options?.temperature ?? 0.0,
  });

  let fullText = "";
  for await (const chunk of result.textStream) {
    fullText += chunk;
    onToken(chunk);
  }

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

  return fullText;
}
