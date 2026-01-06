'use client';

import { useMemo } from 'react';
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { AreaChartData } from '@/types/chart';

interface AreaChartProps {
  data: AreaChartData;
  xKey: string;
  yKey: string;
  className?: string;
}

export function AreaChart({ data, xKey, yKey, className }: AreaChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      [yKey]: {
        label: yKey,
        color: 'var(--chart-2)',
      },
    }),
    [yKey]
  );

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] h-[300px] w-full ${className}`}>
      <RechartsAreaChart data={data} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey={yKey}
          type="monotone"
          fill={`var(--color-${yKey})`}
          fillOpacity={0.4}
          stroke={`var(--color-${yKey})`}
        />
      </RechartsAreaChart>
    </ChartContainer>
  );
}
