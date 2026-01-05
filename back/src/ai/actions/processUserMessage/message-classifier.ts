import { generateObjectResponse } from "#ai/models/xai/index.js";
import { z } from "zod";

const MessageClassificationSchema = z.object({
  isDataQuery: z.boolean(),
  reasoning: z.string(),
  conversationalResponse: z.string(),
});

export type MessageClassification = z.infer<typeof MessageClassificationSchema>;

const CLASSIFICATION_SYSTEM_PROMPT = `You are a message classifier for a restaurant analytics system.
Your job is to determine if a user's message requires querying a database or if it's just conversational.

You have access to a database with information about:
- Orders and sales data
- Product catalog and menu items
- Multiple restaurant locations
- Payment transactions
- Order history over time

Data queries are questions about:
- Sales, revenue, orders, transactions
- Products, menu items, categories
- Locations, stores, restaurants
- Payments, payment methods
- Time-based analytics (daily, weekly, monthly trends)
- Comparisons, rankings, top performers
- Aggregations (total, average, count, sum)

Conversational messages are:
- Greetings (hi, hello, how are you)
- Thanks, acknowledgments
- General questions about what you can do
- Chitchat, small talk
- Questions about the system itself (not the data)

For ALL messages (both data queries and conversational), provide a conversationalResponse:
- If it's a data query: Say something like "Let me analyze that data for you..." or "I'll look into that..."
- If it's conversational: Provide a friendly, helpful response (2-3 sentences max)
- Be friendly and helpful
- Keep responses concise`;

export async function classifyMessage(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<MessageClassification> {
  let conversationContext = "";
  if (conversationHistory.length > 1) {
    const previousMessages = conversationHistory.slice(0, -1);
    conversationContext = `Previous conversation:\n${previousMessages
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n")}\n\n`;
  }

  const prompt = `${conversationContext}Current user message:
"${userMessage}"

Classify this message and provide a conversational response.`;

  return generateObjectResponse(
    CLASSIFICATION_SYSTEM_PROMPT,
    prompt,
    MessageClassificationSchema,
    { temperature: 0.3 }
  );
}
