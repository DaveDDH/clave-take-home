import { Router, Request, Response } from "express";
import { ProcessOptions, ChartData, DEFAULT_MODEL } from "#ai/actions/processUserMessage/index.js";
import type { ModelId } from "#ai/actions/processUserMessage/index.js";
import { processUserMessageStream } from "#ai/actions/processUserMessage/streaming.js";
import { SSEWriter } from "#utils/sse.js";
import {
  createConversation,
  getConversationMessages,
  addMessage,
  conversationExists,
  listConversations,
} from "#db/conversations.js";

const router = Router();

// GET /api/conversations - List all conversations
router.get("/conversations", async (_req: Request, res: Response) => {
  try {
    const conversations = await listConversations();
    return res.json({ conversations });
  } catch (error) {
    console.error("List conversations error:", error);
    return res.status(500).json({ error: "Failed to list conversations" });
  }
});

// GET /api/conversations/:id - Get a single conversation with messages
router.get("/conversations/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const exists = await conversationExists(id);
    if (!exists) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await getConversationMessages(id);
    return res.json({ id, messages });
  } catch (error) {
    console.error("Get conversation error:", error);
    return res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.post("/chat/stream", async (req: Request, res: Response) => {
  try {
    const { message, conversationId: existingConversationId, options, model: requestModel } = req.body;
    const model: ModelId = requestModel || DEFAULT_MODEL;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Please provide a message string.",
      });
    }

    // Get or create conversation
    let conversationId: string;
    let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (existingConversationId) {
      // Validate conversation exists
      const exists = await conversationExists(existingConversationId);
      if (!exists) {
        return res.status(404).json({
          error: "Conversation not found.",
        });
      }
      conversationId = existingConversationId;

      // Load existing messages
      const messages = await getConversationMessages(conversationId);
      conversationHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    } else {
      // Create new conversation
      conversationId = await createConversation();
    }

    // Add user message to conversation history and DB
    conversationHistory.push({ role: "user", content: message });
    await addMessage(conversationId, "user", message);

    // Generate a unique process ID for tracking
    const processId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Create SSE writer that captures assistant response and charts
    const sseWriter = new SSEWriter(res);
    let partialResponse = "";
    let assistantResponse = "";
    let capturedCharts: ChartData[] | undefined;

    // Wrap sendClassification to capture partial response
    const originalSendClassification = sseWriter.sendClassification.bind(sseWriter);
    sseWriter.sendClassification = (data: {
      isDataQuery: boolean;
      chartType: string | null;
      conversationalResponse: string;
    }) => {
      partialResponse = data.conversationalResponse;
      originalSendClassification(data);
    };

    // Wrap sendChart to capture chart data
    const originalSendChart = sseWriter.sendChart.bind(sseWriter);
    sseWriter.sendChart = (charts: ChartData[]) => {
      capturedCharts = charts;
      originalSendChart(charts);
    };

    // Wrap the original sendContentDelta to capture tokens
    const originalSendContentDelta = sseWriter.sendContentDelta.bind(sseWriter);
    sseWriter.sendContentDelta = (token: string) => {
      assistantResponse += token;
      originalSendContentDelta(token);
    };

    // Also capture sendContent (for fallback messages)
    const originalSendContent = sseWriter.sendContent.bind(sseWriter);
    sseWriter.sendContent = (content: string) => {
      assistantResponse = content;
      originalSendContent(content);
    };

    // Wrap sendComplete to save assistant response after streaming completes
    const originalSendComplete = sseWriter.sendComplete.bind(sseWriter);
    sseWriter.sendComplete = async () => {
      // Save messages based on what we captured
      if (capturedCharts && capturedCharts.length > 0) {
        // Data query with charts: save partial response first, then chart response
        if (partialResponse.trim()) {
          await addMessage(conversationId, "assistant", partialResponse);
        }
        // Save chart response (even if empty content, charts are important)
        await addMessage(conversationId, "assistant", assistantResponse, capturedCharts);
      } else if (assistantResponse.trim()) {
        // Has streamed response but no charts
        await addMessage(conversationId, "assistant", assistantResponse);
      } else if (partialResponse.trim()) {
        // Non-data query: only partial response (no charts, no streamed response)
        await addMessage(conversationId, "assistant", partialResponse);
      }
      // Send conversation ID with completion
      sseWriter.sendEvent("conversationId", { id: conversationId });
      originalSendComplete();
    };

    const processOptions: ProcessOptions = {
      useConsistency: options?.useConsistency ?? true,
      debug: options?.debug ?? false,
      model,
      reasoningLevel: options?.reasoningLevel ?? 'medium',
    };

    // Process with streaming
    await processUserMessageStream(
      message,
      conversationHistory,
      processOptions,
      sseWriter,
      processId
    );
  } catch (error) {
    console.error("Chat stream endpoint error:", error);
    // If headers not sent, send error response
    if (!res.headersSent) {
      return res.status(500).json({
        error: "An error occurred while streaming the response.",
      });
    }
  }
});

export default router;
