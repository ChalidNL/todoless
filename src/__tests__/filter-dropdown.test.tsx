import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppHeader } from '../components/shared/NewGlobalHeader';
import { entityColor } from '../lib/entity-colors';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

const labels = [
  { id: 'l1', name: 'Family', color: '#3b82f6', visibility: 'family', isPrivate: false, sharedWith: [] },
  { id: 'l2', name: 'Work', color: '#ef4444', visibility: 'family', isPrivate: false, sharedWith: [] },
];

const users = [
  {
    id: 'u1',
    firstName: 'Alice',
    lastName: 'Doe',
    email: 'alice@example.com',
    role: 'member',
    member_type: 'human',
  },
  {
    id: 'u2',
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob@example.com',
    role: 'member',
    member_type: 'human',
  },
];

const tasksWithDueDate = [
  { id: 't1', title: 'Pay rent', status: 'todo', blocked: false, labels: [], dueDate: new Date(2026, 9, 1, 12, 0, 0).getTime(), createdAt: 1 },
  { id: 't2', title: 'Call mom', status: 'todo', blocked: false, labels: [], dueDate: new Date(2026, 9, 15, 12, 0, 0).getTime(), createdAt: 2 },
];

const baseAppValue = {
  filters: [],
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  activeChipFilters: [],
  users: [],
  tasks: [],
  labels: [],
  reminders: [],
  appSettings: {},
  showCompletionMessage: vi.fn(),
};

const openDropdown = () => {
  fireEvent.click(screen.getByTitle('Filters'));
};

describe('AppHeader filter dropdown — full filter UI (GH#89)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('renders label, assignee, priority, repeat and date sections for task screens', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      labels,
      users,
      tasks: tasksWithDueDate,
    });

    render(<AppHeader screen="taken" />);
    openDropdown();

    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText('Assignee')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Repeat')).toBeInTheDocument();
    expect(screen.getByText('Due date')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Family' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Work' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alice' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bob' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oct 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oct 15' })).toBeInTheDocument();
  });

  it('activates a label filter from the dropdown', () => {
    useAppMock.mockReturnValue({ ...baseAppValue, labels, users, tasks: [] });
    const toggleChipFilter = baseAppValue.toggleChipFilter;

    render(<AppHeader screen="inbox" />);
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'Family' }));

    expect(toggleChipFilter).toHaveBeenCalledWith('label', 'l1', 'Family', '#3b82f6');
  });

  it('activates an assignee filter from the dropdown', () => {
    useAppMock.mockReturnValue({ ...baseAppValue, users, tasks: [] });
    const toggleChipFilter = baseAppValue.toggleChipFilter;

    render(<AppHeader screen="taken" />);
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));

    expect(toggleChipFilter).toHaveBeenCalledWith('assignee', 'u2', 'Bob', entityColor('u2'));
  });

  it('activates a priority filter from the dropdown', () => {
    useAppMock.mockReturnValue(baseAppValue);
    const toggleChipFilter = baseAppValue.toggleChipFilter;

    render(<AppHeader screen="taken" />);
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'High' }));

    expect(toggleChipFilter).toHaveBeenCalledWith('priority', 'high', 'High', '#ef4444');
  });

  it('activates a repeat filter from the dropdown', () => {
    useAppMock.mockReturnValue(baseAppValue);
    const toggleChipFilter = baseAppValue.toggleChipFilter;

    render(<AppHeader screen="taken" />);
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));

    expect(toggleChipFilter).toHaveBeenCalledWith('repeat', 'day', 'Daily');
  });

  it('activates a date filter derived from task due dates', () => {
    useAppMock.mockReturnValue({ ...baseAppValue, tasks: tasksWithDueDate });
    const toggleChipFilter = baseAppValue.toggleChipFilter;

    render(<AppHeader screen="inbox" />);
    openDropdown();
    fireEvent.click(screen.getByRole('button', { name: 'Oct 15' }));

    expect(toggleChipFilter).toHaveBeenCalledWith('date', 'Oct 15');
  });

  it('marks active chips with aria-pressed', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      labels,
      users,
      tasks: tasksWithDueDate,
      activeChipFilters: [
        { type: 'label', id: 'l1', label: 'Family' },
        { type: 'priority', id: 'high', label: 'High' },
      ],
    });

    render(<AppHeader screen="taken" />);
    openDropdown();

    expect(screen.getByRole('button', { name: 'Family' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the date section when no task has a due date', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      labels,
      users,
      tasks: [{ id: 't1', title: 'No date', status: 'todo', blocked: false, labels: [], createdAt: 1 }],
    });

    render(<AppHeader screen="taken" />);
    openDropdown();

    expect(screen.queryByText('Due date')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Family' })).toBeInTheDocument();
  });

  it('keeps the new filter sections off non-task screens (shop)', () => {
    useAppMock.mockReturnValue({ ...baseAppValue, labels, users, tasks: tasksWithDueDate });

    render(<AppHeader screen="shop" />);
    openDropdown();

    expect(screen.queryByText('Labels')).not.toBeInTheDocument();
    expect(screen.queryByText('Assignee')).not.toBeInTheDocument();
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
    expect(screen.queryByText('Repeat')).not.toBeInTheDocument();
    expect(screen.queryByText('Due date')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'High' })).not.toBeInTheDocument();
  });
});