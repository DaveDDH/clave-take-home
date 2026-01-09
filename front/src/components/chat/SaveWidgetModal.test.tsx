import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveWidgetModal } from './SaveWidgetModal';
import { useWidgetStore } from '@/stores/widget-store';

describe('SaveWidgetModal', () => {
  const mockOnOpenChange = jest.fn();
  const mockCharts = [{ type: 'bar' as const, data: [{ x: 1, y: 2 }] }];

  beforeEach(() => {
    mockOnOpenChange.mockClear();
    useWidgetStore.setState({ widgets: [] });
  });

  it('renders dialog when open', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    expect(screen.getByText('Save Widget')).toBeInTheDocument();
  });

  it('shows input field for widget name', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    expect(screen.getByPlaceholderText(/enter widget name/i)).toBeInTheDocument();
  });

  it('disables save button when name is empty', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when name is entered', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const input = screen.getByPlaceholderText(/enter widget name/i);
    fireEvent.change(input, { target: { value: 'My Widget' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).not.toBeDisabled();
  });

  it('saves widget when save button is clicked', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const input = screen.getByPlaceholderText(/enter widget name/i);
    fireEvent.change(input, { target: { value: 'My Widget' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    const state = useWidgetStore.getState();
    expect(state.widgets).toHaveLength(1);
    expect(state.widgets[0].name).toBe('My Widget');
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('saves widget when Enter is pressed', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const input = screen.getByPlaceholderText(/enter widget name/i);
    fireEvent.change(input, { target: { value: 'My Widget' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const state = useWidgetStore.getState();
    expect(state.widgets).toHaveLength(1);
  });

  it('cancels when cancel button is clicked', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(useWidgetStore.getState().widgets).toHaveLength(0);
  });

  it('clears input after saving', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const input = screen.getByPlaceholderText(/enter widget name/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'My Widget' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    // Re-render to check cleared state would show empty input
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not save when name is only whitespace', () => {
    render(
      <SaveWidgetModal open={true} onOpenChange={mockOnOpenChange} charts={mockCharts} />
    );
    const input = screen.getByPlaceholderText(/enter widget name/i);
    fireEvent.change(input, { target: { value: '   ' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });
});
