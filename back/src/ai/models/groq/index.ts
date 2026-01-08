import { GROQ_API_KEY, GROQ_MODEL, HELICONE_KEY } from "#constants/index.js";
import { createGroq } from "@ai-sdk/groq";
import { generateText, generateObject, streamText, LanguageModel } from "ai";
import { z } from "zod";
import { log } from "#utils/logger.js";

// Save reference to global fetch before defining custom wrapper
const globalFetch = fetch;

const customFetch = async (
  url: string | URL | Request,
  options: RequestInit | undefined
) => {
  if (options?.body) {
    const body = options.body.toString();
    const parsedBody = JSON.parse(body);
    parsedBody["reasoning_effort"] = "high";
    options.body = JSON.stringify(parsedBody);
  }
  return await globalFetch(url, options);
};

export const getGroqProvider = () => {
  if (HELICONE_KEY)
    return createGroq({
      apiKey: GROQ_API_KEY,
      baseURL: "https://groq.helicone.ai/openai/v1",
      headers: {
        "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
      },
      fetch: customFetch,
    });
  return createGroq({
    apiKey: GROQ_API_KEY,
    fetch: customFetch,
  });
};

export const getGroqModel = (): LanguageModel => {
  const provider = getGroqProvider();
  return provider(GROQ_MODEL);
};

export async function generateTextResponse(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; label?: string; processId?: string }
): Promise<string> {
  const label = options?.label || "Groq Text Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting Groq LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${GROQ_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGroqModel();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: options?.temperature ?? 0.0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] Groq call completed in ${duration}ms`,
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
  const label = options?.label || "Groq Object Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting Groq LLM call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${GROQ_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGroqModel();
  const { object } = await generateObject({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    schema,
    temperature: options?.temperature ?? 0.0,
  });

  const duration = Date.now() - startTime;
  log(
    `   ✅ [${label}] Groq call completed in ${duration}ms`,
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
  const label = options?.label || "Groq Streaming Generation";
  const processId = options?.processId;

  log(`   🤖 [${label}] Starting streaming Groq call...`, undefined, processId);
  log(
    `      Temperature: ${options?.temperature ?? 0.0}`,
    undefined,
    processId
  );
  log(`      Model: ${GROQ_MODEL}`, undefined, processId);

  const startTime = Date.now();

  const model = getGroqModel();
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
    `   ✅ [${label}] Groq streaming completed in ${duration}ms`,
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
