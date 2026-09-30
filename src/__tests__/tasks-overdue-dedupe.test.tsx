import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));
vi.mock('../components/shared/TaskCard', () => ({
  TaskCard: ({ task }: { task: { title: string } }) => <div data-testid="task-row">{task.title}</div>,
}));
vi.mock('../components/shared/CompactTaskCard', () => ({
  CompactTaskCard: ({ task }: { task: { title: string } }) => <div data-testid="task-row">{task.title}</div>,
}));
vi.mock('../components/shared/NewGlobalHeader', () => ({
  AppHeader: ({ onSearch }: { onSearch: (q: string) => void }) => <input aria-label="search" onChange={(e) => onSearch(e.target.value)} />,
}));

import { TasksView } from '../components/TasksView';

const HOUR = 3_600_000;
const task = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, status: 'todo', blocked: false, labels: [], createdAt: 0, ...extra,
});

describe('Tasks screen sections', () => {
  beforeEach(() => {
    const now = Date.now();
    useAppMock.mockReturnValue({
      tasks: [
        task('a', 'Overdue plumber', { dueDate: now - 5 * HOUR }),
        task('b', 'Overdue dentist', { dueDate: now - 2 * HOUR }),
        task('c', 'Future task', { dueDate: now + 72 * HOUR }),
        task('d', 'Blocked and overdue', { dueDate: now - HOUR, blocked: true }),
        task('e', 'Inbox item overdue', { status: 'backlog', dueDate: now - HOUR }),
      ],
      activeChipFilters: [],
      addTask: vi.fn(),
      deleteTasks: vi.fn(),
      showCompletionMessage: vi.fn(),
    });
  });

  it('renders every task exactly once (overdue tasks are not repeated in the main list)', () => {
    render(<TasksView />);
    const titles = screen.getAllByTestId('task-row').map((row) => row.textContent);
    expect(titles.sort()).toEqual(['Blocked and overdue', 'Future task', 'Overdue dentist', 'Overdue plumber']);
    const overdue = screen.getByTestId('overdue-section');
    expect(within(overdue).getAllByTestId('task-row').map((row) => row.textContent)).toEqual(['Overdue plumber', 'Overdue dentist']);
  });

  it('applies search to the overdue section too', () => {
    render(<TasksView />);
    fireEvent.change(screen.getByLabelText('search'), { target: { value: 'dentist' } });
    expect(screen.getAllByTestId('task-row').map((row) => row.textContent)).toEqual(['Overdue dentist']);
  });
});
