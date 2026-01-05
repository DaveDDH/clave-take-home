import { ProcessedMessage } from "#ai/actions/processUserMessage/index.js";
import { Request, Response } from "express";
import { ProcessStatus } from "#stores/processStore.js";

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

export interface ChatResponse {
  processId: string;
}

export interface ChatErrorResponse {
  error: string;
}

export interface ProcessStatusResponse {
  id: string;
  status: ProcessStatus;
  result?: ProcessedMessage;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessStatusErrorResponse {
  error: string;
}

export type GenerateMessageReq = Request<
  object,
  ChatResponse | ChatErrorResponse,
  ChatRequest
>;
export type GenerateMessageRes = Response<ChatResponse | ChatErrorResponse>;

export type ProcessStatusReq = Request<
  { processId: string },
  ProcessStatusResponse | ProcessStatusErrorResponse
>;
export type ProcessStatusRes = Response<
  ProcessStatusResponse | ProcessStatusErrorResponse
>;
