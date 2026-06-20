import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarView } from '../components/calendar/CalendarView';

const useAppMock = vi.fn();
const addTask = vi.fn();
const updateTask = vi.fn();
const deleteTask = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

const baseAppValue = {
  tasks: [],
  addTask,
  updateTask,
  deleteTask,
  users: [],
  labels: [],
  shops: [],
  filters: [],
  addLabel: vi.fn(),
  swapEntity: vi.fn(),
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  isChipFilterActive: vi.fn().mockReturnValue(false),
  activeChipFilters: [],
  addFilter: vi.fn(),
  refreshEntries: vi.fn(),
  showCompletionMessage: vi.fn(),
  moveTaskToStatus: vi.fn(),
};

describe('CalendarView UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppMock.mockReturnValue(baseAppValue);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  it('shows one clean nav row with a period title and an unlabeled view dropdown', () => {
    render(<CalendarView />);

    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(screen.queryByText('Calendar view')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent(/2026/);

    const switcher = screen.getByRole('combobox', { name: 'Calendar view' });
    expect(switcher).toHaveAttribute('data-component', 'shared-select');
    expect(switcher).toHaveValue('month');
    expect(screen.queryByRole('button', { name: 'Month' })).not.toBeInTheDocument();
  });

  it('creates a task immediately when clicking Add button', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 10, 7, 0, 0));
    render(<CalendarView />);

    const search = screen.getByPlaceholderText('Search calendar…');
    fireEvent.change(search, { target: { value: 'From search' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // No quick-add form — addTask is called directly
    expect(screen.queryByTestId('calendar-quick-add')).not.toBeInTheDocument();
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'From search',
      status: 'todo',
      showInCalendar: true,
      allDay: false,
    }));
    expect(addTask.mock.calls[0][0].startTime).toBe(new Date(2026, 5, 20, 10, 15, 0, 0).getTime());
    expect(search).toHaveValue('');
    vi.useRealTimers();
  });

  it('renders week and day as screen-filling time grids with a current-time line', () => {
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'week' } });
    expect(screen.getByTestId('calendar-week-time-grid')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-now-line')).toBeInTheDocument();
    expect(screen.getAllByText('00:00')[0]).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });
    expect(screen.getByTestId('calendar-day-time-grid')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-now-line')).toBeInTheDocument();
  });

  it('renders timed tasks in day view through the expandable CompactTaskCard', () => {
    const now = new Date();
    const taskStart = new Date(now);
    taskStart.setHours(6, 0, 0, 0);
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'task-compact',
        title: 'Teat',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: taskStart.getTime(),
        showInCalendar: true,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });

    const slotCard = screen.getByTestId('calendar-timed-task-task-compact');
    expect(within(slotCard).getByText('Teat')).toBeInTheDocument();
    fireEvent.click(within(slotCard).getByRole('button', { name: 'Open Editor' }));
    expect(within(slotCard).getByLabelText('tasks.editTaskTitle')).toBeInTheDocument();
  });

  it('opens inline title input on a day time slot and creates task on Enter', () => {
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });
    fireEvent.click(screen.getByTestId('calendar-slot-09'));

    // Google-style: inline text input appears at the slot, not the header quick-add form
    const inlineInput = screen.getByPlaceholderText('New event…');
    expect(inlineInput).toBeInTheDocument();
    fireEvent.change(inlineInput, { target: { value: 'Quick task' } });
    fireEvent.keyDown(inlineInput, { key: 'Enter' });

    // After Enter, the task should be added and input closed
    expect(screen.queryByPlaceholderText('New event…')).not.toBeInTheDocument();
  });

  it('marks today in month view and shows tasks in agenda view', () => {
    const now = new Date();
    const taskStart = new Date(now);
    taskStart.setHours(13, 0, 0, 0);
    const taskEnd = new Date(now);
    taskEnd.setHours(14, 0, 0, 0);
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'task-1',
        title: 'Dentist',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: taskStart.getTime(),
        startTime: taskStart.getTime(),
        endTime: taskEnd.getTime(),
        showInCalendar: true,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    const todayCell = screen.getByTestId('calendar-today');
    expect(todayCell).toHaveClass('border-black');

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'agenda' } });
    const agenda = screen.getByTestId('calendar-agenda-list');
    expect(within(agenda).getByText('Dentist')).toBeInTheDocument();
    expect(within(agenda).queryByText('No calendar items')).not.toBeInTheDocument();
  });
});
