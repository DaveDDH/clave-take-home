'use client';

import * as React from 'react';
import { Label, Pie, PieChart as RechartsPieChart, Sector } from 'recharts';
import { type PieSectorDataItem } from 'recharts/types/polar/Pie';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PieChartData } from '@/types/chart';
import { capitalizeWords } from '@/lib/utils';

function ActivePieShape({ outerRadius = 0, ...props }: PieSectorDataItem) {
  return (
    <g>
      <Sector {...props} outerRadius={outerRadius + 5} />
      <Sector
        {...props}
        outerRadius={outerRadius + 14}
        innerRadius={outerRadius + 8}
      />
    </g>
  );
}

interface PolarViewBox {
  cx?: number;
  cy?: number;
}

function PieCenterLabel({ viewBox, total }: { viewBox?: PolarViewBox; total: number }) {
  if (!viewBox || viewBox.cx === undefined || viewBox.cy === undefined) {
    return null;
  }
  return (
    <text
      x={viewBox.cx}
      y={viewBox.cy}
      textAnchor="middle"
      dominantBaseline="middle"
    >
      <tspan
        x={viewBox.cx}
        y={viewBox.cy}
        className="fill-foreground text-3xl font-bold"
      >
        {total.toLocaleString()}
      </tspan>
      <tspan
        x={viewBox.cx}
        y={viewBox.cy + 24}
        className="fill-muted-foreground"
      >
        Total
      </tspan>
    </text>
  );
}

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

export function PieChart({ data, className }: Readonly<PieChartProps>) {
  const id = React.useId();
  const chartId = `pie-${id.replaceAll(':', '')}`;

  const [activeItem, setActiveItem] = React.useState(data[0]?.name ?? '');

  const activeIndex = React.useMemo(
    () => data.findIndex((item) => item.name === activeItem),
    [activeItem, data]
  );

  const chartConfig = React.useMemo(() => {
    return data.reduce<ChartConfig>((acc, item, index) => {
      acc[item.name] = {
        label: capitalizeWords(item.name.replaceAll('_', ' ')),
        color: COLORS[index % COLORS.length],
      };
      return acc;
    }, {});
  }, [data]);

  const chartData = React.useMemo(() => {
    return data.map((item) => ({
      ...item,
      fill: `var(--color-${item.name})`,
    }));
  }, [data]);

  const items = React.useMemo(() => data.map((item) => item.name), [data]);

  const total = React.useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  if (data.length === 0) return null;

  return (
    <div data-chart={chartId} className={`flex flex-col ${className}`}>
      <ChartStyle id={chartId} config={chartConfig} />
      <div className="flex justify-end pb-2">
        <Select value={activeItem} onValueChange={setActiveItem}>
          <SelectTrigger
            className="h-7 w-[130px] rounded-lg pl-2.5"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl">
            {items.map((key) => {
              const config = chartConfig[key];
              if (!config) return null;

              return (
                <SelectItem key={key} value={key} className="rounded-lg [&_span]:flex">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="flex h-3 w-3 shrink-0 rounded-sm"
                      style={{ backgroundColor: `var(--color-${key})` }}
                    />
                    {config.label}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <ChartContainer
        id={chartId}
        config={chartConfig}
        className="mx-auto aspect-square w-full max-w-[300px] min-h-[200px]"
      >
        <RechartsPieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            strokeWidth={5}
            activeIndex={activeIndex}
            activeShape={ActivePieShape}
          >
            <Label
              content={({ viewBox }) => <PieCenterLabel viewBox={viewBox as PolarViewBox} total={total} />}
            />
          </Pie>
          <ChartLegend
            content={<ChartLegendContent nameKey="name" />}
            className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
          />
        </RechartsPieChart>
      </ChartContainer>
    </div>
  );
}
