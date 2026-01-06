'use client';

import { useMemo } from 'react';
import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { RadarChartData } from '@/types/chart';

interface RadarChartProps {
  data: RadarChartData;
  labelKey: string;
  valueKey: string;
  className?: string;
}

export function RadarChart({ data, labelKey, valueKey, className }: RadarChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      [valueKey]: {
        label: valueKey,
        color: 'var(--chart-4)',
      },
    }),
    [valueKey]
  );

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] h-[300px] w-full ${className}`}>
      <RechartsRadarChart data={data} cx="50%" cy="50%" outerRadius="60%">
        <PolarGrid />
        <PolarAngleAxis dataKey={labelKey} tick={{ fontSize: 10 }} />
        <PolarRadiusAxis tick={{ fontSize: 8 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Radar
          dataKey={valueKey}
          stroke={`var(--color-${valueKey})`}
          fill={`var(--color-${valueKey})`}
          fillOpacity={0.6}
        />
      </RechartsRadarChart>
    </ChartContainer>
  );
}
