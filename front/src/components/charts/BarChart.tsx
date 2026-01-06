'use client';

import { useMemo } from 'react';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { BarChartData } from '@/types/chart';

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

interface BarChartProps {
  data: BarChartData;
  xKey: string;
  yKey: string;
  className?: string;
}

export function BarChart({ data, xKey, yKey, className }: BarChartProps) {
  // Auto-detect multiple series (numeric columns other than xKey)
  const { yKeys, transformedData, hasMultipleSeries, useCellColors } = useMemo(() => {
    if (data.length === 0) return { yKeys: [yKey], transformedData: data, hasMultipleSeries: false, useCellColors: false };

    const firstRow = data[0];

    // Find ALL numeric columns first (including xKey) to detect wide format
    const allNumericKeys = Object.keys(firstRow).filter((key) => {
      const value = firstRow[key];
      return (
        typeof value === 'number' ||
        (typeof value === 'string' && !isNaN(Number(value)))
      );
    });

    // Find numeric columns excluding xKey for rendering
    const numericKeys = allNumericKeys.filter((key) => key !== xKey);

    // If we have multiple numeric columns but only one row, this is wide format
    // We need to transform it to long format for bar charts
    if (data.length === 1 && allNumericKeys.length > 1) {
      const transformed = allNumericKeys.map((key) => ({
        category: key.replace(/_/g, ' '),
        value: firstRow[key],
      }));
      return {
        yKeys: ['value'],
        transformedData: transformed,
        hasMultipleSeries: true,
        useCellColors: true
      };
    }

    // Use cell colors when we have a single series with multiple data points
    const singleSeriesMultipleBars = numericKeys.length <= 1 && data.length > 1;

    return {
      yKeys: numericKeys.length > 1 ? numericKeys : [yKey],
      transformedData: data,
      hasMultipleSeries: false,
      useCellColors: singleSeriesMultipleBars
    };
  }, [data, xKey, yKey]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};

    if (useCellColors) {
      // Create config entries for each data point
      transformedData.forEach((item, index) => {
        const label = String(item[hasMultipleSeries ? 'category' : xKey] || `Item ${index + 1}`);
        config[label] = {
          label,
          color: COLORS[index % COLORS.length],
        };
      });
    } else {
      // Create config entries for each series
      yKeys.forEach((key, index) => {
        config[key] = {
          label: key.replace(/_/g, ' '),
          color: COLORS[index % COLORS.length],
        };
      });
    }

    return config;
  }, [yKeys, useCellColors, transformedData, hasMultipleSeries, xKey]);

  // Use 'category' for x-axis if we transformed the data
  const actualXKey = hasMultipleSeries ? 'category' : xKey;

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] h-[300px] w-full ${className}`}>
      <RechartsBarChart data={transformedData} margin={{ left: 12, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={actualXKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {yKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            fill={useCellColors ? undefined : COLORS[yKeys.indexOf(key) % COLORS.length]}
            radius={4}
          >
            {useCellColors && transformedData.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
}
