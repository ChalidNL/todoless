import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { InboxBacklog } from '../components/InboxBacklog';
import type { Task } from '../types';

const toggleChipFilter = vi.fn();
const clearChipFilters = vi.fn();
const updateTaskMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    tasks: [
      task({ id: 'backlog-1', title: 'Backlog task', status: 'backlog' }),
      task({ id: 'todo-1', title: 'Todo task', status: 'todo' }),
      task({ id: 'blocked-1', title: 'Blocked task', status: 'todo', blocked: true }),
      task({ id: 'done-1', title: 'Done task', status: 'done', completedAt: Date.now() }),
      task({ id: 'stale-1', title: 'Reopened task', status: 'todo', completedAt: Date.now() }),
    ],
    updateTask: updateTaskMock,
    addTask: vi.fn(),
    activeChipFilters: [],
    toggleChipFilter,
    clearChipFilters,
    showCompletionMessage: vi.fn(),
  }),
}));

vi.mock('../components/shared/NewGlobalHeader', () => ({
  AppHeader: () => <div data-testid="global-header" />,
}));

vi.mock('../components/shared/CompactTaskCard', () => ({
  CompactTaskCard: ({ task }: { task: Task }) => <div data-testid={`task-${task.id}`}>{task.title}</div>,
}));

describe('Inbox stat cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the four status cards as large gradient buttons with accessible labels', () => {
    render(<InboxBacklog />);

    for (const key of ['backlog', 'todo', 'blocked', 'done-today']) {
      const card = screen.getByTestId(`inbox-stat-card-${key}`);
      expect(card).toHaveClass('app-status-card');
      expect(card).toHaveClass('text-white');
      expect(card).not.toHaveClass('bg-white');
      expect(card.querySelector('[data-testid="inbox-stat-watermark"]')).not.toBeInTheDocument();
      expect(card.querySelector('p')).toHaveClass('text-2xl');
    }

    expect(screen.getByTestId('inbox-stat-card-backlog')).toHaveAttribute('data-status', 'backlog');
    expect(screen.getByTestId('inbox-stat-card-todo')).toHaveAttribute('data-status', 'todo');
    expect(screen.getByTestId('inbox-stat-card-blocked')).toHaveAttribute('data-status', 'blocked');
    expect(screen.getByTestId('inbox-stat-card-done-today')).toHaveAttribute('data-status', 'done-today');
    expect(screen.getByTestId('inbox-stat-card-todo')).toHaveAttribute('aria-label', 'Todo Sprint: 3');
  });

  it('keeps the existing tap behavior for status filters', () => {
    render(<InboxBacklog />);

    fireEvent.click(screen.getByTestId('inbox-stat-card-todo'));

    expect(clearChipFilters).toHaveBeenCalledTimes(1);
    expect(toggleChipFilter).toHaveBeenCalledWith('status', 'todo', 'Todo Sprint');
  });

  it('does not count a reopened task in done-today even if a stale completedAt survives (GH#80)', () => {
    render(<InboxBacklog />);

    // done-1 is done-today (1); stale-1 has completedAt today but status todo
    expect(screen.getByTestId('inbox-stat-card-done-today')).toHaveTextContent('1');
  });

  it('batch-push sends clear-completion payload so PocketBase nulls completed_at (GH#80)', () => {
    render(<InboxBacklog />);

    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText(/Push Selected/));

    for (const call of updateTaskMock.mock.calls) {
      expect(call[0]).toMatch(/^backlog-1|^todo-1|^blocked-1|^done-1|^stale-1$/);
      expect(call[1]).toMatchObject({ status: 'todo', completedAt: undefined, completedBy: undefined });
    }
    expect(updateTaskMock.mock.calls.length).toBeGreaterThan(0);
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
