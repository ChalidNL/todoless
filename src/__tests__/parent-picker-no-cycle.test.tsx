import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CompactTaskCard } from '../components/shared/CompactTaskCard';
import type { Task } from '../types';

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));
vi.mock('../lib/pocketbase-client', () => ({ api: { createSubtask: vi.fn() } }));

const parent: Task = { id: 'a', title: 'Plan the party', status: 'todo', blocked: false, flag: false, labels: [], createdAt: 1 };
const ownSubtask: Task = { id: 'b', title: 'Order the cake', status: 'todo', blocked: false, flag: false, labels: [], linkedTo: 'a', linkedType: 'task', createdAt: 1 };
const other: Task = { id: 'c', title: 'Fix the bike', status: 'todo', blocked: false, flag: false, labels: [], createdAt: 1 };
const otherSubtask: Task = { id: 'd', title: 'Buy a tube', status: 'todo', blocked: false, flag: false, labels: [], linkedTo: 'c', linkedType: 'task', createdAt: 1 };

// Every list hides a task whose linkedTo points at another task, and a parent
// card renders one level. Offering a task's own subtask as its parent (A -> B
// -> A) therefore hides both tasks from the whole UI.
describe('parent picker', () => {
  it('offers neither the task itself, its own subtask, nor another task\'s subtask', () => {
    useAppMock.mockReturnValue({
      labels: [], shops: [], users: [], tasks: [parent, ownSubtask, other, otherSubtask],
      updateTask: vi.fn(), deleteTask: vi.fn(), addLabel: vi.fn(), addTask: vi.fn(), swapEntity: vi.fn(), toggleChipFilter: vi.fn(),
      isChipFilterActive: vi.fn(() => false), refreshEntries: vi.fn(), showCompletionMessage: vi.fn(), moveTaskToStatus: vi.fn(),
    });
    render(<CompactTaskCard task={parent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Other actions' }));
    fireEvent.click(screen.getByRole('button', { name: /make sub-?task/i }));

    const offered = screen.getAllByRole('button').map((b) => b.textContent || '').filter((text) => ['Plan the party', 'Order the cake', 'Fix the bike', 'Buy a tube'].some((title) => text.includes(title)));
    expect(offered.some((t) => t.includes('Fix the bike'))).toBe(true);
    expect(offered.some((t) => t.includes('Order the cake'))).toBe(false);
    expect(offered.some((t) => t.includes('Buy a tube'))).toBe(false);
    expect(offered.some((t) => t.includes('Plan the party'))).toBe(false);
  });
});
