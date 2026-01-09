import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemoveWidgetModal } from './RemoveWidgetModal';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useWidgetStore } from '@/stores/widget-store';

describe('RemoveWidgetModal', () => {
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    mockOnOpenChange.mockClear();
    useWidgetStore.setState({
      widgets: [{ id: 'w1', name: 'Test Widget', charts: [], createdAt: new Date() }],
    });
    useDashboardStore.setState({
      widgetPositions: [{ id: 'w1', x: 0, y: 0 }],
    });
  });

  it('renders dialog when open', () => {
    render(
      <RemoveWidgetModal
        open={true}
        onOpenChange={mockOnOpenChange}
        widgetId="w1"
        widgetName="Test Widget"
      />
    );
    expect(screen.getByText('Remove Widget')).toBeInTheDocument();
  });

  it('shows widget name in description', () => {
    render(
      <RemoveWidgetModal
        open={true}
        onOpenChange={mockOnOpenChange}
        widgetId="w1"
        widgetName="Test Widget"
      />
    );
    expect(screen.getByText(/test widget/i)).toBeInTheDocument();
  });

  it('has three action buttons', () => {
    render(
      <RemoveWidgetModal
        open={true}
        onOpenChange={mockOnOpenChange}
        widgetId="w1"
        widgetName="Test Widget"
      />
    );
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove from dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete from project/i })).toBeInTheDocument();
  });

  it('closes modal on cancel', () => {
    render(
      <RemoveWidgetModal
        open={true}
        onOpenChange={mockOnOpenChange}
        widgetId="w1"
        widgetName="Test Widget"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('removes from dashboard only when "Remove from Dashboard" is clicked', () => {
    render(
      <RemoveWidgetModal
        open={true}
        onOpenChange={mockOnOpenChange}
        widgetId="w1"
        widgetName="Test Widget"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /remove from dashboard/i }));

    // Widget should be removed from dashboard but still in widget store
    expect(useDashboardStore.getState().widgetPositions).toHaveLength(0);
    expect(useWidgetStore.getState().widgets).toHaveLength(1);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('removes from both dashboard and project when "Delete from Project" is clicked', () => {
    render(
      <RemoveWidgetModal
        open={true}
        onOpenChange={mockOnOpenChange}
        widgetId="w1"
        widgetName="Test Widget"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /delete from project/i }));

    // Widget should be removed from both stores
    expect(useDashboardStore.getState().widgetPositions).toHaveLength(0);
    expect(useWidgetStore.getState().widgets).toHaveLength(0);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
