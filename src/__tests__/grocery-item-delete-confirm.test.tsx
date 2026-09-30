import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UnifiedCard } from '../components/shared/UnifiedCard';
import type { Item } from '../types';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    createSubtask: vi.fn(),
  },
}));

const baseItem: Item = {
  id: 'item-1',
  title: 'Olive oil',
  completed: false,
  labels: [],
  createdAt: Date.now(),
  quantity: 2,
};

const baseAppValue = {
  labels: [],
  users: [],
  shops: [],
  tasks: [],
  updateTask: vi.fn(),
  updateItem: vi.fn(),
  deleteTask: vi.fn(),
  deleteItem: vi.fn(),
  addLabel: vi.fn(),
  addShop: vi.fn(),
  swapEntity: vi.fn(),
  toggleChipFilter: vi.fn(),
  isChipFilterActive: vi.fn(() => false),
  refreshEntries: vi.fn(),
  showCompletionMessage: vi.fn(),
  moveTaskToStatus: vi.fn(),
};

describe('UnifiedCard grocery item delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('does not delete the item when the confirmation is dismissed', () => {
    const deleteItem = vi.fn();
    useAppMock.mockReturnValue({ ...baseAppValue, deleteItem });

    render(<UnifiedCard entity={baseItem} type="item" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByText('Delete this item?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'No' }));

    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete this item?')).not.toBeInTheDocument();
  });

  it('deletes the item only after confirmation', () => {
    const deleteItem = vi.fn();
    useAppMock.mockReturnValue({ ...baseAppValue, deleteItem });

    render(<UnifiedCard entity={baseItem} type="item" />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(deleteItem).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(deleteItem).toHaveBeenCalledWith('item-1');
  });
});

describe('UnifiedCard grocery item quantity floor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('disables the decrease button when quantity is 1', () => {
    const updateItem = vi.fn();
    useAppMock.mockReturnValue({ ...baseAppValue, updateItem });

    render(<UnifiedCard entity={{ ...baseItem, quantity: 1 }} type="item" />);

    const decreaseButton = screen.getByRole('button', { name: 'Decrease quantity' });
    expect(decreaseButton).toBeDisabled();

    fireEvent.click(decreaseButton);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('decreases quantity to a minimum of 1 and never to 0', () => {
    const updateItem = vi.fn();
    useAppMock.mockReturnValue({ ...baseAppValue, updateItem });

    render(<UnifiedCard entity={{ ...baseItem, quantity: 2 }} type="item" />);

    const decreaseButton = screen.getByRole('button', { name: 'Decrease quantity' });
    fireEvent.click(decreaseButton);

    expect(updateItem).toHaveBeenCalledWith('item-1', { quantity: 1 });
    expect(updateItem).not.toHaveBeenCalledWith('item-1', { quantity: 0 });
  });

  it('increases quantity with the plus button', () => {
    const updateItem = vi.fn();
    useAppMock.mockReturnValue({ ...baseAppValue, updateItem });

    render(<UnifiedCard entity={{ ...baseItem, quantity: 1 }} type="item" />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    expect(updateItem).toHaveBeenCalledWith('item-1', { quantity: 2 });
  });
});