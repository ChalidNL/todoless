import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('CompactTaskCard attributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  it('shows label, assignee, date, priority, and subtask chips in collapsed state', () => {
    render(<CompactTaskCard task={parentTask} />);

    expect(screen.getByText('Visible attributes task')).toBeInTheDocument();
    expect(screen.getByText('Teat')).toBeInTheDocument();
    // Assignee is now a round avatar with aria-label, not a text chip
    expect(screen.getByLabelText(/Assignee: Chalid/i)).toBeInTheDocument();
    // Priority is now an icon-only button with aria-label, not a text chip
    expect(screen.getByLabelText(/Priority: High/i)).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();
  });

  it('shows subtask chip in collapsed when subtaskIds present', () => {
    render(<CompactTaskCard task={parentTask} />);

    expect(screen.getByText('0/1')).toBeInTheDocument();
  });
});
