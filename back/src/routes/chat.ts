import { Router, Request, Response } from "express";
import { ProcessOptions } from "#ai/actions/processUserMessage/index.js";
import { processUserMessageStream } from "#ai/actions/processUserMessage/streaming.js";
import { SSEWriter } from "#utils/sse.js";

const router = Router();

router.post("/chat/stream", async (req: Request, res: Response) => {
  try {
    const { messages, options } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Please provide a messages array.",
      });
    }

    // Get the last user message
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find((msg: { role: string }) => msg.role === "user");

    if (!lastUserMessage) {
      return res.status(400).json({
        error: "No user message found in the conversation.",
      });
    }

    // SSEWriter sets headers and flushes them
    const sseWriter = new SSEWriter(res);

    const processOptions: ProcessOptions = {
      useConsistency: options?.useConsistency ?? true,
      debug: options?.debug ?? false,
    };

    // Process with streaming
    await processUserMessageStream(
      lastUserMessage.content,
      messages,
      processOptions,
      sseWriter
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
