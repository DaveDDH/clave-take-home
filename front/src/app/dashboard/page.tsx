'use client';

import { LayoutGrid } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useWidgetStore } from '@/stores/widget-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { AddWidgetPopover, WidgetCard } from '@/components/dashboard';

export default function DashboardPage() {
  const widgets = useWidgetStore((state) => state.widgets);
  const widgetPositions = useDashboardStore((state) => state.widgetPositions);
  const updateWidgetPosition = useDashboardStore((state) => state.updateWidgetPosition);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 3px movement before drag starts
      },
    })
  );

  const activeWidgets = widgetPositions
    .map((pos) => {
      const widget = widgets.find((w) => w.id === pos.id);
      return widget ? { widget, x: pos.x, y: pos.y } : null;
    })
    .filter(Boolean) as { widget: (typeof widgets)[0]; x: number; y: number }[];

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const widgetId = active.id as string;

    const currentPos = widgetPositions.find((w) => w.id === widgetId);
    if (!currentPos) return;

    // Calculate new position, ensuring it stays within bounds
    const newX = Math.max(0, currentPos.x + delta.x);
    const newY = Math.max(0, currentPos.y + delta.y);

    updateWidgetPosition(widgetId, newX, newY);
  };

  return (
    <div className="relative h-full overflow-auto">
      {activeWidgets.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <LayoutGrid className="size-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">Your Dashboard</h2>
            <p className="text-muted-foreground">Click the + button to add widgets</p>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="relative min-h-full min-w-full p-4" style={{ minHeight: '2000px', minWidth: '2000px' }}>
            {activeWidgets.map(({ widget, x, y }) => (
              <WidgetCard key={widget.id} widget={widget} x={x} y={y} />
            ))}
          </div>
        </DndContext>
      )}
      <AddWidgetPopover />
    </div>
  );
}
