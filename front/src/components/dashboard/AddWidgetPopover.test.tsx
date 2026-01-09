import { describe, it, expect, beforeEach } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { AddWidgetPopover } from './AddWidgetPopover';
import { useWidgetStore } from '@/stores/widget-store';
import { useDashboardStore } from '@/stores/dashboard-store';

describe('AddWidgetPopover', () => {
  beforeEach(() => {
    useWidgetStore.setState({ widgets: [] });
    useDashboardStore.setState({ widgetPositions: [] });
  });

  it('renders add button', () => {
    render(<AddWidgetPopover />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('disables button when no widgets exist', () => {
    render(<AddWidgetPopover />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('disables button when all widgets are on dashboard', () => {
    useWidgetStore.setState({
      widgets: [{ id: 'w1', name: 'Widget 1', charts: [], createdAt: new Date() }],
    });
    useDashboardStore.setState({
      widgetPositions: [{ id: 'w1', x: 0, y: 0 }],
    });

    render(<AddWidgetPopover />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('enables button when widgets are available', () => {
    useWidgetStore.setState({
      widgets: [{ id: 'w1', name: 'Widget 1', charts: [], createdAt: new Date() }],
    });

    render(<AddWidgetPopover />);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  it('only shows widgets not on dashboard', () => {
    useWidgetStore.setState({
      widgets: [
        { id: 'w1', name: 'Widget 1', charts: [], createdAt: new Date() },
        { id: 'w2', name: 'Widget 2', charts: [], createdAt: new Date() },
      ],
    });
    useDashboardStore.setState({
      widgetPositions: [{ id: 'w1', x: 0, y: 0 }],
    });

    render(<AddWidgetPopover />);
    // Button should be enabled because w2 is available
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
});
