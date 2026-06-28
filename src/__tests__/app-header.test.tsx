import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppHeader, AddButton } from '../components/shared/NewGlobalHeader';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

const baseAppValue = {
  filters: [],
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  activeChipFilters: [],
  addFilter: vi.fn(),
  showCompletionMessage: vi.fn(),
};

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('renders the shared todoless logo header with filter, search and one standard add button', () => {
    render(<AppHeader searchPlaceholder="Search calendar…" onAddEmpty={vi.fn()} type="calendar" />);

    expect(screen.getByText('todoless')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search calendar…')).toBeInTheDocument();
    expect(screen.getByTitle('Filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('app-fab');
  });

  it('uses the same AddButton component for empty calendar add action', () => {
    const onAddEmpty = vi.fn();

    render(<AppHeader searchPlaceholder="Search calendar…" onAddEmpty={onAddEmpty} type="calendar" />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAddEmpty).toHaveBeenCalledTimes(1);
  });

  it('uses the same add path for Enter as the plus button and clears the input', () => {
    const onAdd = vi.fn();

    render(<AppHeader searchPlaceholder="Search…" onAdd={onAdd} />);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.change(input, { target: { value: 'EnterTaken' } });
    const prevented = !fireEvent.keyDown(input, { key: 'Enter' });

    expect(prevented).toBe(true);
    expect(onAdd).toHaveBeenCalledWith('EnterTaken');
    expect(input).toHaveValue('');
  });
});

describe('AddButton', () => {
  it('has one shared visual shape', () => {
    render(<AddButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add' })).toHaveClass('app-fab');
  });
});
