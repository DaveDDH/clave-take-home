'use client';

import { useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { Resizable } from 're-resizable';
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
import { useDashboardStore } from '@/stores/dashboard-store';
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
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 400;
const MIN_WIDTH = 280;
const MIN_HEIGHT = 300;

export function WidgetCard({ widget, x, y, width, height }: WidgetCardProps) {
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const updateWidgetSize = useDashboardStore((state) => state.updateWidgetSize);

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

  const handleResizeStop = (
    _e: MouseEvent | TouchEvent,
    _direction: string,
    ref: HTMLElement
  ) => {
    updateWidgetSize(widget.id, ref.offsetWidth, ref.offsetHeight);
  };

  return (
    <>
      <div ref={setNodeRef} style={style}>
        <Resizable
          size={{
            width: width ?? DEFAULT_WIDTH,
            height: height ?? DEFAULT_HEIGHT,
          }}
          minWidth={MIN_WIDTH}
          minHeight={MIN_HEIGHT}
          onResizeStop={handleResizeStop}
          handleStyles={{
            bottomRight: {
              bottom: 4,
              right: 4,
              cursor: 'se-resize',
            },
          }}
          handleClasses={{
            bottomRight: 'resize-handle',
          }}
          enable={{
            top: false,
            right: true,
            bottom: true,
            left: false,
            topRight: false,
            bottomRight: true,
            bottomLeft: false,
            topLeft: false,
          }}
        >
          <Card className="touch-none shadow-md hover:shadow-lg transition-shadow h-full w-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
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
            <CardContent className="pt-0 flex-1 overflow-auto">
              <div className="flex flex-wrap gap-4 h-full">
                {widget.charts.map((chart, index) => (
                  <div key={index} className="flex-1 min-w-[200px]">
                    {renderChart(chart)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Resizable>
      </div>
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
