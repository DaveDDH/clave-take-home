import type { ModelId } from "#ai/models/index.js";
import type { ChartType } from "./chart-inference.js";

export interface ChartData {
  type: ChartType;
  data: Record<string, unknown>[];
  config?: { xKey?: string; yKey?: string; columns?: string[] };
}

export interface ProcessedMessage {
  content: string;
  charts?: ChartData[];
  sql?: string;
  debug?: {
    linkedSchema: unknown;
    confidence?: number;
    candidateCount?: number;
    successfulExecutions?: number;
  };
}

export type ReasoningLevel = 'low' | 'medium' | 'high';

export interface ProcessOptions {
  useConsistency?: boolean;
  debug?: boolean;
  model?: ModelId;
  reasoningLevel?: ReasoningLevel;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

// Maps reasoning level to number of SQL candidates for self-consistency voting
export const REASONING_TO_CANDIDATES: Record<ReasoningLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};
