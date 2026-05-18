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
const mockAddLabel = vi.fn(() => ({ id: 'new-label', name: 'new', color: '#3b82f6' }));

const baseTask = {
  id: 'task-1',
  title: 'Pay bills',
  status: 'todo',
  blocked: false,
  labels: [],
  flag: false,
  createdAt: Date.now(),
};

describe('CompactTaskCard compact layout (GroceryCard style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useApp as any).mockReturnValue({
      updateTask: mockUpdateTask,
      deleteTask: mockDeleteTask,
      addLabel: mockAddLabel,
      convertTaskToItem: vi.fn(),
      labels: [{ id: 'l1', name: 'home', color: '#3b82f6' }],
      users: [{ id: 'u1', name: 'Chalid Mekran', role: 'admin' }],
    });
  });

  it('shows single-line layout with title visible before hamburger tap', () => {
    render(<CompactTaskCard task={baseTask as any} />);

    expect(screen.getByText('Pay bills')).toBeTruthy();
    expect(screen.getByLabelText('Open task attributes')).toBeTruthy();
    expect(screen.getByLabelText('Mark as done')).toBeTruthy();
    // Attributes hidden until hamburger tap
    expect(screen.queryByLabelText('Edit labels')).toBeNull();
    expect(screen.queryByLabelText('Edit assignee')).toBeNull();
    expect(screen.queryByLabelText('Edit schedule')).toBeNull();
    expect(screen.queryByLabelText('Toggle flag')).toBeNull();
  });

  it('opens all attribute buttons when hamburger is tapped', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));

    expect(screen.getByLabelText('Edit labels')).toBeTruthy();
    expect(screen.getByLabelText('Edit assignee')).toBeTruthy();
    expect(screen.getByLabelText('Edit schedule')).toBeTruthy();
    expect(screen.getByLabelText('Toggle flag')).toBeTruthy();
    expect(screen.getByLabelText('Delete task')).toBeTruthy();
  });

  it('shows label input when label icon is tapped in menu', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));
    fireEvent.click(screen.getByLabelText('Edit labels'));

    expect(screen.getByLabelText('Label input')).toBeTruthy();
  });

  it('toggles flag and blocked state on flag click', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));
    fireEvent.click(screen.getByLabelText('Toggle flag'));

    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { flag: true, blocked: true });
  });

  it('renders light red tinted card when task is flagged/blocked', () => {
    const { container } = render(
      <CompactTaskCard task={{ ...baseTask, flag: true, blocked: true } as any} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className.includes('!bg-red-50')).toBeTruthy();
    expect(root.className.includes('border-red-300')).toBeTruthy();
  });

  it('shows due date badge when task has dueDate', () => {
    const withDate = { ...baseTask, dueDate: new Date('2026-06-01').getTime() };
    render(<CompactTaskCard task={withDate as any} />);

    expect(screen.getByText(/jun/i)).toBeTruthy();
  });

  it('shows flag icon (no text) when task is flagged', () => {
    const flagged = { ...baseTask, flag: true };
    render(<CompactTaskCard task={flagged as any} />);

    // Flag chip should render WITHOUT "Flagged" text (AT-001)
    // The chip exists but has empty label text
    expect(screen.queryByText('Flagged')).toBeNull();
    // Card still has red background
    const { container } = render(
      <CompactTaskCard task={{ ...baseTask, flag: true, blocked: true } as any} />
    );
    expect((container.firstChild as HTMLElement).className.includes('!bg-red-50')).toBeTruthy();
  });

  it('toggles label assignment on chip click (no filter)', () => {
    const withLabel = {
      ...baseTask,
      labels: ['l1'],
    };
    render(<CompactTaskCard task={withLabel as any} />);

    // Label chip "home" should be visible in line 2
    const homeChip = screen.getByText('home');
    expect(homeChip).toBeTruthy();

    // Click on label chip → removes label (toggle off)
    fireEvent.click(homeChip);
    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { labels: [] });
  });

  it('shows first name only for assignee', () => {
    const withAssignee = {
      ...baseTask,
      assignedTo: 'u1',
    };
    render(<CompactTaskCard task={withAssignee as any} />);

    // Should show "Chalid" not "Chalid Mekran" (AT-005)
    expect(screen.getByText('Chalid')).toBeTruthy();
    expect(screen.queryByText('Chalid Mekran')).toBeNull();
  });

  it('unassigns on assignee chip click', () => {
    const withAssignee = {
      ...baseTask,
      assignedTo: 'u1',
    };
    render(<CompactTaskCard task={withAssignee as any} />);

    fireEvent.click(screen.getByText('Chalid'));
    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { assignedTo: undefined });
  });
});
