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

  it('creates a selected-day task immediately when clicking Add button', () => {
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
      allDay: true,
    }));
    expect(addTask.mock.calls[0][0].dueDate).toBe(new Date(2026, 5, 20, 0, 0, 0, 0).getTime());
    expect(addTask.mock.calls[0][0].startTime).toBeUndefined();
    expect(search).toHaveValue('');
    vi.useRealTimers();
  });

  it('creates a selected-day task from the calendar search input on Enter', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 10, 7, 0, 0));
    render(<CalendarView />);

    const search = screen.getByPlaceholderText('Search calendar…');
    fireEvent.change(search, { target: { value: 'EnterAgenda' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'EnterAgenda',
      dueDate: new Date(2026, 5, 20, 0, 0, 0, 0).getTime(),
      allDay: true,
      showInCalendar: true,
    }));
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

  it('renders timed tasks with the same agenda task card view as all-day tasks', () => {
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
    const agendaCard = within(slotCard).getByTestId('compact-task-card-task-compact');
    expect(within(agendaCard).getByText('Teat')).toBeInTheDocument();
    expect(within(agendaCard).getByRole('button', { name: /editor/i })).toBeInTheDocument();
    expect(within(agendaCard).queryByText(/06:00/)).not.toBeInTheDocument();
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

    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Quick task',
      startTime: expect.any(Number),
      endTime: expect.any(Number),
      allDay: false,
      showInCalendar: true,
    }));
    expect(new Date(addTask.mock.calls[0][0].startTime).getHours()).toBe(9);
    // After Enter, the task should be added through the same CalendarView create path and input closed
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
    expect(screen.getAllByTestId('compact-task-card-task-1').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Dentist' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'schedule' } });
    const agenda = screen.getByTestId('calendar-agenda-list');
    expect(within(agenda).getByText('Dentist')).toBeInTheDocument();
    expect(within(agenda).queryByText('No calendar items')).not.toBeInTheDocument();
  });

  it('keeps dated tasks visible across day, 3-day, week, month, and schedule views', () => {
    const now = new Date();
    const taskStart = new Date(now);
    taskStart.setHours(11, 0, 0, 0);
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'calendar-regression',
        title: 'Calendar regression task',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: taskStart.getTime(),
        startTime: taskStart.getTime(),
        endTime: taskStart.getTime() + 60 * 60 * 1000,
        showInCalendar: false,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);
    const viewSelect = screen.getByRole('combobox', { name: 'Calendar view' });

    for (const view of ['day', '3days', 'week', 'month', 'schedule']) {
      fireEvent.change(viewSelect, { target: { value: view } });
      expect(screen.getAllByText('Calendar regression task').length).toBeGreaterThan(0);
    }
    fireEvent.change(viewSelect, { target: { value: '3days' } });
    expect(screen.getByTestId('calendar-3days-time-grid')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-now-line')).toBeInTheDocument();
  });
});
