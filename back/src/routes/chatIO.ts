import { ProcessedMessage } from "#ai/actions/processUserMessage/index.js";
import { Request, Response } from "express";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: Message[];
  options?: {
    useConsistency?: boolean;
    debug?: boolean;
  };
}

export type GenerateMessageReq = Request<object, ProcessedMessage, ChatRequest>;
export type GenerateMessageRes = Response<ProcessedMessage>;
