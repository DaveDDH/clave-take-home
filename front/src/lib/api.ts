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
  const decoder = new TextDecoder();
  let buffer = '';

  const readStream = async () => {
    let receivedComplete = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;

          const eventMatch = /^event: (.+)/m.exec(line);
          const dataMatch = /^data: (.+)/m.exec(line);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1];
            const dataStr = dataMatch[1];

            try {
              const event = JSON.parse(dataStr);

              switch (eventType) {
                case 'classification':
                  handlers.onClassification?.(event);
                  break;
                case 'progress':
                  handlers.onProgress?.(event.message, event.step);
                  break;
                case 'sql':
                  handlers.onSQL?.(event.sql);
                  break;
                case 'chart':
                  handlers.onChart?.(event.charts);
                  break;
                case 'content-delta':
                  handlers.onContentDelta?.(event.token);
                  break;
                case 'content':
                  handlers.onContent?.(event.content);
                  break;
                case 'conversationId':
                  handlers.onConversationId?.(event.id);
                  break;
                case 'cost':
                  handlers.onCost?.(event.totalCost);
                  break;
                case 'complete':
                  receivedComplete = true;
                  handlers.onComplete?.();
                  break;
                case 'error':
                  handlers.onError?.(event.error);
                  break;
              }
            } catch (err) {
              console.error('Failed to parse SSE event:', err);
            }
          }
        }
      }
      // Ensure onComplete is called when stream ends, even if no explicit complete event
      if (!receivedComplete) {
        handlers.onComplete?.();
      }
    } catch (error) {
      handlers.onError?.(
        error instanceof Error ? error.message : 'Stream failed'
      );
    }
  };

  readStream();

  return () => { void reader.cancel(); };
}
