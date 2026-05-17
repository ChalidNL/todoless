import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../context/AppContext', () => ({
  useApp: vi.fn(),
}));

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

describe('GroceryCard layered attributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useApp as any).mockReturnValue({
      updateItem: mockUpdateItem,
      deleteItem: mockDeleteItem,
      shops: [
        { id: 'shop-1', name: 'AH', color: '#3b82f6' },
        { id: 'shop-2', name: 'Jumbo', color: '#10b981' },
      ],
      users: [],
    });
  });

  it('renders layer 1 with checkbox + description + hamburger', () => {
    render(<GroceryCard item={createItem()} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByLabelText('Mark as bought')).toBeTruthy();
    expect(screen.getByLabelText('Open item menu')).toBeTruthy();
  });

  it('shows only grocery attribute icons in layer 2', () => {
    render(<GroceryCard item={createItem()} />);
    fireEvent.click(screen.getByLabelText('Open item menu'));

    expect(screen.getByLabelText('Edit shop')).toBeTruthy();
    expect(screen.getByLabelText('Edit quantity')).toBeTruthy();

    expect(screen.queryByLabelText('Edit assignee')).toBeNull();
    expect(screen.queryByLabelText('Edit due date and recurring')).toBeNull();
    expect(screen.queryByLabelText('Edit flag')).toBeNull();
  });

  it('opens quantity editor in layer 3 and updates quantity', () => {
    render(<GroceryCard item={createItem({ quantity: 2 })} />);
    fireEvent.click(screen.getByLabelText('Open item menu'));
    fireEvent.click(screen.getByLabelText('Edit quantity'));

    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { quantity: 3 });
  });

  it('opens shop editor and selects shop', () => {
    render(<GroceryCard item={createItem()} />);
    fireEvent.click(screen.getByLabelText('Open item menu'));
    fireEvent.click(screen.getByLabelText('Edit shop'));

    fireEvent.click(screen.getByText('AH'));
    expect(mockUpdateItem).toHaveBeenCalledWith('item-1', { shopId: 'shop-1' });
  });

  it('deletes from menu', () => {
    render(<GroceryCard item={createItem()} />);
    fireEvent.click(screen.getByLabelText('Open item menu'));
    fireEvent.click(screen.getByText('Delete'));
    expect(mockDeleteItem).toHaveBeenCalledWith('item-1');
  });
});
