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
import { capitalizeWords } from '@/lib/utils';

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
        const key = String(item[hasMultipleSeries ? 'category' : xKey] || `Item ${index + 1}`);
        config[key] = {
          label: capitalizeWords(key.replace(/_/g, ' ')),
          color: COLORS[index % COLORS.length],
        };
      });
    } else {
      // Create config entries for each series
      yKeys.forEach((key, index) => {
        config[key] = {
          label: capitalizeWords(key.replace(/_/g, ' ')),
          color: COLORS[index % COLORS.length],
        };
      });
    }

    return config;
  }, [yKeys, useCellColors, transformedData, hasMultipleSeries, xKey]);

  // Use 'category' for category axis if we transformed the data
  const categoryKey = hasMultipleSeries ? 'category' : xKey;

  // Calculate height based on number of bars (horizontal layout)
  const barHeight = 32;
  const gap = 12;
  const minHeight = 150;
  const calculatedHeight = Math.max(minHeight, transformedData.length * (barHeight + gap) + 40);

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <ChartContainer config={chartConfig} className="w-full max-w-[600px]" style={{ height: calculatedHeight }}>
        <RechartsBarChart
          data={transformedData}
          layout="vertical"
          margin={{ left: 20, right: 20, top: 12, bottom: 12 }}
          barCategoryGap={gap}
          barSize={barHeight}
        >
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            type="category"
            dataKey={categoryKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={100}
          />
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
    </div>
  );
}
