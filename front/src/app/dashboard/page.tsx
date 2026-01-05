'use client';

import { LayoutGrid } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useWidgetStore } from '@/stores/widget-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { AddWidgetPopover, WidgetCard } from '@/components/dashboard';

export default function DashboardPage() {
  const widgets = useWidgetStore((state) => state.widgets);
  const activeWidgetIds = useDashboardStore((state) => state.activeWidgetIds);
  const reorderWidgets = useDashboardStore((state) => state.reorderWidgets);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeWidgets = activeWidgetIds
    .map((id) => widgets.find((w) => w.id === id))
    .filter(Boolean);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderWidgets(active.id as string, over.id as string);
    }
  };

  return (
    <div className="relative h-full overflow-auto p-6">
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeWidgetIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-4">
              {activeWidgets.map((widget) => (
                <WidgetCard key={widget!.id} widget={widget!} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <AddWidgetPopover />
    </div>
  );
}
