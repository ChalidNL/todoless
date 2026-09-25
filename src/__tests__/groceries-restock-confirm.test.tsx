import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GroceriesView } from '../components/groceries/GroceriesView';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/shared/UnifiedCard', () => ({
  UnifiedCard: ({ entity }: { entity: { title: string } }) => <div>{entity.title}</div>,
}));

vi.mock('../components/shared/NewGlobalHeader', () => ({
  NewGlobalHeader: () => <div data-testid="new-global-header" />,
}));

const baseAppValue = {
  addItem: vi.fn(),
  activeChipFilters: [],
  clearChipFilters: vi.fn(),
  filters: [],
  items: [
    {
      id: 'bought-1',
      title: 'Milk',
      completed: true,
      labels: [],
      createdAt: 1,
      quantity: 2,
    },
  ],
  showCompletionMessage: vi.fn(),
  toggleChipFilter: vi.fn(),
  uncheckAllDoneItems: vi.fn(),
};

describe('GroceriesView restock action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue({
      ...baseAppValue,
      addItem: vi.fn(),
      clearChipFilters: vi.fn(),
      showCompletionMessage: vi.fn(),
      toggleChipFilter: vi.fn(),
      uncheckAllDoneItems: vi.fn(),
    });
  });

  it('asks for confirmation before restocking completed groceries', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const uncheckAllDoneItems = vi.fn();
    const showCompletionMessage = vi.fn();

    useAppMock.mockReturnValue({
      ...baseAppValue,
      showCompletionMessage,
      uncheckAllDoneItems,
    });

    render(<GroceriesView />);

    const restockButton = screen.getByRole('button', { name: 'Restock' });
    fireEvent.click(restockButton);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(uncheckAllDoneItems).not.toHaveBeenCalled();
    expect(showCompletionMessage).not.toHaveBeenCalled();
  });

  it('restocks completed groceries after confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const uncheckAllDoneItems = vi.fn();
    const showCompletionMessage = vi.fn();

    useAppMock.mockReturnValue({
      ...baseAppValue,
      showCompletionMessage,
      uncheckAllDoneItems,
    });

    render(<GroceriesView />);

    const restockButton = screen.getByRole('button', { name: 'Restock' });
    fireEvent.click(restockButton);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(uncheckAllDoneItems).toHaveBeenCalledTimes(1);
    expect(showCompletionMessage).toHaveBeenCalledWith('Groceries restocked');
  });
});
