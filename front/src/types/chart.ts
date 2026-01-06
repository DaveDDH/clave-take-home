export interface AxisChartDataPoint {
  [key: string]: string | number;
}

export interface PieChartDataPoint {
  name: string;
  value: number;
}

export interface RadialChartDataPoint {
  name: string;
  value: number;
}

export type AreaChartData = AxisChartDataPoint[];
export type BarChartData = AxisChartDataPoint[];
export type LineChartData = AxisChartDataPoint[];
export type PieChartData = PieChartDataPoint[];
export type RadarChartData = AxisChartDataPoint[];
export type RadialChartData = RadialChartDataPoint[];
export type TableChartData = Record<string, string | number | boolean | null>[];
