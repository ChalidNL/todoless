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
      addLabel: vi.fn(() => ({ id: 'new-label', name: 'new', color: '#3b82f6' })),
      convertTaskToItem: vi.fn(),
      labels: [{ id: 'l1', name: 'home', color: '#3b82f6' }],
      users: [{ id: 'u1', firstName: 'Chalid', role: 'admin' }],
      toggleChipFilter: vi.fn(),
      isChipFilterActive: vi.fn(() => false),
      clearChipFilters: vi.fn(),
      activeChipFilters: [],
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

  it('does not show flag chip (chip removed, attribute button has color)', () => {
    const flagged = { ...baseTask, flag: true, blocked: true };
    const { container } = render(<CompactTaskCard task={flagged as any} />);

    // No flag chip in line 2
    expect(screen.queryByText('Flagged')).toBeNull();
    // Card gets red tint from flag
    const root = container.firstChild as HTMLElement;
    expect(root.className.includes('!bg-red-50')).toBeTruthy();
    // Flag attribute button shows when hamburger opens
    fireEvent.click(screen.getByLabelText('Open task attributes'));
    expect(screen.getByLabelText('Toggle flag')).toBeTruthy();
  });

  // When hamburger is CLOSED, clicking chip opens the editor
  it('opens label editor when label chip is clicked (hamburger closed)', () => {
    const withLabels = { ...baseTask, labels: ['l1'] };
    render(<CompactTaskCard task={withLabels as any} />);

    fireEvent.click(screen.getByText('home'));
    expect(screen.getByLabelText('Label input')).toBeTruthy();
  });

  it('opens assignee editor when assignee chip is clicked', () => {
    const withAssignee = { ...baseTask, assignedTo: 'u1' };
    render(<CompactTaskCard task={withAssignee as any} />);

    fireEvent.click(screen.getByText('Chalid'));
    expect(screen.getByLabelText('Search assignee')).toBeTruthy();
  });

  it('opens schedule editor when date chip is clicked', () => {
    const withDate = { ...baseTask, dueDate: new Date('2026-06-01').getTime() };
    render(<CompactTaskCard task={withDate as any} />);

    // Click the date chip (e.g. "jun 1")
    fireEvent.click(screen.getByText(/jun/i));
    expect(screen.getByLabelText('Due date')).toBeTruthy();
  });

  it('opens schedule editor when repeat chip is clicked', () => {
    const withRepeat = { ...baseTask, repeatInterval: 'week' as const, dueDate: Date.now() };
    render(<CompactTaskCard task={withRepeat as any} />);

    fireEvent.click(screen.getByText('Weekly'));
    expect(screen.getByLabelText('Due date')).toBeTruthy();
  });

  it('shows clear labels button when labels exist', () => {
    const withLabels = { ...baseTask, labels: ['l1'] };
    render(<CompactTaskCard task={withLabels as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));
    fireEvent.click(screen.getByLabelText('Edit labels'));

    expect(screen.getByLabelText('Clear all labels')).toBeTruthy();
  });

  // --- Inline title editing tests ---

  it('shows editable title input when hamburger is opened (Edit Mode)', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    expect(screen.queryByLabelText('Edit task title')).toBeNull();

    fireEvent.click(screen.getByLabelText('Open task attributes'));

    const input = screen.getByLabelText('Edit task title') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Pay bills');
  });

  it('saves edited title on blur', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));

    const input = screen.getByLabelText('Edit task title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Pay all bills' } });
    fireEvent.blur(input);

    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { title: 'Pay all bills' });
  });

  it('saves edited title on Enter key', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));

    const input = screen.getByLabelText('Edit task title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Pay all bills' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockUpdateTask).toHaveBeenCalledWith('task-1', { title: 'Pay all bills' });
  });

  it('reverts title on Escape key', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));

    const input = screen.getByLabelText('Edit task title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Pay all bills' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(input.value).toBe('Pay bills');
  });

  it('restores original title when input is cleared and blurred', () => {
    render(<CompactTaskCard task={baseTask as any} />);
    fireEvent.click(screen.getByLabelText('Open task attributes'));

    const input = screen.getByLabelText('Edit task title') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(mockUpdateTask).not.toHaveBeenCalled();
    expect(input.value).toBe('Pay bills');
  });

  it('renders light orange background when task is overdue', () => {
    const overdue = { ...baseTask, dueDate: Date.now() - 86400000 }; // 1 day ago
    const { container } = render(<CompactTaskCard task={overdue as any} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className.includes('!bg-orange-50')).toBeTruthy();
  });

  it('does NOT show orange background for completed overdue task', () => {
    const completedOverdue = { ...baseTask, status: 'done', dueDate: Date.now() - 86400000 };
    const { container } = render(<CompactTaskCard task={completedOverdue as any} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className.includes('!bg-orange-50')).toBeFalsy();
  });

  it('shows red (flagged) background instead of orange when task is both flagged and overdue', () => {
    const flaggedAndOverdue = { ...baseTask, flag: true, blocked: true, dueDate: Date.now() - 86400000 };
    const { container } = render(<CompactTaskCard task={flaggedAndOverdue as any} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className.includes('!bg-red-50')).toBeTruthy();
    expect(root.className.includes('!bg-orange-50')).toBeFalsy();
  });

  it('shows white background for non-overdue, non-flagged task', () => {
    const { container } = render(<CompactTaskCard task={baseTask as any} />);
    const root = container.firstChild as HTMLElement;
    expect(root.className.includes('!bg-orange-50')).toBeFalsy();
    expect(root.className.includes('!bg-red-50')).toBeFalsy();
    expect(root.className.includes('bg-white')).toBeTruthy();
  });
});
