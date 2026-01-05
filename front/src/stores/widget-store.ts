import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Widget, WidgetChart } from '@/types/widget';

interface WidgetState {
  widgets: Widget[];
  addWidget: (name: string, charts: WidgetChart[]) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<Omit<Widget, 'id'>>) => void;
}

export const useWidgetStore = create<WidgetState>()(
  persist(
    (set) => ({
      widgets: [],
      addWidget: (name, charts) =>
        set((state) => ({
          widgets: [
            ...state.widgets,
            {
              id: crypto.randomUUID(),
              name,
              charts,
              createdAt: new Date(),
            },
          ],
        })),
      removeWidget: (id) =>
        set((state) => ({
          widgets: state.widgets.filter((w) => w.id !== id),
        })),
      updateWidget: (id, updates) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),
    }),
    {
      name: 'widget-storage',
    }
  )
);
