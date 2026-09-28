import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

const task: Task = {
  id: 'task-timer-1',
  title: 'Timer card',
  status: 'todo',
  blocked: false,
  flag: false,
  labels: [],
  createdAt: Date.now(),
};

const baseAppValue = {
  labels: [],
  users: [],
  shops: [],
  tasks: [task],
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

describe('CompactTaskCard inactivity timeout (GH#78)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppMock.mockReturnValue(baseAppValue);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not run a setInterval poll while the editor menu is open', () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(<CompactTaskCard task={task} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));

    expect(screen.getByRole('button', { name: 'Close Editor' })).toBeInTheDocument();
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('schedules a single 60s timeout and closes the menu when it fires', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    render(<CompactTaskCard task={task} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));

    expect(screen.getByRole('button', { name: 'Close Editor' })).toBeInTheDocument();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(screen.getByRole('button', { name: 'Close Editor' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByRole('button', { name: 'Close Editor' })).not.toBeInTheDocument();
  });

  it('resets the 60s timeout on interaction', () => {
    vi.useFakeTimers();

    render(<CompactTaskCard task={task} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));

    // Half the inactivity window passes...
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // An interaction inside the menu resets the timer.
    fireEvent.click(screen.getByRole('button', { name: 'Edit labels' }));
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Still open: the timer was reset, so 60s have not elapsed since the interaction.
    expect(screen.getByRole('button', { name: 'Close Editor' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByRole('button', { name: 'Close Editor' })).not.toBeInTheDocument();
  });
});