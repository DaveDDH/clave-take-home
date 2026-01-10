import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock api
jest.unstable_mockModule('@/lib/api', () => ({
  streamChatResponse: jest.fn(),
  fetchConversation: jest.fn(),
}));

const { ChatInput } = await import('./ChatInput');
const { useChatStore } = await import('@/stores/chat-store');

describe('ChatInput', () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnSend.mockClear();
    useChatStore.setState({
      selectedModel: 'gpt-5.2',
      reasoningLevel: 'high',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders textarea', () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByPlaceholderText(/ask something/i)).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
  });

  it('disables submit button when input is empty', () => {
    render(<ChatInput onSend={mockOnSend} />);
    const submitButton = screen.getByRole('button', { name: /send message/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when input has content', async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText(/ask something/i);

    fireEvent.change(textarea, { target: { value: 'Hello' } });

    const submitButton = screen.getByRole('button', { name: /send message/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls onSend when form is submitted', async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText(/ask something/i);
    const form = textarea.closest('form')!;

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.submit(form);

    expect(mockOnSend).toHaveBeenCalledWith('Hello');
  });

  it('clears input after sending', async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText(/ask something/i) as HTMLTextAreaElement;
    const form = textarea.closest('form')!;

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.submit(form);

    expect(textarea.value).toBe('');
  });

  it('sends message on Enter key', async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText(/ask something/i);

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(mockOnSend).toHaveBeenCalledWith('Hello');
  });

  it('does not send on Shift+Enter', async () => {
    render(<ChatInput onSend={mockOnSend} />);
    const textarea = screen.getByPlaceholderText(/ask something/i);

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('disables input when disabled prop is true', () => {
    render(<ChatInput onSend={mockOnSend} disabled />);
    const textarea = screen.getByPlaceholderText(/ask something/i);
    expect(textarea).toBeDisabled();
  });

  it('does not submit when disabled', async () => {
    render(<ChatInput onSend={mockOnSend} disabled />);
    const textarea = screen.getByPlaceholderText(/ask something/i);
    const form = textarea.closest('form')!;

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.submit(form);

    expect(mockOnSend).not.toHaveBeenCalled();
  });

  it('shows model selector after mounting', async () => {
    render(<ChatInput onSend={mockOnSend} />);

    // Run timers to trigger mount effect
    jest.runAllTimers();

    // Should show model name
    expect(screen.getByText('GPT 5.2')).toBeInTheDocument();
  });

  it('shows reasoning selector after mounting', async () => {
    render(<ChatInput onSend={mockOnSend} />);

    // Run timers to trigger mount effect
    jest.runAllTimers();

    // Should show reasoning level
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('shows disclaimer text', () => {
    render(<ChatInput onSend={mockOnSend} />);
    expect(screen.getByText(/clave is ai and can make mistakes/i)).toBeInTheDocument();
  });
});
