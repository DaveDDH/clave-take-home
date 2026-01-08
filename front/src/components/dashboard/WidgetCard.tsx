'use client';

import { useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  BarChart,
  DataTable,
  LineChart,
  PieChart,
  RadarChart,
  RadialChart,
} from '@/components/charts';
import { RemoveWidgetModal } from './RemoveWidgetModal';
import type { Widget, WidgetChart, AxisChartConfig, RadarChartConfig, TableChartConfig } from '@/types/widget';
import type {
  AreaChartData,
  BarChartData,
  LineChartData,
  PieChartData,
  RadarChartData,
  RadialChartData,
  TableChartData,
} from '@/types/chart';

interface WidgetCardProps {
  widget: Widget;
  x: number;
  y: number;
}

export function WidgetCard({ widget, x, y }: WidgetCardProps) {
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: widget.id });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    transform: transform
      ? `translate(${transform.x}px, ${transform.y}px)`
      : undefined,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.9 : 1,
    cursor: isDragging ? 'grabbing' : 'default',
  };

  return (
    <>
      <Card ref={setNodeRef} style={style} className="touch-none shadow-md hover:shadow-lg transition-shadow w-fit">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-muted-foreground transition-colors hover:text-foreground"
              >
                <GripVertical className="h-5 w-5" />
              </button>
              <CardTitle className="text-base">{widget.name}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setRemoveModalOpen(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-4">
            {widget.charts.map((chart, index) => (
              <div key={index} className="w-[280px]">
                {renderChart(chart)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <RemoveWidgetModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        widgetId={widget.id}
        widgetName={widget.name}
      />
    </>
  );
}

function renderChart(chart: WidgetChart): React.ReactNode {
  switch (chart.type) {
    case 'area': {
      const config = chart.config as AxisChartConfig;
      return (
        <AreaChart
          data={chart.data as AreaChartData}
          xKey={config.xKey}
          yKey={config.yKey}
        />
      );
    }
    case 'bar': {
      const config = chart.config as AxisChartConfig;
      return (
        <BarChart
          data={chart.data as BarChartData}
          xKey={config.xKey}
          yKey={config.yKey}
        />
      );
    }
    case 'line': {
      const config = chart.config as AxisChartConfig;
      return (
        <LineChart
          data={chart.data as LineChartData}
          xKey={config.xKey}
          yKey={config.yKey}
        />
      );
    }
    case 'pie':
      return <PieChart data={chart.data as PieChartData} />;
    case 'radar': {
      const config = chart.config as RadarChartConfig;
      return (
        <RadarChart
          data={chart.data as RadarChartData}
          labelKey={config.labelKey}
          valueKey={config.valueKey}
        />
      );
    }
    case 'radial':
      return <RadialChart data={chart.data as RadialChartData} />;
    case 'table': {
      const config = chart.config as TableChartConfig;
      return <DataTable data={chart.data as TableChartData} columns={config?.columns} />;
    }
  }
}
