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

  it('opens compact quick add using the header search field as title input and saves with an icon', () => {
    render(<CalendarView />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.queryByTestId('calendar-event-modal')).not.toBeInTheDocument();
    const quickAdd = screen.getByTestId('calendar-quick-add');
    expect(quickAdd).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Event Title')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('New event…')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-time-row')).toHaveClass('grid-cols-2');
    expect((screen.getByLabelText(/Start/) as HTMLInputElement).value).toMatch(/T09:00$/);

    fireEvent.change(screen.getByPlaceholderText('New event…'), { target: { value: 'Plan sprint' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Plan sprint' }));
  });

  it('preserves typed header text when plus starts quick add and validates save', async () => {
    render(<CalendarView />);

    fireEvent.change(screen.getByPlaceholderText('Search calendar…'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByPlaceholderText('New event…')).toHaveValue('test');
    fireEvent.change(screen.getByPlaceholderText('New event…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    expect(addTask).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
  });

  it('creates a task, closes quick add, and shows it immediately without refetch', async () => {
    render(<CalendarView />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.change(screen.getByPlaceholderText('New event…'), { target: { value: 'Visible now' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));

    expect(await screen.findByText('Visible now')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-quick-add')).not.toBeInTheDocument();
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
