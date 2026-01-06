import type { ChartType } from './chat';
import type {
  AreaChartData,
  BarChartData,
  LineChartData,
  PieChartData,
  RadarChartData,
  RadialChartData,
  TableChartData,
} from './chart';

export interface AxisChartConfig {
  xKey: string;
  yKey: string;
}

export interface RadarChartConfig {
  labelKey: string;
  valueKey: string;
}

export interface TableChartConfig {
  columns?: string[];
}

export type ChartData =
  | AreaChartData
  | BarChartData
  | LineChartData
  | PieChartData
  | RadarChartData
  | RadialChartData
  | TableChartData;

export type ChartConfig = AxisChartConfig | RadarChartConfig | TableChartConfig | undefined;

export interface WidgetChart {
  type: ChartType;
  data: ChartData;
  config?: ChartConfig;
}

export interface Widget {
  id: string;
  name: string;
  charts: WidgetChart[];
  createdAt: Date;
}
