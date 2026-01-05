'use client';

import { Plus, Package, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useWidgetStore } from '@/stores/widget-store';
import { useDashboardStore } from '@/stores/dashboard-store';

export function AddWidgetPopover() {
  const widgets = useWidgetStore((state) => state.widgets);
  const activeWidgetIds = useDashboardStore((state) => state.activeWidgetIds);
  const addWidget = useDashboardStore((state) => state.addWidget);

  const availableWidgets = widgets.filter(
    (w) => !activeWidgetIds.includes(w.id)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" className="fixed bottom-6 right-6">
          <Plus className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="space-y-3">
          <h4 className="font-medium">Add Widget</h4>
          {widgets.length === 0 ? (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Package className="mt-0.5 size-4 shrink-0" />
              <span>No saved widgets yet. Save widgets from the Copilot.</span>
            </div>
          ) : availableWidgets.length === 0 ? (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle className="mt-0.5 size-4 shrink-0" />
              <span>All widgets are on the dashboard.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {availableWidgets.map((widget) => (
                <Button
                  key={widget.id}
                  variant="ghost"
                  onClick={() => addWidget(widget.id)}
                >
                  {widget.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
