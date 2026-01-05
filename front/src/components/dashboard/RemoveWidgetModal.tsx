'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useWidgetStore } from '@/stores/widget-store';

interface RemoveWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetId: string;
  widgetName: string;
}

export function RemoveWidgetModal({
  open,
  onOpenChange,
  widgetId,
  widgetName,
}: RemoveWidgetModalProps) {
  const removeFromDashboard = useDashboardStore((state) => state.removeWidget);
  const removeFromProject = useWidgetStore((state) => state.removeWidget);

  const handleRemoveFromDashboard = () => {
    removeFromDashboard(widgetId);
    onOpenChange(false);
  };

  const handleRemoveFromProject = () => {
    removeFromDashboard(widgetId);
    removeFromProject(widgetId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Widget</DialogTitle>
          <DialogDescription>
            What would you like to do with &quot;{widgetName}&quot;?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleRemoveFromDashboard}>
            Remove from Dashboard
          </Button>
          <Button variant="destructive" onClick={handleRemoveFromProject}>
            Delete from Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
