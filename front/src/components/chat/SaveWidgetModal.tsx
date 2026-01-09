'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWidgetStore } from '@/stores/widget-store';
import type { WidgetChart } from '@/types/widget';

interface SaveWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charts: WidgetChart[];
}

export function SaveWidgetModal({ open, onOpenChange, charts }: Readonly<SaveWidgetModalProps>) {
  const [name, setName] = useState('');
  const addWidget = useWidgetStore((state) => state.addWidget);

  const handleSave = () => {
    if (!name.trim()) return;
    addWidget(name.trim(), charts);
    setName('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Widget</DialogTitle>
          <DialogDescription>
            Give your widget a name to save it to your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="widget-name">Widget Name</Label>
            <Input
              id="widget-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter widget name..."
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
