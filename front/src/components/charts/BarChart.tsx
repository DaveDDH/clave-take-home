'use client';

import { useMemo } from 'react';
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { BarChartData } from '@/types/chart';

interface BarChartProps {
  data: BarChartData;
  xKey: string;
  yKey: string;
  className?: string;
}

export function BarChart({ data, xKey, yKey, className }: BarChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      [yKey]: {
        label: yKey,
        color: 'var(--chart-3)',
      },
    }),
    [yKey]
  );

  return (
    <ChartContainer config={chartConfig} className={`aspect-square max-h-[200px] ${className}`}>
      <RechartsBarChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey={yKey} fill={`var(--color-${yKey})`} radius={4} />
      </RechartsBarChart>
    </ChartContainer>
  );
}
