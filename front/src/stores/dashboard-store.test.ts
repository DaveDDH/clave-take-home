import { describe, it, expect, beforeEach } from '@jest/globals';
import { useDashboardStore } from './dashboard-store';

describe('useDashboardStore', () => {
  beforeEach(() => {
    useDashboardStore.setState({ widgetPositions: [] });
  });

  describe('initial state', () => {
    it('starts with empty widget positions', () => {
      const state = useDashboardStore.getState();
      expect(state.widgetPositions).toEqual([]);
    });
  });

  describe('addWidget', () => {
    it('adds a widget with default position', () => {
      useDashboardStore.getState().addWidget('widget-1');
      const state = useDashboardStore.getState();
      expect(state.widgetPositions).toHaveLength(1);
      expect(state.widgetPositions[0]).toEqual({ id: 'widget-1', x: 20, y: 20 });
    });

    it('adds a widget with custom position', () => {
      useDashboardStore.getState().addWidget('widget-1', 100, 200);
      const state = useDashboardStore.getState();
      expect(state.widgetPositions[0]).toEqual({ id: 'widget-1', x: 100, y: 200 });
    });

    it('stacks widgets with offset', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().addWidget('widget-2');
      const state = useDashboardStore.getState();
      expect(state.widgetPositions).toHaveLength(2);
      expect(state.widgetPositions[1].x).toBe(50); // 20 + 30
      expect(state.widgetPositions[1].y).toBe(50);
    });

    it('does not add duplicate widgets', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().addWidget('widget-1');
      const state = useDashboardStore.getState();
      expect(state.widgetPositions).toHaveLength(1);
    });
  });

  describe('removeWidget', () => {
    it('removes a widget by id', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().addWidget('widget-2');
      useDashboardStore.getState().removeWidget('widget-1');
      const state = useDashboardStore.getState();
      expect(state.widgetPositions).toHaveLength(1);
      expect(state.widgetPositions[0].id).toBe('widget-2');
    });

    it('does nothing when removing non-existent widget', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().removeWidget('non-existent');
      const state = useDashboardStore.getState();
      expect(state.widgetPositions).toHaveLength(1);
    });
  });

  describe('updateWidgetPosition', () => {
    it('updates widget position', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().updateWidgetPosition('widget-1', 300, 400);
      const state = useDashboardStore.getState();
      expect(state.widgetPositions[0]).toEqual({ id: 'widget-1', x: 300, y: 400 });
    });

    it('does nothing for non-existent widget', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().updateWidgetPosition('non-existent', 300, 400);
      const state = useDashboardStore.getState();
      expect(state.widgetPositions[0].x).toBe(20);
    });
  });

  describe('updateWidgetSize', () => {
    it('updates widget size', () => {
      useDashboardStore.getState().addWidget('widget-1');
      useDashboardStore.getState().updateWidgetSize('widget-1', 500, 300);
      const state = useDashboardStore.getState();
      expect(state.widgetPositions[0].width).toBe(500);
      expect(state.widgetPositions[0].height).toBe(300);
    });
  });

  describe('getWidgetPosition', () => {
    it('returns widget position by id', () => {
      useDashboardStore.getState().addWidget('widget-1', 100, 200);
      const position = useDashboardStore.getState().getWidgetPosition('widget-1');
      expect(position).toEqual({ id: 'widget-1', x: 100, y: 200 });
    });

    it('returns undefined for non-existent widget', () => {
      const position = useDashboardStore.getState().getWidgetPosition('non-existent');
      expect(position).toBeUndefined();
    });
  });
});
