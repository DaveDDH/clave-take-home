'use client';

import { useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
}

export function WidgetCard({ widget }: WidgetCardProps) {
  const [removeModalOpen, setRemoveModalOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.02 : 1,
  };

  return (
    <>
      <Card ref={setNodeRef} style={style} className="touch-none transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                {...attributes}
                {...listeners}
                className="cursor-grab text-muted-foreground transition-colors hover:text-foreground"
              >
                <GripVertical className="h-5 w-5" />
              </button>
              <CardTitle>{widget.name}</CardTitle>
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setRemoveModalOpen(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {widget.charts.map((chart, index) => (
              <div key={index} className="w-[220px]">
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
