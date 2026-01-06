import { createXai } from "@ai-sdk/xai";
import { generateText, generateObject, streamText } from "ai";
import { z } from "zod";

import { XAI_API_KEY, MODEL } from "#constants/index.js";

export const getXAIProvider = () => {
  return createXai({
    apiKey: XAI_API_KEY,
  });
};

export const getGrokModel = () => {
  const provider = getXAIProvider();
  return provider(MODEL);
};

export async function generateTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number }
): Promise<string> {
  const model = getGrokModel();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.0,
  });
  return text;
}

export async function generateObjectResponse<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  options?: { temperature?: number }
): Promise<T> {
  const model = getGrokModel();
  const { object } = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
    temperature: options?.temperature ?? 0.0,
  });
  return object;
}

export async function streamTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number },
  onToken: (token: string) => void
): Promise<string> {
  const model = getGrokModel();
  const result = await streamText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.0,
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
    onToken(chunk);
  }

  return fullText;
}
