import { generateObjectResponse } from "#ai/models/xai/index.js";
import { z } from "zod";
import type { DataContext } from "./data-context.js";

const MessageClassificationSchema = z.object({
  isDataQuery: z.boolean(),
  reasoning: z.string(),
  conversationalResponse: z.string(),
  chartType: z.enum(["bar", "line", "pie", "area", "radar", "radial", "table", "none"]),
});

export type MessageClassification = z.infer<typeof MessageClassificationSchema>;

function buildClassificationPrompt(dataContext?: DataContext): string {
  let dataAvailability = "";

  if (dataContext?.orderDateRange) {
    const earliest = new Date(dataContext.orderDateRange.earliest);
    const latest = new Date(dataContext.orderDateRange.latest);
    const monthName = earliest.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    dataAvailability = `

IMPORTANT - Available Data Range:
- Order data is available from ${earliest.toISOString().split("T")[0]} to ${latest.toISOString().split("T")[0]}
- When users say "first week ever", "first month ever", they mean the EARLIEST week/month in the available data (starting ${earliest.toISOString().split("T")[0]})
- "First month" = ${monthName} (the available data month)
- If the user asks for data OUTSIDE this range (e.g., "yesterday" when today is much later than ${latest.toISOString().split("T")[0]}), classify as conversational and explain the available date range
- Only classify as a data query if the question can be answered with data within this range OR if it's a timeless question (e.g., "top products" without time constraint)`;
  }

  return `You are a message classifier for a restaurant analytics system.
Your job is to determine if a user's message requires querying a database or if it's just conversational.

You have access to a database with information about:
- Orders and sales data
- Product catalog and menu items
- Multiple restaurant locations
- Payment transactions
- Order history over time${dataAvailability}

Data queries are questions about:
- Sales, revenue, orders, transactions
- Products, menu items, categories
- Locations, stores, restaurants
- Payments, payment methods
- Time-based analytics (daily, weekly, monthly trends)
- Comparisons, rankings, top performers
- Aggregations (total, average, count, sum)

BUT classify as conversational (NOT data query) if:
- Greetings (hi, hello, how are you)
- Thanks, acknowledgments
- General questions about what you can do
- Chitchat, small talk
- Questions about the system itself (not the data)
- Questions asking for data OUTSIDE the available date range

For ALL messages, provide a conversationalResponse:
- If it's a data query within range: Say something like "Let me analyze that data for you..." or "I'll look into that..."
- If it's conversational: Provide a friendly, helpful response (2-3 sentences max)
- If asking for data outside available range: Politely explain the data is only available from [earliest] to [latest] and suggest they ask about that time period
- Be friendly and helpful
- Keep responses concise
- Use markdown formatting for emphasis (bold, italic, lists, etc.)

Chart Type Selection (REQUIRED for ALL messages):
- Choose the most appropriate chart type for the data query, or "none" if not a data query
- "bar": Comparisons, rankings, top/bottom items, categorical data (e.g., "top products", "sales by location")
- "line": Trends over time, time-series data (e.g., "sales over time", "daily orders")
- "pie": Distribution, proportions, percentages, breakdowns (e.g., "payment method distribution", "order type breakdown")
- "area": Cumulative trends over time, volume over time (e.g., "total revenue over time")
- "radar": Multi-dimensional comparisons, performance metrics across categories (e.g., "compare locations across metrics")
- "radial": Single metric progress or gauge (e.g., "completion rate", "target achievement")
- "table": Detailed records, raw data listings, multi-column data (3+ columns), when user asks to "show", "list", "display records", or wants specific row details (e.g., "show all orders", "list transactions", "what are the details")
- "none": Conversational messages or queries that don't benefit from visualization`;
}

export async function classifyMessage(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  dataContext?: DataContext,
  processId?: string
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

Current date: ${new Date().toISOString().split("T")[0]}

Classify this message and provide a conversational response.`;

  return generateObjectResponse(
    buildClassificationPrompt(dataContext),
    prompt,
    MessageClassificationSchema,
    { temperature: 0.3, label: "Message Classification", processId }
  );
}
