import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock the AppContext — path must match what the SUT imports
vi.mock('../../../context/AppContext', () => ({
  useApp: vi.fn(),
}));

// Mock LabelBadge
vi.mock('../../shared/LabelBadge', () => ({
  LabelBadge: ({ label }: any) => (
    <span data-testid={`label-badge-${label.name}`}>{label.name}</span>
  ),
}));

// Dynamic import to ensure mocks are applied first
const { GroceryCard } = await import('../GroceryCard');
const { useApp } = await import('../../../context/AppContext');

const mockUpdateItem = vi.fn();
const mockDeleteItem = vi.fn();
const mockShops = [
  { id: 's1', name: 'Albert Heijn', color: '#3b82f6' },
  { id: 's2', name: 'Jumbo', color: '#f59e0b' },
];

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
      shops: mockShops,
    });
  });

  it('renders item title', () => {
    render(<GroceryCard item={createItem()} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('shows In Stock status for quantity greater than 1', () => {
    render(<GroceryCard item={createItem({ quantity: 3 })} />);
    expect(screen.getByText('In Stock')).toBeTruthy();
  });

  it('shows Few status for quantity equal to 1', () => {
    render(<GroceryCard item={createItem({ quantity: 1 })} />);
    expect(screen.getByText('Few')).toBeTruthy();
  });

  it('shows Missing status for quantity equal to 0', () => {
    render(<GroceryCard item={createItem({ quantity: 0 })} />);
    expect(screen.getByText('Missing')).toBeTruthy();
  });

  it('shows Bought status when completed', () => {
    render(<GroceryCard item={createItem({ completed: true, quantity: 2 })} />);
    expect(screen.getByText('Bought')).toBeTruthy();
  });

  it('displays quantity value', () => {
    render(<GroceryCard item={createItem({ quantity: 5 })} />);
    expect(screen.getByText('5')).toBeTruthy();
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

  it('toggles completed status via menu button', () => {
    render(<GroceryCard item={createItem({ completed: false })} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    const button = screen.getByTitle('Mark as bought');
    fireEvent.click(button);
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { completed: true });
  });

  it('shows shop badge when shopId is set', () => {
    render(<GroceryCard item={createItem({ shopId: 's1' })} />);
    expect(screen.getByTestId('label-badge-Albert Heijn')).toBeTruthy();
  });

  // Removed: private lock and linked entity badge tests (features removed from MVP)

  it('applies line-through styling when completed', () => {
    render(<GroceryCard item={createItem({ completed: true })} />);
    const title = screen.getByText('Milk');
    expect(title.className).toContain('line-through');
  });
});
