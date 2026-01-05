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
