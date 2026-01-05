export type ChartType = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartType[];
}
