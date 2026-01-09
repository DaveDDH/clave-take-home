'use client';

import { RadialBar, RadialBarChart as RechartsRadialBarChart } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { RadialChartData } from '@/types/chart';
import { capitalizeWords } from '@/lib/utils';

interface RadialChartProps {
  data: RadialChartData;
  className?: string;
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function RadialChart({ data, className }: Readonly<RadialChartProps>) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length],
  }));

  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.name] = {
      label: capitalizeWords(item.name.replaceAll('_', ' ')),
      color: COLORS[index % COLORS.length],
    };
    return acc;
  }, {});

  return (
    <ChartContainer config={chartConfig} className={`min-h-[200px] h-[300px] w-full ${className}`}>
      <RechartsRadialBarChart
        data={chartData}
        innerRadius={30}
        outerRadius={90}
        cx="50%"
        cy="50%"
      >
        <ChartTooltip content={<ChartTooltipContent />} />
        <RadialBar dataKey="value" background cornerRadius={10} />
        <ChartLegend
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: 0, marginTop: -20 }}
          content={<ChartLegendContent nameKey="name" />}
        />
      </RechartsRadialBarChart>
    </ChartContainer>
  );
}
