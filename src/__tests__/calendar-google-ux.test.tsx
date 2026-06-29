import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CalendarView } from '../components/calendar/CalendarView';
import { Settings } from '../components/Settings';
import { SettingsPreferences } from '../components/SettingsPreferences';
import { LabelsView } from '../components/LabelsView';
import type { Task } from '../types';

const useAppMock = vi.fn();
const addTask = vi.fn();
const updateAppSettings = vi.fn();

vi.mock('../context/AppContext', () => ({
  useApp: () => useAppMock(),
}));

vi.mock('../components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, signOut: vi.fn() }),
}));

vi.mock('../context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en', t: (key: string) => ({
    'ics.importTitle': 'Import Calendar (.ics)',
    'ics.importDescription': 'Import appointments from Google Calendar, Apple Calendar, or any .ics file.',
    'ics.exportTitle': 'Export Calendar',
    'ics.exportButton': 'Export as .ics',
  }[key] || key) }),
}));

vi.mock('../lib/pocketbase-client', () => ({
  api: {
    getFamilyById: vi.fn().mockResolvedValue({ name: 'Family' }),
    login: vi.fn(),
    getApiTokens: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../lib/pocketbase', () => ({
  pb: { authStore: { token: 'token' } },
}));

vi.mock('../lib/app-update', () => ({
  fetchLatestAppVersion: vi.fn().mockResolvedValue(null),
  forceRefreshApp: vi.fn(),
  getNormalizedAppVersion: vi.fn().mockReturnValue('dev'),
  shouldShowUpdateButton: vi.fn().mockReturnValue(false),
}));

vi.mock('../lib/api-client', () => ({
  api: {
    tasks: {
      icsExport: vi.fn().mockResolvedValue({ ics: 'BEGIN:VCALENDAR\nEND:VCALENDAR', count: 0 }),
      icsImport: vi.fn().mockResolvedValue({ created: 0, updated: 0, skipped: 0 }),
    },
  },
}));

const baseAppValue = {
  tasks: [],
  addTask,
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  users: [{ id: 'user-1', email: 'me@example.com', name: 'Me', role: 'owner' }],
  labels: [],
  shops: [],
  filters: [],
  appSettings: { currentUserId: 'user-1', sprintStartDay: 1 },
  updateAppSettings,
  updateUser: vi.fn().mockResolvedValue(true),
  deleteUser: vi.fn().mockResolvedValue(true),
  addLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  addShop: vi.fn(),
  updateShop: vi.fn(),
  deleteShop: vi.fn(),
  deleteFilter: vi.fn(),
  swapEntity: vi.fn(),
  toggleChipFilter: vi.fn(),
  clearChipFilters: vi.fn(),
  isChipFilterActive: vi.fn().mockReturnValue(false),
  activeChipFilters: [],
  activeLabelFilters: [],
  addFilter: vi.fn(),
  refreshEntries: vi.fn(),
  showCompletionMessage: vi.fn(),
  moveTaskToStatus: vi.fn(),
};

describe('Calendar Google-inspired UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAppMock.mockReturnValue(baseAppValue);
    vi.stubGlobal('__APP_VERSION__', 'dev');
    vi.stubGlobal('__APP_COMMIT__', 'local');
    vi.stubGlobal('__APP_BUILD_ID__', 'test');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  });

  it('creates from the header input on Enter once and clears the bar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 10, 7, 0, 0));
    render(<CalendarView />);

    const search = screen.getByPlaceholderText('Search calendar…');
    fireEvent.change(search, { target: { value: 'Enter saved task' } });
    search.focus();
    expect(fireEvent.keyDown(search, { key: 'Enter' })).toBe(false);
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(addTask).toHaveBeenCalledTimes(1);
    expect(addTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Enter saved task', showInCalendar: true }));
    expect(search).toHaveValue('');
    expect(document.activeElement).toBe(search);
    vi.useRealTimers();
  });

  it('orders and names views like Google, including 3 days and Schedule', () => {
    render(<CalendarView />);
    const options = within(screen.getByRole('combobox', { name: 'Calendar view' })).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Schedule', 'Day', '3 days', 'Week', 'Work week', 'Month']);
  });

  it('draws the now line as a full-width line with a current-time chip on the time axis', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 8, 38, 0, 0));
    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });

    const nowLine = screen.getByTestId('calendar-now-line');
    expect(nowLine).toHaveClass('left-0');
    expect(nowLine).toHaveClass('right-0');
    expect(nowLine).toHaveClass('h-[2px]');
    expect(nowLine).toHaveClass('z-[60]');
    expect(screen.getByTestId('calendar-now-time-chip')).toHaveTextContent('08:38');
    expect(screen.queryByTestId('calendar-now-dot')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('renders overlapping timed tasks as opaque time-slot blocks that expand into a larger editor', () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const taskA = task({ id: 'a', title: 'Alpha', dueDate: start.getTime(), startTime: start.getTime(), endTime: start.getTime() + 2 * 3600000 });
    const taskB = task({ id: 'b', title: 'B', dueDate: start.getTime() + 30 * 60000, startTime: start.getTime() + 30 * 60000, endTime: start.getTime() + 90 * 60000 });
    useAppMock.mockReturnValue({ ...baseAppValue, tasks: [taskA, taskB] });

    render(<CalendarView />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'day' } });

    const first = screen.getByTestId('calendar-timed-task-a');
    const second = screen.getByTestId('calendar-timed-task-b');
    expect(first).toHaveStyle({ width: '50%' });
    expect(second).toHaveStyle({ width: '50%' });
    expect(first).toHaveStyle({ height: '112px' });
    expect(first).toHaveClass('bg-violet-100');
    expect(first).toHaveClass('rounded-sm');
    const title = within(first).getByText('Alpha');
    const time = within(first).getByText(/09:00/);
    expect(first.textContent?.indexOf('Alpha')).toBeLessThan(first.textContent?.indexOf('09:00') ?? -1);
    expect(title).toHaveClass('text-[12px]');
    expect(title).toHaveClass('font-bold');
    expect(time).toHaveClass('text-[10px]');
    expect(within(first).queryByText(/Jun/)).not.toBeInTheDocument();
    expect(within(first).queryByRole('checkbox')).not.toBeInTheDocument();
    const calendarCard = within(first).getByTestId('compact-task-card-a');
    expect(calendarCard).toHaveAttribute('data-component', 'CompactTaskCard');
    fireEvent.click(within(first).getByText('Alpha'));
    expect(calendarCard).toHaveStyle({ width: 'calc(100vw - 24px)', maxWidth: '430px' });
    expect(calendarCard).toHaveClass('max-w-none');
  });

  it('uses the selected first day of week for week and month ranges', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 17, 12)); // Wednesday
    useAppMock.mockReturnValue({ ...baseAppValue, appSettings: { currentUserId: 'user-1', sprintStartDay: 0 } });
    render(<CalendarView />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'week' } });
    expect(screen.getByTestId('calendar-period-title')).toHaveTextContent('Jun 14');

    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar view' }), { target: { value: 'month' } });
    const headers = screen.getAllByTestId('calendar-month-weekday').map((node) => node.textContent);
    expect(headers[0]).toMatch(/Sun/i);
    vi.useRealTimers();
  });

  it('persists first day of week from Settings', () => {
    render(<SettingsPreferences />);
    const select = screen.getByRole('combobox', { name: 'First day of week' });
    fireEvent.change(select, { target: { value: '0' } });
    expect(updateAppSettings).toHaveBeenCalledWith({ sprintStartDay: 0 });
  });

  it('places calendar import/export actions in Settings preferences instead of the calendar toolbar', () => {
    const { unmount } = render(<SettingsPreferences />);
    expect(screen.getByRole('button', { name: 'Import Calendar (.ics)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export as .ics' })).toBeInTheDocument();
    unmount();

    render(<CalendarView />);
    expect(screen.queryByRole('button', { name: 'Import Calendar (.ics)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export as .ics' })).not.toBeInTheDocument();
  });

  it('renders Settings labels as compact single-row items without duplicate label names', () => {
    useAppMock.mockReturnValue({
      ...baseAppValue,
      labels: [
        { id: 'label-1', name: 'CAF', color: '#2563eb', visibility: 'family' },
        { id: 'label-2', name: 'Personal', color: '#dc2626', visibility: 'private' },
      ],
    });

    render(<LabelsView />);

    const cafRow = screen.getByText('CAF').closest('article')!;
    expect(cafRow).toHaveClass('app-card');
    expect(within(cafRow).getAllByText('CAF')).toHaveLength(1);
    expect(within(cafRow).getByText('family')).toBeInTheDocument();
  });
});

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'Task',
    status: 'todo',
    blocked: false,
    labels: [],
    flag: false,
    createdAt: Date.now(),
    showInCalendar: true,
    ...overrides,
  };
}
