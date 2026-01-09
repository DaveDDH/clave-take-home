import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { useWidgetStore } from './widget-store';
import type { WidgetChart } from '@/types/widget';

// Mock crypto.randomUUID for consistent test IDs
const mockUUID = 'test-uuid-1234';
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: jest.fn(() => mockUUID),
  },
});

describe('useWidgetStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useWidgetStore.setState({ widgets: [] });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with an empty widgets array', () => {
      const { widgets } = useWidgetStore.getState();
      expect(widgets).toEqual([]);
    });
  });

  describe('addWidget', () => {
    it('adds a widget with correct structure', () => {
      const charts: WidgetChart[] = [
        { type: 'bar', data: [{ name: 'A', value: 10 }] },
      ];

      useWidgetStore.getState().addWidget('Test Widget', charts);

      const { widgets } = useWidgetStore.getState();
      expect(widgets).toHaveLength(1);
      expect(widgets[0]).toMatchObject({
        id: mockUUID,
        name: 'Test Widget',
        charts,
      });
      expect(widgets[0].createdAt).toBeInstanceOf(Date);
    });

    it('adds multiple widgets', () => {
      const charts: WidgetChart[] = [];

      useWidgetStore.getState().addWidget('Widget 1', charts);
      useWidgetStore.getState().addWidget('Widget 2', charts);

      const { widgets } = useWidgetStore.getState();
      expect(widgets).toHaveLength(2);
    });
  });

  describe('removeWidget', () => {
    it('removes a widget by id', () => {
      const charts: WidgetChart[] = [];
      useWidgetStore.getState().addWidget('Widget to Remove', charts);

      const { widgets: beforeRemove } = useWidgetStore.getState();
      expect(beforeRemove).toHaveLength(1);

      useWidgetStore.getState().removeWidget(mockUUID);

      const { widgets: afterRemove } = useWidgetStore.getState();
      expect(afterRemove).toHaveLength(0);
    });

    it('does nothing when removing non-existent widget', () => {
      const charts: WidgetChart[] = [];
      useWidgetStore.getState().addWidget('Widget', charts);

      useWidgetStore.getState().removeWidget('non-existent-id');

      const { widgets } = useWidgetStore.getState();
      expect(widgets).toHaveLength(1);
    });
  });

  describe('updateWidget', () => {
    it('updates widget name', () => {
      const charts: WidgetChart[] = [];
      useWidgetStore.getState().addWidget('Original Name', charts);

      useWidgetStore.getState().updateWidget(mockUUID, { name: 'Updated Name' });

      const { widgets } = useWidgetStore.getState();
      expect(widgets[0].name).toBe('Updated Name');
    });

    it('updates widget charts', () => {
      const initialCharts: WidgetChart[] = [
        { type: 'bar', data: [{ name: 'A', value: 10 }] },
      ];
      const newCharts: WidgetChart[] = [
        { type: 'line', data: [{ name: 'B', value: 20 }] },
      ];

      useWidgetStore.getState().addWidget('Widget', initialCharts);
      useWidgetStore.getState().updateWidget(mockUUID, { charts: newCharts });

      const { widgets } = useWidgetStore.getState();
      expect(widgets[0].charts).toEqual(newCharts);
    });

    it('preserves other properties when updating', () => {
      const charts: WidgetChart[] = [];
      useWidgetStore.getState().addWidget('Original', charts);

      const { widgets: beforeUpdate } = useWidgetStore.getState();
      const originalCreatedAt = beforeUpdate[0].createdAt;

      useWidgetStore.getState().updateWidget(mockUUID, { name: 'Updated' });

      const { widgets: afterUpdate } = useWidgetStore.getState();
      expect(afterUpdate[0].id).toBe(mockUUID);
      expect(afterUpdate[0].createdAt).toEqual(originalCreatedAt);
      expect(afterUpdate[0].charts).toEqual(charts);
    });

    it('does nothing when updating non-existent widget', () => {
      const charts: WidgetChart[] = [];
      useWidgetStore.getState().addWidget('Widget', charts);

      useWidgetStore.getState().updateWidget('non-existent-id', { name: 'New Name' });

      const { widgets } = useWidgetStore.getState();
      expect(widgets[0].name).toBe('Widget');
    });
  });
});
