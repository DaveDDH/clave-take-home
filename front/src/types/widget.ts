import type { ChartType } from './chat';
import type {
  AreaChartData,
  BarChartData,
  LineChartData,
  PieChartData,
  RadarChartData,
  RadialChartData,
} from './chart';

export interface AxisChartConfig {
  xKey: string;
  yKey: string;
}

export interface RadarChartConfig {
  labelKey: string;
  valueKey: string;
}

export type ChartData =
  | AreaChartData
  | BarChartData
  | LineChartData
  | PieChartData
  | RadarChartData
  | RadialChartData;

export type ChartConfig = AxisChartConfig | RadarChartConfig | undefined;

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
