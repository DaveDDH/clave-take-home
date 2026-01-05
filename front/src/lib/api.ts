const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5006';

export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestOptions {
  useConsistency?: boolean;
  debug?: boolean;
}

export interface ChatResponse {
  processId: string;
}

export type ProcessStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'radial';
  data: Record<string, unknown>[];
  config?: {
    xKey: string;
    yKey: string;
  };
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

export interface ProcessStatusResponse {
  id: string;
  status: ProcessStatus;
  result?: ProcessedMessage;
  partialResponse?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export async function startChatProcess(
  messages: ApiMessage[],
  options?: ChatRequestOptions
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      options: options || { useConsistency: true, debug: false },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start chat process: ${response.statusText}`);
  }

  const data: ChatResponse = await response.json();
  return data.processId;
}

export async function getProcessStatus(
  processId: string
): Promise<ProcessStatusResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/chat/status/${processId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get process status: ${response.statusText}`);
  }

  return response.json();
}

export async function pollProcessStatus(
  processId: string,
  intervalMs: number = 1000,
  maxAttempts: number = 120
): Promise<ProcessedMessage> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getProcessStatus(processId);

    if (status.status === 'completed' && status.result) {
      return status.result;
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Process failed');
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }

  throw new Error('Process polling timeout');
}
