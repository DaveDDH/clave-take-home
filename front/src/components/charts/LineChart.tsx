'use client';

import { useMemo } from 'react';
import { Line, LineChart as RechartsLineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { LineChartData } from '@/types/chart';

interface LineChartProps {
  data: LineChartData;
  xKey: string;
  yKey: string;
  className?: string;
}

export function LineChart({ data, xKey, yKey, className }: LineChartProps) {
  // Auto-detect multiple series (numeric columns other than xKey)
  const yKeys = useMemo(() => {
    if (data.length === 0) return [yKey];

    const firstRow = data[0];
    const numericKeys = Object.keys(firstRow).filter((key) => {
      const value = firstRow[key];
      return (
        key !== xKey &&
        (typeof value === 'number' ||
         (typeof value === 'string' && !isNaN(Number(value))))
      );
    });

    // If we have multiple numeric columns, use all of them
    // Otherwise, use the specified yKey
    return numericKeys.length > 1 ? numericKeys : [yKey];
  }, [data, xKey, yKey]);

  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    const colors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

    yKeys.forEach((key, index) => {
      config[key] = {
        label: key.replace(/_/g, ' '),
        color: colors[index % colors.length],
      };
    });

    return config;
  }, [yKeys]);

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] h-[300px] w-full ${className}`}>
      <RechartsLineChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {yKeys.map((key) => (
          <Line
            key={key}
            dataKey={key}
            type="monotone"
            stroke={chartConfig[key]?.color}
            strokeWidth={2}
            dot
          />
        ))}
      </RechartsLineChart>
    </ChartContainer>
  );
}
