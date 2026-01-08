export type ChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial' | 'table';

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'radial' | 'table';
  data: Record<string, unknown>[];
  config?: {
    xKey?: string;
    yKey?: string;
    columns?: string[];
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartData[];
  sql?: string;
  error?: string;
  isStreaming?: boolean;
  partialTimestamp?: number;
  finalTimestamp?: number;
  cost?: number;
}
