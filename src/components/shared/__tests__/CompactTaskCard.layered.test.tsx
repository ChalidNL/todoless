import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../context/AppContext', () => ({
  useApp: vi.fn(),
}));

const { CompactTaskCard } = await import('../CompactTaskCard');
const { useApp } = await import('../../../context/AppContext');

const mockUpdateTask = vi.fn();
const mockDeleteTask = vi.fn();

const task = {
  id: 'task-1',
  title: 'Pay bills',
  status: 'todo',
  blocked: false,
  labels: [],
  flag: false,
  createdAt: Date.now(),
};

describe('CompactTaskCard layered attributes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useApp as any).mockReturnValue({
      updateTask: mockUpdateTask,
      deleteTask: mockDeleteTask,
      labels: [{ id: 'l1', name: 'home', color: '#3b82f6' }],
      users: [{ id: 'u1', name: 'Chalid', role: 'admin' }],
    });
  });

  it('shows only task attribute icons in layer 2', () => {
    render(<CompactTaskCard task={task as any} />);
    fireEvent.click(screen.getByLabelText('Open task menu'));

    expect(screen.getByLabelText('Edit labels')).toBeTruthy();
    expect(screen.getByLabelText('Edit assignee')).toBeTruthy();
    expect(screen.getByLabelText('Edit due date and recurring')).toBeTruthy();
    expect(screen.getByLabelText('Edit flag')).toBeTruthy();

    expect(screen.queryByLabelText('Edit shop')).toBeNull();
    expect(screen.queryByLabelText('Edit quantity')).toBeNull();
  });

  it('opens assignee selector from @ icon', () => {
    render(<CompactTaskCard task={task as any} />);
    fireEvent.click(screen.getByLabelText('Open task menu'));
    fireEvent.click(screen.getByLabelText('Edit assignee'));

    fireEvent.click(screen.getByText('Chalid'));
    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { assignedTo: 'u1' });
  });
});
