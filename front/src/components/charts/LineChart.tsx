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
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      [yKey]: {
        label: yKey,
        color: 'var(--chart-1)',
      },
    }),
    [yKey]
  );

  return (
    <ChartContainer config={chartConfig} className={`aspect-square max-h-[200px] ${className}`}>
      <RechartsLineChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey={yKey}
          type="monotone"
          stroke={`var(--color-${yKey})`}
          strokeWidth={2}
          dot
        />
      </RechartsLineChart>
    </ChartContainer>
  );
}
