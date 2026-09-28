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

  it('does not create a task from the calendar search input on Enter', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 10, 7, 0, 0));
    render(<CalendarView />);

    const search = screen.getByPlaceholderText('Search calendar…');
    fireEvent.change(search, { target: { value: 'EnterAgenda' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(addTask).not.toHaveBeenCalled();
    expect(search).toHaveValue('EnterAgenda');
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
    expect(within(agendaCard).getByText(/06:00/)).toBeInTheDocument();
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

  it('navigates month view by calendar month, not 28-day chunks (GH#81)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 10, 0, 0, 0)); // June 15, 2026
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('June 15, 2026');

    // Next: one calendar month forward, same day — the old delta*28 drift would land on July 13.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('July 15, 2026');

    // Previous twice: back to May 15, without the 28-day drift.
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('May 15, 2026');
    vi.useRealTimers();
  });

  it('clamps month navigation from Jan 31 to the last day of February (GH#81)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 31, 10, 0, 0, 0)); // Jan 31, 2026
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('January 31, 2026');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('February 28, 2026');
    vi.useRealTimers();
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

  it('shows multi-day timed entries in week view on every covered day with a continuation marker (GH#82)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0, 0)); // Friday
    const fri1800 = new Date(2026, 8, 25, 18, 0, 0, 0).getTime();
    const sun1800 = new Date(2026, 8, 27, 18, 0, 0, 0).getTime();
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'trip',
        title: 'Trip',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: fri1800,
        startTime: fri1800,
        endTime: sun1800,
        showInCalendar: true,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'week' } });

    // One timed slot per covered day: Friday, Saturday, Sunday.
    expect(screen.getAllByTestId('calendar-timed-task-trip')).toHaveLength(3);
    // Saturday and Sunday are continuation days.
    expect(screen.getAllByTestId('calendar-continuation-marker')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('shows multi-day all-day entries in the all-day row for every covered day (GH#82)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0, 0)); // Friday
    const fri = new Date(2026, 8, 25, 0, 0, 0, 0).getTime();
    const monExclusive = new Date(2026, 8, 28, 0, 0, 0, 0).getTime();
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'festival',
        title: 'Festival',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: fri,
        startTime: fri,
        endTime: monExclusive,
        allDay: true,
        showInCalendar: true,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'week' } });

    // All-day row renders the entry on Friday, Saturday and Sunday (not Monday).
    expect(screen.getAllByText('Festival')).toHaveLength(3);
    expect(screen.getAllByTestId('calendar-continuation-marker')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('shows multi-day entries in every spanned month cell with a continuation marker (GH#82)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0, 0)); // Friday
    const fri1800 = new Date(2026, 8, 25, 18, 0, 0, 0).getTime();
    const sun1800 = new Date(2026, 8, 27, 18, 0, 0, 0).getTime();
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'trip',
        title: 'Trip',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: fri1800,
        startTime: fri1800,
        endTime: sun1800,
        showInCalendar: true,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });

    const monthGrid = screen.getByTestId('calendar-month-grid');
    expect(within(monthGrid).getAllByTestId('compact-task-card-trip')).toHaveLength(3);
    expect(within(monthGrid).getAllByTestId('calendar-continuation-marker')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('shows multi-day entries in the agenda when a continuation day is selected (GH#82)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0, 0)); // Friday
    const fri1800 = new Date(2026, 8, 25, 18, 0, 0, 0).getTime();
    const sun1800 = new Date(2026, 8, 27, 18, 0, 0, 0).getTime();
    useAppMock.mockReturnValue({
      ...baseAppValue,
      tasks: [{
        id: 'trip',
        title: 'Trip',
        status: 'todo',
        blocked: false,
        flag: false,
        labels: [],
        dueDate: fri1800,
        startTime: fri1800,
        endTime: sun1800,
        showInCalendar: true,
        createdAt: 1,
      }],
    });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });

    const monthGrid = screen.getByTestId('calendar-month-grid');
    expect(within(monthGrid).getAllByTestId('compact-task-card-trip')).toHaveLength(3);
    // Click the Saturday day-number button in the month grid (26 Sep 2026).
    fireEvent.click(within(monthGrid).getByText('26'));

    const agenda = screen.getByTestId('calendar-agenda-list');
    expect(within(agenda).getByText('Trip')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
