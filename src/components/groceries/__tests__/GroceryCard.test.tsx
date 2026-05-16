import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the AppContext — path must match what the SUT imports
vi.mock('../../../context/AppContext', () => ({
  useApp: vi.fn(),
}));

// Dynamic import to ensure mocks are applied first
const { GroceryCard } = await import('../GroceryCard');
const { useApp } = await import('../../../context/AppContext');

const mockUpdateItem = vi.fn();
const mockDeleteItem = vi.fn();

const createItem = (overrides = {}) => ({
  id: 'item-1',
  title: 'Milk',
  completed: false,
  quantity: 2,
  shopId: undefined as string | undefined,
  labels: [],
  isPrivate: false,
  linkedType: undefined as string | undefined,
  linkedTo: undefined as string | undefined,
  createdAt: Date.now(),
  ...overrides,
});

describe('GroceryCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useApp as any).mockReturnValue({
      updateItem: mockUpdateItem,
      deleteItem: mockDeleteItem,
      shops: [],
      users: [],
    });
  });

  it('renders item title', () => {
    render(<GroceryCard item={createItem()} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('displays quantity value', () => {
    render(<GroceryCard item={createItem({ quantity: 5 })} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows quantity text for completed items', () => {
    render(<GroceryCard item={createItem({ completed: true, quantity: 3 })} />);
    expect(screen.getByText('x3')).toBeTruthy();
  });

  it('increases quantity on plus button click', () => {
    render(<GroceryCard item={createItem({ quantity: 2 })} />);
    const buttons = screen.getAllByLabelText('Increase quantity');
    fireEvent.click(buttons[0]);
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 3 });
  });

  it('decreases quantity on minus button click', () => {
    render(<GroceryCard item={createItem({ quantity: 3 })} />);
    const buttons = screen.getAllByLabelText('Decrease quantity');
    fireEvent.click(buttons[0]);
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 2 });
  });

  it('does not decrease quantity below 0', () => {
    render(<GroceryCard item={createItem({ quantity: 1 })} />);
    const buttons = screen.getAllByLabelText('Decrease quantity');
    fireEvent.click(buttons[0]);
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 0 });
  });

  it('toggles completed status when checkbox is clicked', () => {
    render(<GroceryCard item={createItem({ completed: false })} />);
    const checkbox = screen.getByLabelText('Mark as bought');
    fireEvent.click(checkbox);
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { completed: true });
  });

  it('applies line-through styling when completed', () => {
    render(<GroceryCard item={createItem({ completed: true })} />);
    const title = screen.getByText('Milk');
    expect(title.className).toContain('line-through');
  });

  it('shows delete action in menu', () => {
    render(<GroceryCard item={createItem()} />);
    // All buttons: [checkbox, decrease, increase, menu, ...shops?]
    // The menu button is the last one that toggles the menu
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('calls deleteItem when delete is confirmed', () => {
    render(<GroceryCard item={createItem()} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    fireEvent.click(screen.getByText('Delete'));
    expect(mockDeleteItem).toHaveBeenCalledWith('item-1');
  });
});
