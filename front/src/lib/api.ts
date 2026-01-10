const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5006';

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'radial';
  data: Record<string, unknown>[];
  config?: {
    xKey: string;
    yKey: string;
  };
}

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartData[] | null;
}

export type ModelId = 'grok-4.1-fast' | 'gpt-5.2' | 'gpt-oss-20b';

export type ReasoningLevel = 'low' | 'medium' | 'high';

export interface ChatRequestOptions {
  useConsistency?: boolean;
  debug?: boolean;
  reasoningLevel?: ReasoningLevel;
}

export interface ConversationPreview {
  id: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
  message_count: number;
}

export interface ConversationWithMessages {
  id: string;
  messages: ApiMessage[];
}

// Fetch list of conversations
export async function fetchConversations(): Promise<ConversationPreview[]> {
  const response = await fetch(`${API_BASE_URL}/api/conversations`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }
  const data = await response.json();
  return data.conversations;
}

// Fetch a single conversation with all messages
export async function fetchConversation(id: string): Promise<ConversationWithMessages> {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch conversation');
  }
  return response.json();
}

// SSE streaming API
export interface StreamHandlers {
  onClassification?: (data: {
    isDataQuery: boolean;
    chartType: string;
    conversationalResponse: string;
  }) => void;
  onProgress?: (message: string, step: string) => void;
  onSQL?: (sql: string) => void;
  onChart?: (charts: ChartData[]) => void;
  onContentDelta?: (token: string) => void;
  onContent?: (content: string) => void;
  onConversationId?: (id: string) => void;
  onCost?: (totalCost: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

function parseSSELine(line: string): SSEEvent | null {
  if (!line.trim() || line.startsWith(':')) return null;

  const eventMatch = /^event: (.+)/m.exec(line);
  const dataMatch = /^data: (.+)/m.exec(line);

  if (!eventMatch || !dataMatch) return null;

  try {
    return {
      type: eventMatch[1],
      data: JSON.parse(dataMatch[1]),
    };
  } catch {
    console.error('Failed to parse SSE event');
    return null;
  }
}

function dispatchSSEEvent(event: SSEEvent, handlers: StreamHandlers): boolean {
  const { type, data } = event;
  console.log('[api] SSE event received:', type, data);

  switch (type) {
    case 'classification':
      handlers.onClassification?.(data as { isDataQuery: boolean; chartType: string; conversationalResponse: string });
      return false;
    case 'progress':
      handlers.onProgress?.(data.message as string, data.step as string);
      return false;
    case 'sql':
      handlers.onSQL?.(data.sql as string);
      return false;
    case 'chart':
      handlers.onChart?.(data.charts as ChartData[]);
      return false;
    case 'content-delta':
      handlers.onContentDelta?.(data.token as string);
      return false;
    case 'content':
      handlers.onContent?.(data.content as string);
      return false;
    case 'conversationId':
      handlers.onConversationId?.(data.id as string);
      return false;
    case 'cost':
      handlers.onCost?.(data.totalCost as number);
      return false;
    case 'complete':
      handlers.onComplete?.();
      return true;
    case 'error':
      handlers.onError?.(data.error as string);
      return false;
    default:
      return false;
  }
}

interface StreamState {
  buffer: string;
  receivedComplete: boolean;
}

function processStreamChunk(
  state: StreamState,
  value: Uint8Array,
  decoder: TextDecoder,
  handlers: StreamHandlers
): void {
  state.buffer += decoder.decode(value, { stream: true });
  const lines = state.buffer.split('\n\n');
  state.buffer = lines.pop() || '';

  for (const line of lines) {
    const event = parseSSELine(line);
    if (event && dispatchSSEEvent(event, handlers)) {
      state.receivedComplete = true;
    }
  }
}

async function consumeStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: StreamHandlers
): Promise<void> {
  const decoder = new TextDecoder();
  const state: StreamState = { buffer: '', receivedComplete: false };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      processStreamChunk(state, value, decoder, handlers);
    }
    if (!state.receivedComplete) {
      handlers.onComplete?.();
    }
  } catch (error) {
    handlers.onError?.(error instanceof Error ? error.message : 'Stream failed');
  }
}

export async function streamChatResponse(
  message: string,
  conversationId: string | null,
  model: ModelId,
  options: ChatRequestOptions,
  handlers: StreamHandlers
): Promise<() => void> {
  const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message,
      conversationId,
      model,
      options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start stream: ${response.statusText}`);
  }

  const reader = response.body!.getReader();
  void consumeStream(reader, handlers);

  return () => { void reader.cancel(); };
}
