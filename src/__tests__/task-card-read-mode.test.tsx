import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompactTaskCard } from '../components/shared/CompactTaskCard';
import type { Task } from '../types';

const useAppMock = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    createSubtask: vi.fn(),
  },
}));

const parentTask: Task = {
  id: 'task-1',
  title: 'Visible attributes task',
  status: 'todo',
  blocked: false,
  flag: false,
  labels: ['label-1'],
  dueDate: new Date('2026-06-29T09:00:00').getTime(),
  priority: 'high',
  assignedTo: 'user-1',
  subtaskIds: ['subtask-1'],
  createdAt: Date.now(),
};

const subtask: Task = {
  id: 'subtask-1',
  title: 'Read-only subtask',
  status: 'todo',
  blocked: false,
  flag: false,
  labels: [],
  linkedTo: 'task-1',
  linkedType: 'task',
  createdAt: Date.now(),
};

const baseAppValue = {
  labels: [{ id: 'label-1', name: 'Teat', color: '#22c55e', visibility: 'family' }],
  users: [{ id: 'user-1', firstName: 'Chalid', lastName: 'Test', email: 'chalid@example.com', role: 'owner' }],
  shops: [],
  tasks: [parentTask, subtask],
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  addLabel: vi.fn(),
  addTask: vi.fn(),
  swapEntity: vi.fn(),
  toggleChipFilter: vi.fn(),
  isChipFilterActive: vi.fn(() => false),
  refreshEntries: vi.fn(),
  showCompletionMessage: vi.fn(),
  moveTaskToStatus: vi.fn(),
};

describe('CompactTaskCard read-mode attributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('shows attribute chips while collapsed', () => {
    render(<CompactTaskCard task={parentTask} />);

    expect(screen.getByText('Visible attributes task')).toBeInTheDocument();
    expect(screen.getByText('Teat')).toBeInTheDocument();
    expect(screen.getByText('Chalid')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
  });

  it('shows attribute chips for live PocketBase/raw field shapes', () => {
    const rawTask = {
      ...parentTask,
      id: 'raw-task-1',
      labels: '[]',
      label: 'label-1',
      labelId: undefined,
      dueDate: undefined,
      due_date: '2026-06-29 09:00:00.000Z',
      assignedTo: undefined,
      assigned_to: 'user-1',
      subtaskIds: undefined,
      subtask_ids: '["subtask-1"]',
    } as unknown as Task;

    render(<CompactTaskCard task={rawTask} />);

    expect(screen.getByText('Teat')).toBeInTheDocument();
    expect(screen.getByText('Chalid')).toBeInTheDocument();
    expect(screen.getByText('Jun 29')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
  });

  it('shows chips from PocketBase expand labels, assignee and subtasks', () => {
    const expandedTask = {
      ...parentTask,
      id: 'expand-task-1',
      labels: [],
      label: '',
      assignedTo: undefined,
      subtaskIds: [],
      dueDate: undefined,
      expand: {
        labels: [{ id: 'expand-label-1', name: 'kelder', color: '#f97316' }],
        assignee: { id: 'expand-user-1', firstName: 'Eva', lastName: 'Germain', email: 'eva@example.com' },
        subtasks: [
          { id: 'expand-sub-1', title: 'Sub 1', completed: true },
          { id: 'expand-sub-2', title: 'Sub 2', completed: false },
          { id: 'expand-sub-3', title: 'Sub 3', completed: false },
          { id: 'expand-sub-4', title: 'Sub 4', completed: false },
        ],
      },
    } as unknown as Task;

    render(<CompactTaskCard task={expandedTask} />);

    expect(screen.getByText('kelder')).toBeInTheDocument();
    expect(screen.getByText('Eva')).toBeInTheDocument();
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('shows subtask chip from explicit count fields even without expanded subtasks', () => {
    const countOnlyTask = {
      ...parentTask,
      id: 'count-only-task-1',
      labels: [],
      label: '',
      subtaskIds: [],
      subtaskCount: 4,
      completedSubtasks: 0,
    } as unknown as Task;

    render(<CompactTaskCard task={countOnlyTask} />);

    expect(screen.getByText('0/4')).toBeInTheDocument();
  });

  it('expanded state stays read-only: no list edit inputs or label placeholder', () => {
    const { container } = render(<CompactTaskCard task={parentTask} />);

    fireEvent.click(screen.getByLabelText('Open Editor'));

    expect(screen.getByText('Read-only subtask')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bewerken' })).not.toBeInTheDocument();
    expect(screen.queryByText('tasks.labelInputPlaceholder')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Add a label...')).not.toBeInTheDocument();
    expect(container.querySelector('input')).not.toBeInTheDocument();
    expect(container.querySelector('textarea')).not.toBeInTheDocument();
  });
});
