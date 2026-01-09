// Re-export types
export type {
  ChartData,
  ProcessedMessage,
  ReasoningLevel,
  ProcessOptions,
  ConversationMessage,
} from "./types.js";

export { REASONING_TO_CANDIDATES } from "./types.js";

// Re-export model utilities
export { DEFAULT_MODEL } from "#ai/models/index.js";
export type { ModelId } from "#ai/models/index.js";

// Re-export escalation utilities
export {
  MODEL_HIERARCHY,
  getNextEscalation,
  isMaxEscalation,
  ESCALATION_EXHAUSTED_MESSAGE,
  type EscalationState,
  type EscalationResult,
} from "./escalation.js";

// Re-export streaming function (main entry point)
export { processUserMessageStream } from "./streaming.js";
