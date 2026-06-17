import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarView } from '../components/calendar/CalendarView';

const useAppMock = vi.fn();
const updateTask = vi.fn();
const addCalendarEvent = vi.fn();

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
  calendarEvents: [],
  tasks: [],
  addCalendarEvent,
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  updateTask,
  filters: [],
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  activeChipFilters: [],
  addFilter: vi.fn(),
  showCompletionMessage: vi.fn(),
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
    expect(screen.getAllByText('Today')).toHaveLength(1);
    expect(screen.queryByText('Calendar view')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent(/(\d{1,2}.*(Jun|June).*2026)|(June \d{1,2}, 2026)/);

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
    expect(addCalendarEvent).toHaveBeenCalledWith(expect.objectContaining({ title: 'Plan sprint' }));
  });

  it('preserves typed header text when plus starts quick add and validates save', async () => {
    render(<CalendarView />);

    fireEvent.change(screen.getByPlaceholderText('Search calendar…'), { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByPlaceholderText('New event…')).toHaveValue('test');
    fireEvent.change(screen.getByPlaceholderText('New event…'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    expect(addCalendarEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required');
  });

  it('creates an event, closes quick add, and shows it immediately without refetch', async () => {
    addCalendarEvent.mockResolvedValueOnce({ id: 'new-1', title: 'Visible now', startTime: Date.now(), endTime: Date.now() + 3600000, createdAt: Date.now(), source: 'local' });
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
    expect(screen.getAllByText('07:00')[0]).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });
    expect(screen.getByTestId('calendar-day-time-grid')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-now-line')).toBeInTheDocument();
  });

  it('opens inline quick add on a day time slot and keeps details collapsed until requested', () => {
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });
    fireEvent.click(screen.getByTestId('calendar-slot-09'));

    expect(screen.getByTestId('calendar-quick-add')).toBeInTheDocument();
    expect((screen.getByLabelText(/Start/) as HTMLInputElement).value).toMatch(/T09:00$/);
    expect(screen.queryByPlaceholderText('Event Title')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('New event…')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Location')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More details' }));
    expect(screen.getByPlaceholderText('Location')).toBeInTheDocument();
  });

  it('marks today in month view and skips empty days in agenda view', () => {
    const now = new Date();
    const eventStart = new Date(now);
    eventStart.setHours(13, 0, 0, 0);
    const eventEnd = new Date(now);
    eventEnd.setHours(14, 0, 0, 0);
    useAppMock.mockReturnValue({
      ...baseAppValue,
      calendarEvents: [{ id: 'event-1', title: 'Dentist', startTime: eventStart.getTime(), endTime: eventEnd.getTime(), createdAt: 1, source: 'local' }],
    });

    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    const todayCell = screen.getByTestId('calendar-today');
    expect(todayCell).toHaveClass('border-black');

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'agenda' } });
    const agenda = screen.getByTestId('calendar-agenda-list');
    expect(within(agenda).getByText('Dentist')).toBeInTheDocument();
    expect(within(agenda).getByTestId('calendar-date-chip')).toBeInTheDocument();
    expect(within(agenda).queryByText('No calendar items')).not.toBeInTheDocument();
  });
});
