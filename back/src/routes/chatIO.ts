import { ProcessedMessage } from "#ai/actions/processUserMessage/index.js";
import { Request, Response } from "express";

export interface ChatRequest {
  message: string;
  options?: {
    useConsistency?: boolean;
    debug?: boolean;
  };
}

export type GenerateMessageReq = Request<object, ProcessedMessage, ChatRequest>;
export type GenerateMessageRes = Response<ProcessedMessage>;
