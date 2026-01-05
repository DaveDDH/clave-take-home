import { Router, Request, Response } from "express";
import {
  processUserMessage,
  ProcessOptions,
  ProcessedMessage,
} from "#ai/actions/processUserMessage/index.js";

const router = Router();

interface ChatRequest {
  message: string;
  options?: {
    useConsistency?: boolean;
    debug?: boolean;
  };
}

router.post(
  "/chat",
  async (
    req: Request<object, ProcessedMessage, ChatRequest>,
    res: Response<ProcessedMessage>
  ) => {
    try {
      const { message, options } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          content: "Please provide a message to process.",
        });
      }

      const processOptions: ProcessOptions = {
        useConsistency: options?.useConsistency ?? true,
        debug: options?.debug ?? false,
      };

      const result = await processUserMessage(message, processOptions);

      return res.json(result);
    } catch (error) {
      console.error("Chat endpoint error:", error);
      return res.status(500).json({
        content: "An error occurred while processing your request.",
      });
    }
  }
);

export default router;
