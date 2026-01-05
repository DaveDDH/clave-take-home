'use client';

import { Pie, PieChart as RechartsPieChart, Cell } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { PieChartData } from '@/types/chart';

interface PieChartProps {
  data: PieChartData;
  className?: string;
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function PieChart({ data, className }: PieChartProps) {
  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {});

  return (
    <ChartContainer config={chartConfig} className={`aspect-square max-h-[200px] ${className}`}>
      <RechartsPieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </RechartsPieChart>
    </ChartContainer>
  );
}
