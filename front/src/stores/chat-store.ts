import { create } from 'zustand';
import type { Message, ChartType } from '@/types/chat';

const ALL_CHARTS: ChartType[] = ['area', 'bar', 'line', 'pie', 'radar', 'radial'];

const CHART_KEYWORDS: Record<string, ChartType[]> = {
  chartarea: ['area'],
  chartbar: ['bar'],
  chartline: ['line'],
  chartpie: ['pie'],
  chartradar: ['radar'],
  chartradial: ['radial'],
  chartall: ALL_CHARTS,
};

function getCharts(input: string): ChartType[] | undefined {
  const normalized = input.trim().toLowerCase();
  return CHART_KEYWORDS[normalized];
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  sendMessage: async (content: string) => {
    if (!content.trim() || get().isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
    }));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const charts = getCharts(content);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: charts ? '' : 'Hello',
      charts,
    };

    set((state) => ({
      messages: [...state.messages, assistantMessage],
      isLoading: false,
    }));
  },
  clearMessages: () => set({ messages: [] }),
}));
