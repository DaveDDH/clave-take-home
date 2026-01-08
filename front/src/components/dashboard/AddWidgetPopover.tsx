'use client';

import { Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { useWidgetStore } from '@/stores/widget-store';
import { useDashboardStore } from '@/stores/dashboard-store';

export function AddWidgetPopover() {
  const widgets = useWidgetStore((state) => state.widgets);
  const widgetPositions = useDashboardStore((state) => state.widgetPositions);
  const addWidget = useDashboardStore((state) => state.addWidget);

  const activeWidgetIds = widgetPositions.map((w) => w.id);
  const availableWidgets = widgets.filter(
    (w) => !activeWidgetIds.includes(w.id)
  );

  const hasNoWidgets = widgets.length === 0;
  const allWidgetsOnDashboard = availableWidgets.length === 0;
  const isDisabled = hasNoWidgets || allWidgetsOnDashboard;

  const handleWidgetSelect = (widgetId: string) => {
    addWidget(widgetId);
  };

  return (
    <div className="fixed bottom-6 right-6">
      <Select onValueChange={handleWidgetSelect} value="">
        <SelectTrigger
          className="size-9 p-0 justify-center"
          disabled={isDisabled}
          hideIcon
        >
          <Plus className="h-5 w-5" />
        </SelectTrigger>
        <SelectContent position="popper" side="top" align="end">
          {availableWidgets.map((widget) => (
            <SelectItem key={widget.id} value={widget.id}>
              {widget.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
