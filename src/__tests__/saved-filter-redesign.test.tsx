import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasksView } from '../components/TasksView';
import { GroceriesView } from '../components/groceries/GroceriesView';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));
vi.mock('../components/shared/NewGlobalHeader', () => ({
  NewGlobalHeader: () => <div data-testid="header" />,
}));
vi.mock('../components/shared/DueDateNotifications', () => ({
  DueDateNotifications: () => null,
}));
vi.mock('../components/shared/TaskCard', () => ({ TaskCard: () => null }));
vi.mock('../components/shared/UnifiedCard', () => ({ UnifiedCard: () => null }));

const taskFilter = {
  id: 'task-filter',
  name: 'Urgent',
  type: 'task',
  labelIds: [],
  showCompleted: true,
  chipFilters: [{ type: 'priority', id: 'high', label: 'High', color: '#ef4444' }],
};

const itemFilter = {
  id: 'item-filter',
  name: 'Market only',
  type: 'item',
  labelIds: [],
  showCompleted: true,
  chipFilters: [{ type: 'shop', id: 'market', label: 'Market', color: '#ec4899' }],
};

function baseValue() {
  return {
    tasks: [],
    labels: [],
    items: [],
    shops: [],
    filters: [taskFilter, itemFilter],
    activeLabelFilters: [],
    activeChipFilters: [],
    toggleChipFilter: vi.fn(),
    clearChipFilters: vi.fn(),
    addTask: vi.fn(),
    addItem: vi.fn(),
    addFilter: vi.fn(),
    deleteFilter: vi.fn(),
    uncheckAllDoneTasks: vi.fn(),
    uncheckAllDoneItems: vi.fn(),
    deleteTask: vi.fn(),
    showCompletionMessage: vi.fn(),
  };
}

describe('saved filter parity in redesigned list screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseValue());
  });

  it('applies, deletes and saves task filters from the redesigned Tasks screen', () => {
    const value = baseValue();
    useAppMock.mockReturnValue(value);
    vi.spyOn(window, 'prompt').mockReturnValueOnce('My task filter');

    render(<TasksView />);
    fireEvent.click(screen.getByRole('button', { name: /Saved filters/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Urgent' }));
    expect(value.clearChipFilters).toHaveBeenCalledTimes(1);
    expect(value.toggleChipFilter).toHaveBeenCalledWith('priority', 'high', 'High', '#ef4444');

    fireEvent.click(screen.getByRole('button', { name: 'Save filter' }));
    expect(value.addFilter).toHaveBeenCalledWith(expect.objectContaining({
      name: 'My task filter',
      type: 'task',
    }));
  });

  it('applies and deletes grocery filters from the redesigned Groceries screen', () => {
    const value = baseValue();
    useAppMock.mockReturnValue(value);

    render(<GroceriesView />);
    fireEvent.click(screen.getByRole('button', { name: /Saved filters/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Market only' }));
    expect(value.deleteFilter).toHaveBeenCalledWith('item-filter');

    fireEvent.click(screen.getByRole('button', { name: 'Market only' }));
    expect(value.clearChipFilters).toHaveBeenCalledTimes(1);
    expect(value.toggleChipFilter).toHaveBeenCalledWith('shop', 'market', 'Market', '#ec4899');
  });
});
