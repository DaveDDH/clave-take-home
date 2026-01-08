import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetPosition {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface DashboardState {
  widgetPositions: WidgetPosition[];
  addWidget: (id: string, x?: number, y?: number) => void;
  removeWidget: (id: string) => void;
  updateWidgetPosition: (id: string, x: number, y: number) => void;
  updateWidgetSize: (id: string, width: number, height: number) => void;
  getWidgetPosition: (id: string) => WidgetPosition | undefined;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      widgetPositions: [],

      addWidget: (id, x = 20, y = 20) =>
        set((state) => {
          if (state.widgetPositions.some((w) => w.id === id)) return state;
          // Stack new widgets with offset if there are existing ones
          const offset = state.widgetPositions.length * 30;
          return {
            widgetPositions: [
              ...state.widgetPositions,
              { id, x: x + offset, y: y + offset },
            ],
          };
        }),

      removeWidget: (id) =>
        set((state) => ({
          widgetPositions: state.widgetPositions.filter((w) => w.id !== id),
        })),

      updateWidgetPosition: (id, x, y) =>
        set((state) => ({
          widgetPositions: state.widgetPositions.map((w) =>
            w.id === id ? { ...w, x, y } : w
          ),
        })),

      updateWidgetSize: (id, width, height) =>
        set((state) => ({
          widgetPositions: state.widgetPositions.map((w) =>
            w.id === id ? { ...w, width, height } : w
          ),
        })),

      getWidgetPosition: (id) => {
        return get().widgetPositions.find((w) => w.id === id);
      },
    }),
    {
      name: 'dashboard-positions',
    }
  )
);
