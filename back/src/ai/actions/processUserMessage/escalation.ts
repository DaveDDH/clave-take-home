import type { ModelId } from "#ai/models/index.js";
import type { ReasoningLevel } from "./index.js";

// Model hierarchy from smallest to biggest
export const MODEL_HIERARCHY: ModelId[] = ['gpt-oss-20b', 'gpt-5.2', 'grok-4.1-fast'];

export interface EscalationState {
  model: ModelId;
  reasoningLevel: ReasoningLevel;
  attempt: number;
}

export interface EscalationResult {
  canEscalate: boolean;
  nextState?: EscalationState;
}

/**
 * Determines the next escalation step based on current state.
 *
 * Escalation rules:
 * 1. If reasoning = low → increase to high (same model)
 * 2. If reasoning = medium or high → move to next bigger model
 * 3. If at biggest model but reasoning != high → increase to high
 * 4. If at biggest model AND reasoning = high → cannot escalate
 */
export function getNextEscalation(current: EscalationState): EscalationResult {
  const { model, reasoningLevel } = current;
  const modelIndex = MODEL_HIERARCHY.indexOf(model);
  const isBiggestModel = modelIndex === MODEL_HIERARCHY.length - 1;

  // Rule 1: If reasoning is low, increase to high first
  if (reasoningLevel === 'low') {
    return {
      canEscalate: true,
      nextState: {
        model,
        reasoningLevel: 'high',
        attempt: current.attempt + 1,
      },
    };
  }

  // Rule 2 & 3: If reasoning is medium or high, try next bigger model
  if (!isBiggestModel) {
    return {
      canEscalate: true,
      nextState: {
        model: MODEL_HIERARCHY[modelIndex + 1],
        reasoningLevel,
        attempt: current.attempt + 1,
      },
    };
  }

  // At biggest model but reasoning not high → increase to high
  if (reasoningLevel !== 'high') {
    return {
      canEscalate: true,
      nextState: {
        model,
        reasoningLevel: 'high',
        attempt: current.attempt + 1,
      },
    };
  }

  // Rule 4: Already at max (biggest model + high reasoning)
  return { canEscalate: false };
}

/**
 * Checks if the current state is at maximum escalation.
 */
export function isMaxEscalation(state: EscalationState): boolean {
  const modelIndex = MODEL_HIERARCHY.indexOf(state.model);
  const isBiggestModel = modelIndex === MODEL_HIERARCHY.length - 1;
  return isBiggestModel && state.reasoningLevel === 'high';
}

/**
 * Friendly error message when all escalation options are exhausted.
 */
export const ESCALATION_EXHAUSTED_MESSAGE =
  "We're experiencing some technical difficulties right now. " +
  "Please try your question again in a few moments.";
