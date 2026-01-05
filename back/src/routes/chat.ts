import { Router } from "express";
import {
  GenerateMessageReq,
  GenerateMessageRes,
  ProcessStatusReq,
  ProcessStatusRes,
} from "./chatIO.js";
import {
  ProcessOptions,
  processUserMessage,
} from "#ai/actions/processUserMessage/index.js";
import processStore from "#stores/processStore.js";

const router = Router();

router.post(
  "/chat",
  async (req: GenerateMessageReq, res: GenerateMessageRes) => {
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
        .find((msg) => msg.role === "user");

      if (!lastUserMessage) {
        return res.status(400).json({
          error: "No user message found in the conversation.",
        });
      }

      // Create process and return ID immediately
      const processId = processStore.createProcess();

      // Start async processing in background
      const processOptions: ProcessOptions = {
        useConsistency: options?.useConsistency ?? true,
        debug: options?.debug ?? false,
      };

      // Don't await - let it run in background
      processStore.updateProcessStatus(processId, "processing");
      processUserMessage(
        lastUserMessage.content,
        messages,
        processOptions,
        processId
      )
        .then((result) => {
          processStore.completeProcess(processId, result);
        })
        .catch((error) => {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "An error occurred while processing your request.";
          processStore.failProcess(processId, errorMessage);
        });

      return res.json({ processId });
    } catch (error) {
      console.error("Chat endpoint error:", error);
      return res.status(500).json({
        error: "An error occurred while creating the process.",
      });
    }
  }
);

router.get(
  "/chat/status/:processId",
  (req: ProcessStatusReq, res: ProcessStatusRes) => {
    const { processId } = req.params;

    const process = processStore.getProcess(processId);

    if (!process) {
      return res.status(404).json({
        error: "Process not found",
      });
    }

    return res.json({
      id: process.id,
      status: process.status,
      result: process.result,
      partialResponse: process.partialResponse,
      error: process.error,
      logs: process.logs,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
    });
  }
);

export default router;
