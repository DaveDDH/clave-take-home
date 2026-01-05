import { create } from 'zustand';

interface DashboardState {
  activeWidgetIds: string[];
  addWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  reorderWidgets: (activeId: string, overId: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeWidgetIds: [],
  addWidget: (id) =>
    set((state) => {
      if (state.activeWidgetIds.includes(id)) return state;
      return { activeWidgetIds: [...state.activeWidgetIds, id] };
    }),
  removeWidget: (id) =>
    set((state) => ({
      activeWidgetIds: state.activeWidgetIds.filter((wId) => wId !== id),
    })),
  reorderWidgets: (activeId, overId) =>
    set((state) => {
      const oldIndex = state.activeWidgetIds.indexOf(activeId);
      const newIndex = state.activeWidgetIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return state;

      const newIds = [...state.activeWidgetIds];
      newIds.splice(oldIndex, 1);
      newIds.splice(newIndex, 0, activeId);
      return { activeWidgetIds: newIds };
    }),
}));
