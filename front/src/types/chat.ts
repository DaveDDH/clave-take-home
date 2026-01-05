export type ChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial';

export interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'area' | 'radar' | 'radial';
  data: Record<string, unknown>[];
  config?: {
    xKey: string;
    yKey: string;
  };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartData[];
  sql?: string;
  error?: string;
}
