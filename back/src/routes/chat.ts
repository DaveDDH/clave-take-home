import { Router } from "express";
import { GenerateMessageReq, GenerateMessageRes } from "./chatIO.js";
import {
  ProcessOptions,
  processUserMessage,
} from "#ai/actions/processUserMessage/index.js";

const router = Router();

router.post(
  "/chat",
  async (req: GenerateMessageReq, res: GenerateMessageRes) => {
    try {
      const { messages, options } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          content: "Please provide a messages array.",
        });
      }

      // Get the last user message
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find((msg) => msg.role === "user");

      if (!lastUserMessage) {
        return res.status(400).json({
          content: "No user message found in the conversation.",
        });
      }

      const processOptions: ProcessOptions = {
        useConsistency: options?.useConsistency ?? true,
        debug: options?.debug ?? false,
      };

      const result = await processUserMessage(
        lastUserMessage.content,
        messages,
        processOptions
      );

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
