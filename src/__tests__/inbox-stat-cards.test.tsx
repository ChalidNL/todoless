import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InboxBacklog } from '../components/InboxBacklog';
import type { Task } from '../types';

const toggleChipFilter = vi.fn();
const clearChipFilters = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    tasks: [
      task({ id: 'backlog-1', title: 'Backlog task', status: 'backlog' }),
      task({ id: 'todo-1', title: 'Todo task', status: 'todo' }),
      task({ id: 'blocked-1', title: 'Blocked task', status: 'todo', blocked: true }),
      task({ id: 'done-1', title: 'Done task', status: 'done', completedAt: Date.now() }),
    ],
    updateTask: vi.fn(),
    addTask: vi.fn(),
    activeChipFilters: [],
    toggleChipFilter,
    clearChipFilters,
    showCompletionMessage: vi.fn(),
  }),
}));

vi.mock('../components/shared/NewGlobalHeader', () => ({
  NewGlobalHeader: () => <div data-testid="global-header" />,
}));

vi.mock('../components/shared/CompactTaskCard', () => ({
  CompactTaskCard: ({ task }: { task: Task }) => <div data-testid={`task-${task.id}`}>{task.title}</div>,
}));

describe('Inbox stat cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the four status cards as tight icon-count filled buttons with accessible labels', () => {
    render(<InboxBacklog />);

    for (const key of ['backlog', 'todo', 'blocked', 'done-today']) {
      const card = screen.getByTestId(`inbox-stat-card-${key}`);
      expect(card).toHaveClass('text-white');
      expect(card).toHaveClass('shadow-sm');
      expect(card).toHaveClass('min-h-[56px]');
      expect(card).not.toHaveClass('bg-white');
      expect(card.querySelector('[data-testid="inbox-stat-watermark"]')).not.toBeInTheDocument();
    }

    expect(screen.getByTestId('inbox-stat-card-backlog')).toHaveStyle({ backgroundColor: '#2563eb' });
    expect(screen.getByTestId('inbox-stat-card-todo')).toHaveStyle({ backgroundColor: '#059669' });
    expect(screen.getByTestId('inbox-stat-card-blocked')).toHaveStyle({ backgroundColor: '#e11d48' });
    expect(screen.getByTestId('inbox-stat-card-done-today')).toHaveStyle({ backgroundColor: '#7c3aed' });
    expect(screen.getByTestId('inbox-stat-card-todo')).toHaveAttribute('aria-label', 'Todo Sprint: 2');
  });

  it('keeps the existing tap behavior for status filters', () => {
    render(<InboxBacklog />);

    fireEvent.click(screen.getByTestId('inbox-stat-card-todo'));

    expect(clearChipFilters).toHaveBeenCalledTimes(1);
    expect(toggleChipFilter).toHaveBeenCalledWith('status', 'todo', 'Todo Sprint');
  });
});

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Task',
    status: 'backlog',
    blocked: false,
    labels: [],
    flag: false,
    createdAt: Date.now(),
    showInCalendar: true,
    ...overrides,
  };
}
